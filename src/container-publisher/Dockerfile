# lambda base image (python)
FROM amazon/aws-lambda-python:3.8

RUN /var/lang/bin/python3.8 -m pip install --upgrade pip
RUN /var/lang/bin/python3.8 -m pip install awsiotsdk pandas

WORKDIR /var/task/publisher

COPY publisher.py /var/task/

COPY . .

CMD ["publisher.main"]
#CMD ["python3","-u", "/var/task/publisher/publisher.py"]
