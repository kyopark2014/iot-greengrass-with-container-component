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
    const bucketName = "gg-depolyment-storage"

    // s3 deployment
    const s3deploy = new s3Deployment(scope, "s3-deployment", bucketName)     

    // component publisher
    const version_component_publisher = "1.0.0"
    const component_publisher = new localPublisherComponent(scope, "component-publisher", version_component_publisher, bucketName)   
    component_publisher.addDependency(s3deploy);

    // component subscriber 
    const version_component_subscriber = "1.0.0"
    const component_subscriber = new localSubscriberComponent(scope, "component-subscriber", version_component_subscriber, bucketName)   
    component_subscriber.addDependency(component_publisher);

    // container publisher
    const version_container_publisher = "1.0.0"
    const container_publisher = new containerPublisherComponent(scope, "container-publisher", version_container_publisher)   
    container_publisher.addDependency(component_subscriber);  

    // container subscriber
    const version_container_subscriber = "1.0.0"
    const container_subscriber = new containerSubscriberComponent(scope, "container-subscriber", version_container_subscriber)   
    container_subscriber.addDependency(container_publisher);
    
    // deploy components 
    const deployment = new componentDeployment(scope, "deployments", version_component_publisher, version_component_subscriber, version_container_publisher, version_container_subscriber, accountId, deviceName)   
    deployment.addDependency(container_subscriber);
  }
}

export class s3Deployment extends cdk.Stack {
  constructor(scope: Construct, id: string, bucketName: string, props?: cdk.StackProps) {    
    super(scope, id, props);

    // S3 for artifact storage
    const s3Bucket = new s3.Bucket(this, "gg-depolyment-storage",{
      bucketName: bucketName,
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
  }
}

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

export class containerPublisherComponent extends cdk.Stack {
  constructor(scope: Construct, id: string, version: string, props?: cdk.StackProps) {    
    super(scope, id, props);

    const asset = new DockerImageAsset(this, 'BuildImage', {
      directory: path.join(__dirname, '../../src/container-publisher'),
    })

    const imageUri = asset.imageUri
    new cdk.CfnOutput(this, 'PublisherImageUri', {
      value: imageUri,
      description: 'Publisher Image Uri',
    }); 

    // recipe of component 
    const recipe = `{
      "RecipeFormatVersion": "2020-01-25",
      "ComponentName": "com.container.publisher",
      "ComponentVersion": "${version}",
      "ComponentDescription": "A component that runs a docker publisher from ECR.",
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
              "com.container.publisher:pubsub:1": {
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

    const cfnComponentVersion = new greengrassv2.CfnComponentVersion(this, 'MyCfnComponentVersion_ContainerPublisher', {
      inlineRecipe: recipe,
    }); 
  }
}


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

export class localSubscriberComponent extends cdk.Stack {
  constructor(scope: Construct, id: string, version: string, bucketName: string, props?: cdk.StackProps) {    
    super(scope, id, props);

    // recipe of component 
    const recipe = `{
      "RecipeFormatVersion": "2020-01-25",
      "ComponentName": "com.component.subscriber",
      "ComponentVersion": "${version}",
      "ComponentDescription": "A component that subcribes the API.",
      "ComponentPublisher": "Amazon",
      "ComponentConfiguration": {
        "DefaultConfiguration": {
          "accessControl": {
            "aws.greengrass.ipc.pubsub": {
              "com.component.subscriber:pubsub:1": {
                "policyDescription": "Allows access to subscriber to all topics.",
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
      "Manifests": [{
        "Platform": {
          "os": "linux"
        },
        "Lifecycle": {
          "Install": "pip3 install awsiotsdk",
          "Run": "python3 -u {artifacts:path}/subscriber.py"
        },
        "Artifacts": [
          {
            "URI": "${'s3://'+bucketName}/component-subscriber/artifacts/com.component.subscriber/1.0.0/subscriber.py"
          }
        ]
      }]
    }`

    // recipe of component 
    new greengrassv2.CfnComponentVersion(this, 'MyCfnComponentVersion-ComponentSubscriber', {
      inlineRecipe: recipe,
    });        
  }
}

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
      /*  "com.component.subscriber": {
          componentVersion: version_component_subscriber, 
        }, 
        "com.container.publisher": {
          componentVersion: version_container_publisher, 
        }, */ 
        "com.container.subscriber": {
          componentVersion: version_container_subscriber, 
        },  
        "aws.greengrass.Cli": {
          componentVersion: "2.9.1", 
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
