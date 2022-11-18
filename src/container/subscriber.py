import sys
import time
import traceback

from awsiot.greengrasscoreipc.clientv2 import GreengrassCoreIPCClientV2
from awsiot.greengrasscoreipc.model import (
    SubscriptionResponseMessage,
    UnauthorizedError
)

def main():
    topic = 'local/topic'
    print('topic: ' + topic)

    cnt = 1
    while True:
        print('cnt: ', cnt)
        time.sleep(10)

if __name__ == '__main__':
    main()
