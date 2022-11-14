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

CDK V2가 설치되지 않은 경우에 아래와 같이 aws-cdk-lib를 설치합니다.

```java
npm install -g aws-cdk-lib
```


## CDK Code 작성하기
