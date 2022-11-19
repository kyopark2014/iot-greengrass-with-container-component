FROM amazon/aws-lambda-python:3.8

RUN /var/lang/bin/python3.8 -m pip install --upgrade pip
RUN /var/lang/bin/python3.8 -m pip install joblib
RUN /var/lang/bin/python3.8 -m pip install scikit-learn
RUN /var/lang/bin/python3.8 -m pip install awsiotsdk pandas

WORKDIR /var/task/subscriber

COPY . .

RUN pip install -r requirements.txt

ENTRYPOINT ["python3", "/var/task/subscriber/subscriber.py"]