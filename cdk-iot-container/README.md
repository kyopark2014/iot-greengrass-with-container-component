# CDK로 Container Component 배포하기 

## CDK 초기화

[AWS CDK](https://github.com/kyopark2014/technical-summary/blob/main/cdk-introduction.md)를 참조하여 아래와 같이 CDK를 초기화 합니다.

```java
mkdir cdk-lambda-component && cd cdk-lambda-component
cdk init app --language typescript
```

아래처럼 Boostraping을 수행합니다. 이것은 1회만 수행하면 됩니다. 

```java
cdk bootstrap aws://123456789012/ap-northeast-2
```

여기서 "123456789012"은 AccountID로서 "aws sts get-caller-identity --query Account --output text"로 확인할 수 있습니다. 

CDK V2 라이브러리인 aws-cdk-lib를 설치합니다.

```java
npm install -g aws-cdk-lib
```


## CDK Code 작성하기


### S3 및 Core device 설정 

Core device의 정보와 Account 정보를 아래와 같이 설정합니다. Recipe와 Article 배포를 위해 아래와 같이 S3 Bucket을 준비하고 관련 코드들을 복사합니다. 

```java
    const deviceName = 'GreengrassCore-18163f7ac3e'
    const accountId = cdk.Stack.of(this).account

    // S3 for artifact storage
    const s3Bucket = new s3.Bucket(this, "gg-depolyment-storage",{
      bucketName: "gg-depolyment-storage",
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
      versioned: false,
    });
    new cdk.CfnOutput(this, 'bucketName', {
      value: s3Bucket.bucketName,
      description: 'The nmae of bucket',
    });
    new cdk.CfnOutput(this, 's3Arn', {
      value: s3Bucket.bucketArn,
      description: 'The arn of s3',
    });
    new cdk.CfnOutput(this, 's3Path', {
      value: 's3://'+s3Bucket.bucketName,
      description: 'The path of s3',
    });

    // copy web application files into s3 bucket
    new s3Deploy.BucketDeployment(this, "UploadArtifact", {
      sources: [s3Deploy.Source.asset("../src")],
      destinationBucket: s3Bucket,
    });
```


### Subscriber

아래와 같이 Container Component를 생성합니다. 

```java
export class containerSubscriberComponent extends cdk.Stack {
  constructor(scope: Construct, id: string, version: string, props?: cdk.StackProps) {    
    super(scope, id, props);

    const asset = new DockerImageAsset(this, 'BuildImage', {
      directory: path.join(__dirname, '../../src/container-subscriber'),
    })

    const imageUri = asset.imageUri
    new cdk.CfnOutput(this, 'ImageUri', {
      value: imageUri,
      description: 'Image Uri',
    }); 

    // recipe of component
    const receipe = `{
      "RecipeFormatVersion": "2020-01-25",
      "ComponentName": "com.container.subscriber",
      "ComponentVersion": "${version}",
      "ComponentDescription": "A component that runs a docker container from ECR.",
      "ComponentPublisher": "Amazon",
      "ComponentDependencies": {
        "aws.greengrass.DockerApplicationManager": {
          "VersionRequirement": "~2.0.0"
        },
        "aws.greengrass.TokenExchangeService": {
          "VersionRequirement": "~2.0.0"
        }
      },
      "ComponentConfiguration": {
        "DefaultConfiguration": {
          "accessControl": {
            "aws.greengrass.ipc.pubsub": {
              "com.container.subscriber:pubsub:1": {
                "policyDescription": "Allows access to subscribe to all topics.",
                "operations": [
                  "aws.greengrass#SubscribeToTopic"
                ],
                "resources": [
                  "*"
                ]
              }
            }
          }
        }
      },
      "Manifests": [
        {
          "Platform": {
            "os": "all"
          },
          "Lifecycle": {           
            "Run":"docker run --rm -v /greengrass/v2/ipc.socket:/greengrass/v2/ipc.socket -e AWS_CONTAINER_AUTHORIZATION_TOKEN=$AWS_CONTAINER_AUTHORIZATION_TOKEN -e SVCUID=$SVCUID -e AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT=/greengrass/v2/ipc.socket -e AWS_CONTAINER_CREDENTIALS_FULL_URI=$AWS_CONTAINER_CREDENTIALS_FULL_URI ${imageUri} --network=host"
          },
          "Artifacts": [
            {
              "URI": "docker:${imageUri}"
            }
          ]
        }
      ]
    }`

    const cfnComponentVersion = new greengrassv2.CfnComponentVersion(this, 'MyCfnComponentVersion_ContainerSubscriber', {
      inlineRecipe: receipe,
    }); 
  }
}
```


## Local Component

아래와 같이 Publisher 역할을 하는 Component를 생성합니다. 

```java
export class localPublisherComponent extends cdk.Stack {
  constructor(scope: Construct, id: string, version: string, bucketName: string, props?: cdk.StackProps) {    
    super(scope, id, props);

    // recipe of component 
    const recipe = `{
      "RecipeFormatVersion": "2020-01-25",
      "ComponentName": "com.component.publisher",
      "ComponentVersion": "${version}",
      "ComponentDescription": "A component that consume the API.",
      "ComponentPublisher": "Amazon",
      "ComponentConfiguration": {
        "DefaultConfiguration": {
          "accessControl": {
            "aws.greengrass.ipc.pubsub": {
              "com.component.publisher:pubsub:1": {
                "policyDescription": "Allows access to publish to all topics.",
                "operations": [
                  "aws.greengrass#PublishToTopic"
                ],
                "resources": [
                  "*"
                ]
              }
            }
          }
        }
      },
      "Manifests": [{
        "Platform": {
          "os": "linux"
        },
        "Lifecycle": {
          "Install": "pip3 install awsiotsdk pandas",
          "Run": "python3 -u {artifacts:path}/publisher.py"
        },
        "Artifacts": [
          {
            "URI": "${'s3://'+bucketName}/component-publisher/artifacts/com.component.publisher/1.0.0/publisher.py"
          },
          {
            "URI": "${'s3://'+bucketName}/component-publisher/artifacts/com.component.publisher/1.0.0/samples.json"
          }
        ]
      }]
    }`

    // recipe of component - com.component.publisher
    new greengrassv2.CfnComponentVersion(this, 'MyCfnComponentVersion-ComponentPublisher', {
      inlineRecipe: recipe,
    });        
  }
}
```

## Component 배포 설정

아래와 같이 Publisher인 Component와 Subscriber인 Container component를 배포합니다. 

```java
export class componentDeployment extends cdk.Stack {
  constructor(scope: Construct, id: string, version_component_publisher: string, version_component_subscriber: string, version_container_publisher: string, version_container_subscriber: string, accountId: string, deviceName: string, props?: cdk.StackProps) {    
    super(scope, id, props);

    // deployments
    const cfnDeployment = new greengrassv2.CfnDeployment(this, 'MyCfnDeployment', {
      targetArn: `arn:aws:iot:ap-northeast-2:`+accountId+`:thing/`+deviceName,    
      components: {
        "com.component.publisher": {
          componentVersion: version_component_publisher, 
        }, 
        "com.container.subscriber": {
          componentVersion: version_container_subscriber, 
        },  
        "aws.greengrass.Cli": {
          componentVersion: "2.9.0", 
        },
      },
      deploymentName: 'component-deployment',
      deploymentPolicies: {
        componentUpdatePolicy: {
          action: 'NOTIFY_COMPONENTS', // NOTIFY_COMPONENTS | SKIP_NOTIFY_COMPONENTS
          timeoutInSeconds: 60,
        },
        failureHandlingPolicy: 'ROLLBACK',  // ROLLBACK | DO_NOTHING
      },
    });   
  }
}
```

## CDK Deployment

CDK V2와 Path library를 설치합니다. 

```java
npm install aws-cdk-lib path
```

deploy를 수행합니다.

```java
cdk deploy --all
```

삭제시는 아래처럼 수행합니다.

```java
cdk destroy --all
```

상기 명령어로 S3등 cloud 자원만 삭제됩니다. client의 component 삭제는 재배포를 통해 수행하여야 합니다. 
