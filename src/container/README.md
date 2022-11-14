# Source 구성 

- Dockerfile: Docker 생성을 위한 설정 파일입니다.

- inference.py: inference 동작을 위한 python 소스 파일로 hander()를 통해 동작을 수행합니다. 

- inference-test.py: inference 동작을 확인할 수 있습니다. 예) python3 inference-test.py

- requirements.txt: inference 동작을 필요한 library와 버전을 지정합니다.

- xgboost_wine_quality.json: 학습(Training)을 통해 생성된 모델입니다.

- samples.json: inference-test.py에서 테스트 할때 사용하는 sample 정보를 가지고 있습니다. 
