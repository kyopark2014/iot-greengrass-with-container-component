# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import time
import json
import sys
import os
import signal
import awsiot.greengrasscoreipc
import awsiot.greengrasscoreipc.client as client
from awsiot.greengrasscoreipc.model import (
    SubscribeToTopicRequest,
    SubscriptionResponseMessage
)

from threading import Event
e = Event()

#kill process 
def sighandler(a,b):
    sys.exit(0)
    
signal.signal(signal.SIGINT | signal.SIGTERM, sighandler)

TIMEOUT = 10
ipc_client = awsiot.greengrasscoreipc.connect()
msg_count = 0
class StreamHandler(client.SubscribeToTopicStreamHandler):
    def __init__(self):
        super().__init__()

    def on_stream_event(self, event: SubscriptionResponseMessage) -> None:
        global msg_count
        message_string = event.json_message.message
        print(f"{msg_count}: {message_string}")
        with open('/tmp/Greengrass_Subscriber.log', 'a') as f:
            print(message_string, file=f)
        msg_count = msg_count + 1
        if msg_count > int(os.environ.get("MSG_COUNT_LIMIT", "2000")):
            e.set()

    def on_stream_error(self, error: Exception) -> bool:
        return True

    def on_stream_closed(self) -> None:
        pass

topic = "my/topic"

request = SubscribeToTopicRequest()
request.topic = topic
handler = StreamHandler()
operation = ipc_client.new_subscribe_to_topic(handler)
print(f"subscribed to topic {topic}")
future = operation.activate(request)
future.result()

e.wait()

print(f"We are done. Got {msg_count} messages")
operation.close()
