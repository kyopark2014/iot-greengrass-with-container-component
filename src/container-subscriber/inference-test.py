import numpy as np
import pandas as pd
import time
from xgboost import XGBRegressor
from inference import handler  

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
    # Version check
    print('np version: ', np.__version__)
    print('pandas version: ', pd.__version__)

    import xgboost as xgb
    print('xgb version: ', xgb.__version__)

    start = time.time()

    # load samples
    event = load_event()

    # Inference
    results = handler(event,"")  
    
    # results
    print(results['statusCode'])
    print(results['body'])

    print('Elapsed time: %0.2fs' % (time.time()-start))   

if __name__ == '__main__':
    main()
