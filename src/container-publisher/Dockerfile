FROM amazon/aws-lambda-python:3.8

RUN /var/lang/bin/python3.8 -m pip install --upgrade pip
RUN /var/lang/bin/python3.8 -m pip install awsiotsdk pandas

WORKDIR /var/task/publisher

COPY . .

ENTRYPOINT ["python3", "/var/task/publisher/publisher.py"]