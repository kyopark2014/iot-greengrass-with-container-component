# CDK를 이용해 Greengrass에서 Container Conmponent 배포하기 

Docker를 사용하면 배포의 편의 뿐 아니라 동일한 환경에서 어플리케이션을 실행할 수 있습니다. 여기서는 Docker image를 이용해 Greengrass에 Component를 등록하고 다른 Component와 IPC로 통신하는 방법에 대해 설명합니다. 

## Docker Container Preparation

Greengrass에서 Docker Container를 이용하기 위해서는 아래와 같은 설정이 필요합니다. 

Greengrass 디바이스에 접속하여 아래와 같이 사용자를 doker user group에 추가하여야 합니다. 

```java
sudo usermod -aG docker ggc_user
```

ECR을 사용하기 위해서는 [device role](https://docs.aws.amazon.com/greengrass/v2/developerguide/device-service-role.html)을 참조하여, [IAM Console](https://us-east-1.console.aws.amazon.com/iamv2/home?region=ap-northeast-2#/roles/details/GreengrassV2TokenExchangeRole?section=permissions)에서 GreengrassV2TokenExchangeRole에 아래의 permission을 추가합니다. 

```java
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer"
      ],
      "Resource": [
        "*"
      ],
      "Effect": "Allow"
    }
  ]
}
```

### Recipe

lifecycle에서 아래와 같은 argument를 설정할 수 있습니다. 

- --network=host: container가 stream manager compnent에 연결할 수 있도록 [host network에 local TLS](https://docs.docker.com/engine/reference/run/#network-host)로 access합니다. 이것은 linux용 Docker에서만 사용할 수 있습니다. 
- -e AWS_CONTAINER_AUTHORIZATION_TOKEN: 환경변수 
- -v: 컨테이너에서 component의 [work folder](https://docs.aws.amazon.com/greengrass/v2/developerguide/component-recipe-reference.html#component-recipe-work-path)를 mount 합니다. 예) -v {work:path}:{work:path} 
- --rm: 컨테이너를 정리(clean up)합니다. 예) --rm stream-file-to-s3


### Greengrass Commands와 Memo

유용한 [Greengrass 명령어와 중요한 메모들](https://github.com/kyopark2014/iot-greengrass/blob/main/greengrass-commands.md)를 정리하였습니다.

## Reference

[AWS IoT Greengrass V2](https://docs.aws.amazon.com/greengrass/v2/developerguide/what-is-iot-greengrass.html)

[Run a Docker container](https://docs.aws.amazon.com/greengrass/v2/developerguide/run-docker-container.html)

[Authorize core devices to interact with AWS services](https://docs.aws.amazon.com/greengrass/v2/developerguide/device-service-role.html)
