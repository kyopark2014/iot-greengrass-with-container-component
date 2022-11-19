# CDK를 이용해 Greengrass에서 Container Component 배포하기 

Docker를 사용하면 다양한 디바이스의 환경과 관계없이 동일한 환경에서 어플리케이션을 실행 및 배포할 수 있어서 편리합니다. 여기서는 Docker image를 이용해 [Greengrass](https://github.com/kyopark2014/iot-greengrass)에 Container Component를 등록하고, 다른 Component과 [IPC 방식](https://github.com/kyopark2014/iot-greengrass/blob/main/IPC.md)로 통신하는 방법에 대해 설명합니다. 

아래와 같이 Docker Container Component 활용하는 시나리오에 대해 설명합니다. Docker Container Component는 Amazon ECR에 저장된 Docker 이미지를 다운로드하여 생성됩니다. 여기서는 Publisher 역할을 하는 Component가 Container Component로 IPC 통신방식으로 메시지를 Publish하면 Container 안에 있는 이미 학습된 모델을 이용하여 추론을 수행한다고 가정하였습니다. Publisher와 Subscriber Component가 사용하는 Receipe와 Artifact는 AWS CDK를 통해 필드되어 S3 또는 ECR에 저장되고, AWS IoT Device Management를 이용하여 Device에 배포 됩니다. 

<img src="https://user-images.githubusercontent.com/52392004/202844915-eb30b976-491d-4897-b2de-84d3d44f195a.png" width="600">



## Preparation

### Greengrass

[Greengrass Preparation](https://github.com/kyopark2014/iot-greengrass/blob/main/greengrass-commands.md#greengrass-preparation)에 따라, Greengrass installer를 다운로드하고, Core 디바이스로 등록합니다.

### Docker Container 

[Docker Container 준비](https://github.com/kyopark2014/iot-greengrass/blob/main/docker-component.md#docker-container-preparation)에 따라, Greengrass에서 Docker container component를 사용하기 위하여 반드시 필요한 사용자 퍼미션을 설정합니다. 

### Cloud9

Cloud9에서는 [EBS 크기 변경](https://github.com/kyopark2014/technical-summary/blob/main/resize.md)에 따라 EBS 크기를 확대합니다. 


## Recipe에서 Docker 실행 명령어 설정하기

Recipe의 Lifecycle에서는 아래와 같이 Docker argument를 설정할 수 있습니다. Container Component가 다른 Component와 통신을 하기 위해서 아래와 같은 argument들을 적절히 설정하여야 합니다. 

- --network=host: 컨테이너가 stream manager compnent에 연결할 수 있도록 [host network에 local TLS](https://docs.docker.com/engine/reference/run/#network-host)로 access합니다. 이것은 linux용 Docker에서만 사용할 수 있습니다. 
- -v AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT: 컨테이너가 IPC Socket을 mount할 수 있도록 IPC socket file path를 환경변수로 제공합니다. 예) -v $AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT:$AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT
- -e SVCUID: Component가 IPC socket에 연결하기 위해 필요한 secret token으로 Necleus와 연결할때 필요한 환경변수입니다. 예) GGE0A0HZ0DLDQVEQ
- -e AWS_CONTAINER_AUTHORIZATION_TOKEN: Necleus게 제공하는 환경변수로 AWS Credential을 얻어올때 필요합니다. 예) GGE0A0HZ0DLDQVEQ
- -e AWS_CONTAINER_CREDENTIALS_FULL_URI: Necleus게 제공하는 환경변수로 AWS Credential을 얻어올때 필요합니다. 예) http://localhost:35607/2016-11-01/credentialprovider/
- -v: 컨테이너에서 component의 [work folder](https://docs.aws.amazon.com/greengrass/v2/developerguide/component-recipe-reference.html#component-recipe-work-path)를 mount 합니다. 예) -v {work:path}:{work:path} 
- --rm: 컨테이너를 정리(clean up)합니다. 예) --rm publish-to-iot-core



## CDK를 이용한 Container component의 배포

[CDK로 Container Component 배포하기 ](https://github.com/kyopark2014/iot-greengrass-with-container-component/tree/main/cdk-iot-container)를 참조하여 아래와 같이 component를 선언하고 deployment를 구현합니다. 


### Docker 이미지 준비 

AWS CDK를 활용하면 Docker 이미지를 빌드하고 ECR에 업로드하여 배포하는 복잡한 과정을, 손쉽게 진행할 수 있어서 개발 및 운영이 편리해집니다. 아래와 같이 [Dockerfile](https://github.com/kyopark2014/iot-greengrass-with-container-component/blob/main/src/container-subscriber/Dockerfile)과 소스들로 Docker가 필요한 이미지를 빌드합니다. 빌드된 이미지는 ECR로 업로드 됩니다. 

```java
const asset = new DockerImageAsset(this, 'BuildImage', {
    directory: path.join(__dirname, '../../src/container-publisher'),
})

const imageUri = asset.imageUri
new cdk.CfnOutput(this, 'PublisherImageUri', {
  value: imageUri,
  description: 'Publisher Image Uri',
});
```

### Docker Container Component 실행 

Component의 recipe에는 아래와 같이 Docker run 명령어를 설정합니다.  

```java
"Run":"docker run --rm -v /greengrass/v2/ipc.socket:/greengrass/v2/ipc.socket 
  -e AWS_CONTAINER_AUTHORIZATION_TOKEN=$AWS_CONTAINER_AUTHORIZATION_TOKEN 
  -e SVCUID=$SVCUID 
  -e AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT=/greengrass/v2/ipc.socket 
  -e AWS_CONTAINER_CREDENTIALS_FULL_URI=$AWS_CONTAINER_CREDENTIALS_FULL_URI 
  ${imageUri} --network=host"
```

## Publisher/Subscriber

여기서는 Publisher는 [Wine Quality (Regression)](https://github.com/kyopark2014/ML-xgboost/tree/main/wine-quality)에서 학습한 머신러닝 모델을 활용하여 추론(Inference)을 Subscriber에게 요청하는 시나리오를 가정하고 있습니다.

### Publisher

Wine Quality를 측정하기 위해 필요한 데이터는 [samples.json](https://github.com/kyopark2014/ML-xgboost/blob/main/wine-quality/src/samples.json)에 있다고 가정합니다. 실제로는 센서등을 통해 수집된 데이터로 가정할 수 있습니다. 이때의 데이터 형태는 아래와 같습니다. 하나 또는 여러개의 Json 데이터입니다. 

```java
{"body": "[{\"fixed acidity\":6.6,\"volatile acidity\":0.24,\"citric acid\":0.28,\"residual sugar\":1.8,\"chlorides\":0.028,\"free sulfur dioxide\":39,\"total sulfur dioxide\":132,\"density\":0.99182,\"pH\":3.34,\"sulphates\":0.46,\"alcohol\":11.4,\"color_red\":0,\"color_white\":1},{\"fixed acidity\":8.7,\"volatile acidity\":0.78,\"citric acid\":0.51,\"residual sugar\":1.7,\"chlorides\":0.415,\"free sulfur dioxide\":12,\"total sulfur dioxide\":66,\"density\":0.99623,\"pH\":3.0,\"sulphates\":1.17,\"alcohol\":9.2,\"color_red\":1,\"color_white\":0}]", "isBase64Encoded": false}
```

Publisher는 [samples.json](https://github.com/kyopark2014/ML-xgboost/blob/main/wine-quality/src/samples.json)의 데이터를 일정시간마다 PUBSUB 형태로 
[IPC 통신](https://github.com/kyopark2014/iot-greengrass/blob/main/IPC.md)를 통해 Subscriber로 전송합니다. 


### Subscriber

PUBSUB으로 수신된 데이터에 대해, [XGBoost 알고리즘](https://github.com/kyopark2014/ML-Algorithms/blob/main/xgboost.md)으로 [Wine Data](https://archive.ics.uci.edu/ml/datasets/wine+quality)를 학습하여 만든 [xgboost_wine_quality.json](https://github.com/kyopark2014/ML-xgboost/blob/main/wine-quality/src/xgboost_wine_quality.json) 모델을 이용하여, [추론(Inference)를 수행](https://github.com/kyopark2014/ML-xgboost/tree/main/wine-quality#inference)합니다. 

[subscriber.py](https://github.com/kyopark2014/iot-greengrass-with-container-component/blob/main/src/container-subscriber/subscriber.py)와 같이, 추론에 필요한 데이터는 아래와 같이 Decoding한 후에 [inference.py](https://github.com/kyopark2014/iot-greengrass-with-container-component/blob/main/src/container-subscriber/inference.py)의 handler()를 호출하여 추론을 수행합니다.  

```java
from inference import handler  

def on_stream_event(event: SubscriptionResponseMessage) -> None:
    message = str(event.binary_message.message, 'utf-8')
    topic = event.binary_message.context.topic

    # Inference
    json_data = json.loads(message) # json decoding        
    results = handler(json_data,"")  
```

추론의 결과는 아래와 같이 로그로 확인합니다.

```java
2022-11-19T08:37:17.452Z [INFO] (Copier) com.container.subscriber: stdout. result: [6.573914 4.869721]. {scriptName=services.com.container.subscriber.lifecycle.Run, serviceName=com.container.subscriber, currentState=RUNNING}
2022-11-19T08:37:17.452Z [INFO] (Copier) com.container.subscriber: stdout. DEBUG:__main__:result: [6.573914051055908, 4.869720935821533]. {scriptName=services.com.container.subscriber.lifecycle.Run, serviceName=com.container.subscriber, currentState=RUNNING}
```

[inference.py](https://github.com/kyopark2014/iot-greengrass-with-container-component/blob/main/src/container-subscriber/inference.py)에서는 아래와 같이 JSON형태로 전달되는 event에서 body를 추출하여 predict()를 이용하여 추론을 수행합니다. 

```java
def handler(event, context):
    body = event['body']
    isBase64Encoded = event['isBase64Encoded']

    if isBase64Encoded: 
        body_bytes = base64.b64decode(body)
        body_dec = body_bytes.decode('ascii')        

        values = pd.read_json(body_dec)        
    else:
        values = pd.read_json(body)        
        
    # inference
    results = model.predict(values)
```


## Greengrass Commands와 Memo

유용한 [Greengrass 명령어와 중요한 메모들](https://github.com/kyopark2014/iot-greengrass/blob/main/greengrass-commands.md)를 정리하였습니다.


## 참조: Recipe에서 environment variable 사용

"docker run"에서 "MSG_COUNT_LIMIT={configuration:/MSG_COUNT_LIMIT}"와 같이 값을 입력후 아래처럼 사용합니다. 

```java
msg_count_limit = os.environ.get("MSG_COUNT_LIMIT", "2000")
```

## Reference

[AWS IoT Greengrass V2](https://docs.aws.amazon.com/greengrass/v2/developerguide/what-is-iot-greengrass.html)

[Run a Docker container](https://docs.aws.amazon.com/greengrass/v2/developerguide/run-docker-container.html)

[Authorize core devices to interact with AWS services](https://docs.aws.amazon.com/greengrass/v2/developerguide/device-service-role.html)

[Component environment variable reference](https://docs.aws.amazon.com/greengrass/v2/developerguide/component-environment-variables.html)

[AWS_IO_CONNECTION_REFUSED - Greengrass v2 IPC](https://repost.aws/questions/QUtC1ZkV4OShak0dUmmLV6KA/aws-io-connection-refused-greengrass-v-2-ipc)
