import json
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import pandas as pd

ROOT = Path(os.environ.get('COMPASS_DATA_DIR', Path(__file__).resolve().parents[1] / 'data'))
ROOT.mkdir(parents=True, exist_ok=True)
LOCK = threading.RLock()

def now():
    return datetime.now(timezone.utc).isoformat()

def uid():
    return uuid4().hex[:16]

def safe_id(value):
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}', value):
        raise ValueError('无效编号')
    return value

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.' + uid() + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2), encoding='utf-8')
    tmp.replace(path)

def read_json(path, default=None):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default

def save_dataset(tables, name, source='upload', original=None):
    with LOCK:
        identifier=uid(); folder=ROOT/'datasets'/identifier; folder.mkdir(parents=True)
        for key, df in tables.items():
            df.to_parquet(folder/f'{key}.parquet', index=False)
        if original:
            (folder/'original.xlsx').write_bytes(original)
        meta={'id':identifier,'name':name,'source':source,'created_at':now(),'tables':{k:len(v) for k,v in tables.items()}}
        write_json(folder/'meta.json',meta)
        write_json(ROOT/'active.json', {'id':identifier})
        return meta

def active_id():
    return read_json(ROOT/'active.json',{}).get('id')

def load_dataset(identifier=None):
    identifier=identifier or active_id()
    if not identifier:
        raise FileNotFoundError('请先导入数据或载入演示数据')
    folder=ROOT/'datasets'/safe_id(identifier)
    if not (folder/'meta.json').exists():
        raise FileNotFoundError('数据版本不存在')
    return {p.stem:pd.read_parquet(p) for p in folder.glob('*.parquet')}, read_json(folder/'meta.json')
