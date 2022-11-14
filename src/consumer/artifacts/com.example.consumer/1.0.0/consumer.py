import sys
import traceback
import time
import json
import pandas as pd
from awsiot.greengrasscoreipc.clientv2 import GreengrassCoreIPCClientV2
from awsiot.greengrasscoreipc.model import (
    PublishMessage,
    BinaryMessage
)

def load_event():
    json_file = pd.read_json('samples.json')

    json_data = json_file.to_json(orient='records')

    event = {
        'body': json_data,
        'isBase64Encoded': False
    }
    print('event: ', event)

    return event

def main():
    topic = 'local/topic'

    # load samples
    message = load_event()

    try:
        ipc_client = GreengrassCoreIPCClientV2()

        try:
            while True: 
                # binary
                # publish_binary_message_to_topic(ipc_client, topic, message)
                
                # json
                publish_binary_message_to_topic(ipc_client, topic,  json.dumps(message))

                print('message:', json.dumps(message))
                
                time.sleep(5)
        except InterruptedError:
            print('Publisher interrupted.')                

    except Exception:
        print('Exception occurred', file=sys.stderr)
        traceback.print_exc()
        exit(1)

def publish_binary_message_to_topic(ipc_client, topic, message):
    binary_message = BinaryMessage(message=bytes(message, 'utf-8'))
    publish_message = PublishMessage(binary_message=binary_message)
    ipc_client.publish_to_topic(topic=topic, publish_message=publish_message)

if __name__ == '__main__':
    main()        