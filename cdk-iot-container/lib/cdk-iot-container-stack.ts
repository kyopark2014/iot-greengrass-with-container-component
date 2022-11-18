import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from "path";
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import * as greengrassv2 from 'aws-cdk-lib/aws-greengrassv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deploy from "aws-cdk-lib/aws-s3-deployment"

export class CdkIotContainerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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

    // create container component - com.example.container
    const version_container = "1.1.2"
    new containerComponent(scope, "container-component", version_container)   

    // create local component
    const version_consumer = "1.0.0"
    new localComponent(scope, "local-component", version_consumer, s3Bucket.bucketName)   

    // deploy components 
    //new componentDeployment(scope, "deployments", version_consumer, version_container, accountId, deviceName)   
  }
}

export class containerComponent extends cdk.Stack {
  constructor(scope: Construct, id: string, version: string, props?: cdk.StackProps) {    
    super(scope, id, props);

    const asset = new DockerImageAsset(this, 'BuildImage', {
      directory: path.join(__dirname, '../../src/container'),
    })

    const imageUri = asset.imageUri
    new cdk.CfnOutput(this, 'ImageUri', {
      value: imageUri,
      description: 'Image Uri',
    }); 

    // recipe of component - com.example.container
    const recipe = `{
      "RecipeFormatVersion": "2020-01-25",
      "ComponentName": "com.example.container",
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
              "com.example.container:pubsub:1": {
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
            "Run":"docker run --rm -v /greengrass/v2:/greengrass/v2 -v /home/ubuntu/environment/subscriberdocker/logfiles:/tmp -e AWS_REGION -e SVCUID -e MSG_COUNT_LIMIT={configuration:/MSG_COUNT_LIMIT} -e AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT -e AWS_CONTAINER_AUTHORIZATION_TOKEN -e AWS_CONTAINER_CREDENTIALS_FULL_URI ${imageUri}"
          },
          "Artifacts": [
            {
              "URI": "docker:${imageUri}"
            }
          ]
        }
      ]
    }`

    const cfnComponentVersion = new greengrassv2.CfnComponentVersion(this, 'MyCfnComponentVersion_Container', {
      inlineRecipe: recipe,
    }); 
  }
}

/*
"Lifecycle": {
  "Run": "docker run ${imageUri} -v \$AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT:\$AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT -e SVCUID -e AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT"
}
"Lifecycle": {
  "Run": "docker run ${imageUri} -v $AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT:$AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT -e SVCUID -e AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT"
}

"Run":"docker run ${imageUri} -v /greengrass/v2:/greengrass/v2 -e AWS_REGION -e SVCUID -e AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT -e AWS_CONTAINER_AUTHORIZATION_TOKEN"		

"Run": "docker run -v $AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT:$AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT -e SVCUID -e AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT -e MQTT_TOPIC=\"{configuration:/topic}\" -e MQTT_MESSAGE=\"{configuration:/message}\" -e MQTT_QOS=\"{configuration:/qos}\" --rm publish-to-iot-core"

            "Run":"docker run ${imageUri} -v $AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT:$AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT -e SVCUID -e AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT -e AWS_CONTAINER_AUTHORIZATION_TOKEN -e AWS_CONTAINER_CREDENTIALS_FULL_URI"		
      },
*/

export class localComponent extends cdk.Stack {
  constructor(scope: Construct, id: string, version: string, bucketName: string, props?: cdk.StackProps) {    
    super(scope, id, props);

    // recipe of component - com.example.consumer
    const recipe_consumer = `{
      "RecipeFormatVersion": "2020-01-25",
      "ComponentName": "com.example.consumer",
      "ComponentVersion": "${version}",
      "ComponentDescription": "A component that consume the API.",
      "ComponentPublisher": "Amazon",
      "ComponentConfiguration": {
        "DefaultConfiguration": {
          "accessControl": {
            "aws.greengrass.ipc.pubsub": {
              "com.example.consumer:pubsub:1": {
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
          "Run": "python3 -u {artifacts:path}/consumer.py"
        },
        "Artifacts": [
          {
            "URI": "${'s3://'+bucketName}/consumer/artifacts/com.example.consumer/1.0.0/consumer.py"
          },
          {
            "URI": "${'s3://'+bucketName}/consumer/artifacts/com.example.consumer/1.0.0/samples.json"
          }
        ]
      }]
    }`

    // recipe of component - com.example.consumer
    new greengrassv2.CfnComponentVersion(this, 'MyCfnComponentVersion-Consumer', {
      inlineRecipe: recipe_consumer,
    });        
  }
}

export class componentDeployment extends cdk.Stack {
  constructor(scope: Construct, id: string, version_consumer: string, version_container: string, accountId: string, deviceName: string, props?: cdk.StackProps) {    
    super(scope, id, props);

    // deployments
    const cfnDeployment = new greengrassv2.CfnDeployment(this, 'MyCfnDeployment', {
      targetArn: `arn:aws:iot:ap-northeast-2:`+accountId+`:thing/`+deviceName,    
      components: {
      /*  "com.example.consumer": {
          componentVersion: version_consumer, 
        }, */
        "com.example.container": {
          componentVersion: version_container, 
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
