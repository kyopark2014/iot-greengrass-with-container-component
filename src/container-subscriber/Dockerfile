# lambda base image (python)
FROM amazon/aws-lambda-python:3.8

RUN /var/lang/bin/python3.8 -m pip install --upgrade pip
RUN /var/lang/bin/python3.8 -m pip install joblib
RUN /var/lang/bin/python3.8 -m pip install scikit-learn
RUN /var/lang/bin/python3.8 -m pip install awsiotsdk pandas

WORKDIR /var/task/subscriber

COPY inference.py /var/task/
COPY main.py /var/task/

COPY . .

RUN pip install -r requirements.txt

#CMD ["main.main"]
CMD ["python3","-u", "/var/task/subscriber/main.py"]