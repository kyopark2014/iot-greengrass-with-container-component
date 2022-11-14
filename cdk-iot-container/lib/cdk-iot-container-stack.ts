import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from "path";
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import * as greengrassv2 from 'aws-cdk-lib/aws-greengrassv2';

export class CdkIotContainerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const deviceName = 'GreengrassCore-18163f7ac3e'
    const accountId = cdk.Stack.of(this).account

    const asset = new DockerImageAsset(this, 'BuildImage', {
      directory: path.join(__dirname, '../../src/container'),
    })

    const imageUri = asset.imageUri
    new cdk.CfnOutput(this, 'ImageUri', {
      value: imageUri,
      description: 'Image Uri',
    }); 

    // recipe of component - com.example.container
    const version = "1.0.0"
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
            "Run": "docker run ${imageUri} -v \$AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT:\$AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT -e SVCUID -e AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT"
          },
          "Artifacts": [
            {
              "URI": "docker:${imageUri}"
            }
          ]
        }
      ]
    }`

    const cfnComponentVersion = new greengrassv2.CfnComponentVersion(this, 'MyCfnComponentVersion', {
      inlineRecipe: recipe,
    }); 

    // deployments
    const cfnDeployment = new greengrassv2.CfnDeployment(this, 'MyCfnDeployment', {
      targetArn: `arn:aws:iot:ap-northeast-2:`+accountId+`:thing/`+deviceName,    
      components: {
        "com.example.container": {
          componentVersion: version, 
        },
        "aws.greengrass.Cli": {
          componentVersion: "2.8.1", 
        }
      },
      deploymentName: 'ml-deployment',
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
