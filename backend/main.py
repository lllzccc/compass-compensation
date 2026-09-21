import io
import json
import html
import zipfile
from pathlib import Path
from typing import Literal
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse, Response, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator
from .schema import SCHEMA, CORE
from . import store
from .validation import validate
from .demo import generate
from .analysis import dashboard, simulate, records
from .providers import MockProvider

app=FastAPI(title='薪衡 Compass API',version='0.1.0')

@app.exception_handler(ValueError)
async def invalid(_,exc): return JSONResponse(status_code=422,content={'detail':str(exc)})

@app.exception_handler(FileNotFoundError)
async def missing(_,exc): return JSONResponse(status_code=404,content={'detail':str(exc)})

class Constraints(BaseModel):
    name: str=Field(default='年度薪酬校准方案',min_length=1,max_length=100)
    organization_id: str=''
    baseline_month: str=Field(default='2026-12',pattern=r'^\d{4}-(0[1-9]|1[0-2])$')
    effective_month: str=Field(default='2027-04',pattern=r'^\d{4}-(0[1-9]|1[0-2])$')
    currency: str=Field(default='CNY',pattern=r'^[A-Z]{3}$')
    budget: float=Field(default=1000000,ge=0,le=1e12,allow_inf_nan=False)
    budget_basis: Literal['annualized','current_year']='annualized'
    strategy: Literal['band','uniform']='band'
    min_raise_pct: float=Field(default=0,ge=0,le=100,allow_inf_nan=False)
    max_raise_pct: float=Field(default=15,ge=0,le=100,allow_inf_nan=False)
    default_raise_pct: float=Field(default=5,ge=0,le=100,allow_inf_nan=False)
    target_cr: float=Field(default=1,ge=.5,le=2,allow_inf_nan=False)
    exclude_recent_months: int=Field(default=3,ge=0,le=120)
    excluded_employee_ids: list[str]=Field(default_factory=list,max_length=10000)
    business_context: str=Field(default='',max_length=4000)
    @model_validator(mode='after')
    def check(self):
        if self.min_raise_pct>self.max_raise_pct: raise ValueError('最低涨幅不能高于最高涨幅')
        if self.effective_month<=self.baseline_month: raise ValueError('调薪生效月份必须晚于基准月份')
        return self

class SaveScenario(BaseModel):
    id: str|None=None
    expected_version: int|None=None
    constraints: Constraints

class RunRequest(BaseModel):
    dataset_id: str
    scenario_id: str
    scenario_version: int

@app.get('/api/status')
def status():
    versions=[]
    for path in (store.ROOT/'datasets').glob('*/meta.json'):
        versions.append(store.read_json(path))
    active=store.active_id()
    result={'role':'薪酬负责人 / 管理员','ai_mode':'mock','versions':sorted(versions,key=lambda v:v['created_at'],reverse=True),'active_id':active,'months':[],'organizations':[],'currencies':[]}
    if active:
        tables,_=store.load_dataset(active)
        result['months']=sorted(tables['payroll_monthly'].month.unique().tolist())
        result['currencies']=sorted(tables['payroll_monthly'].currency.unique().tolist())
        result['organizations']=records(tables['organizations'][['organization_id','organization_name']])
    return result

@app.get('/api/schema')
def schema(): return SCHEMA

@app.post('/api/demo')
def demo():
    tables={k:pd.DataFrame(v) for k,v in generate().items()}
    tables,issues,_=validate(tables)
    if any(i['severity']=='error' for i in issues): raise HTTPException(500,'演示数据校验失败')
    return store.save_dataset(tables,'星屿科技 · 虚拟薪酬数据 2025–2026','demo')

@app.post('/api/datasets/{identifier}/activate')
def activate(identifier:str):
    _,meta=store.load_dataset(identifier)
    with store.LOCK: store.write_json(store.ROOT/'active.json',{'id':meta['id']})
    return meta

@app.get('/api/sample')
def sample():
    path=Path(__file__).resolve().parents[1]/'outputs/demo/compass-demo.xlsx'
    if not path.exists(): raise HTTPException(404,'演示 Excel 尚未生成')
    return FileResponse(path,filename='compass-demo.xlsx')

@app.post('/api/import/preview')
async def preview(file:UploadFile=File(...),mappings:str=Form('{}'),csv_table:str=Form('payroll_monthly')):
    content=await file.read(20*1024*1024+1)
    if len(content)>20*1024*1024: raise HTTPException(413,'单个文件不能超过 20 MB')
    suffix=Path(file.filename or '').suffix.lower()
    try:
        mapping=json.loads(mappings)
        if not isinstance(mapping,dict) or any(not isinstance(v,dict) for v in mapping.values()): raise ValueError('字段映射必须为对象')
        if suffix=='.xlsx':
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if sum(i.file_size for i in archive.infolist())>100*1024*1024: raise ValueError('工作簿解压后超过 100 MB')
            raw=pd.read_excel(io.BytesIO(content),sheet_name=None,dtype=object,engine='openpyxl')
            raw={k:v for k,v in raw.items() if k in SCHEMA}
        elif suffix=='.csv':
            if csv_table not in SCHEMA: raise ValueError('请选择有效的目标表')
            raw,_=store.load_dataset()
            raw[csv_table]=pd.read_csv(io.BytesIO(content),dtype=object,encoding='utf-8-sig')
        else: raise ValueError('支持 .xlsx 和 UTF-8 编码 .csv 文件')
        clean,issues,actions=validate(raw,mapping)
    except (ValueError,KeyError,zipfile.BadZipFile,UnicodeDecodeError) as exc:
        raise HTTPException(422,f'无法读取文件：{exc}')
    identifier=store.uid(); folder=store.ROOT/'imports'/identifier; folder.mkdir(parents=True)
    (folder/f'original{suffix}').write_bytes(content)
    # Invalid records are staged as JSON only; no mixed-type Parquet conversion until valid.
    for k,df in clean.items():
        store.write_json(folder/f'{k}.json',records(df))
    payload={'id':identifier,'name':Path(file.filename or '导入数据').name,'issues':issues,'actions':actions,'error_count':sum(i['severity']=='error' for i in issues),'warning_count':sum(i['severity']=='warning' for i in issues),'tables':{k:{'label':SCHEMA[k]['label'],'rows':len(v),'columns':list(v.columns),'preview':records(v.head(5))} for k,v in clean.items()}}
    store.write_json(folder/'preview.json',payload)
    return payload

@app.post('/api/import/{identifier}/commit')
def commit(identifier:str):
    folder=store.ROOT/'imports'/store.safe_id(identifier)
    payload=store.read_json(folder/'preview.json')
    if not payload: raise HTTPException(404,'导入任务不存在')
    if payload['error_count']: raise HTTPException(422,'请先修复导入错误')
    with store.LOCK:
        previous=store.read_json(folder/'committed.json')
        if previous: return previous
        tables={k:pd.DataFrame(store.read_json(folder/f'{k}.json'),columns=payload['tables'][k]['columns']) for k in payload['tables']}
        tables,issues,_=validate(tables)
        if any(i['severity']=='error' for i in issues): raise HTTPException(422,'数据复检失败')
        meta=store.save_dataset(tables,payload['name'])
        destination=store.ROOT/'datasets'/meta['id']
        for original in folder.glob('original.*'): (destination/original.name).write_bytes(original.read_bytes())
        store.write_json(destination/'quality.json',payload)
        store.write_json(folder/'committed.json',meta)
    return meta

@app.get('/api/quality')
def quality(dataset_id:str|None=None):
    tables,meta=store.load_dataset(dataset_id)
    _,issues,actions=validate(tables)
    return {'issues':issues,'actions':actions,'error_count':sum(i['severity']=='error' for i in issues),'warning_count':sum(i['severity']=='warning' for i in issues),'tables':meta['tables']}

@app.get('/api/tables/{key}')
def table_data(key:str,dataset_id:str|None=None,page:int=Query(1,ge=1),page_size:int=Query(20,ge=1,le=100),search:str=''):
    if key not in SCHEMA: raise HTTPException(404,'未知数据表')
    tables,_=store.load_dataset(dataset_id); df=tables.get(key,pd.DataFrame())
    if search and len(df): df=df[df.astype(str).apply(lambda c:c.str.contains(search,case=False,regex=False)).any(axis=1)]
    return {'total':len(df),'columns':list(df.columns),'rows':records(df.iloc[(page-1)*page_size:page*page_size])}

@app.get('/api/dashboard')
def get_dashboard(year:int=2026,organization_id:str='',currency:str='CNY',dataset_id:str|None=None):
    tables,meta=store.load_dataset(dataset_id)
    return {**dashboard(tables,year,organization_id,currency),'dataset':meta}

@app.get('/api/scenarios')
def scenarios():
    return sorted([store.read_json(p) for p in (store.ROOT/'scenarios').glob('*/latest.json')],key=lambda s:s['updated_at'],reverse=True)

@app.get('/api/scenarios/defaults')
def defaults(): return Constraints().model_dump()

@app.post('/api/scenarios')
def save_scenario(body:SaveScenario):
    with store.LOCK:
        identifier=store.safe_id(body.id) if body.id else store.uid(); folder=store.ROOT/'scenarios'/identifier
        old=store.read_json(folder/'latest.json')
        if body.id and not old: raise HTTPException(404,'方案不存在')
        if old and body.expected_version!=old['version']: raise HTTPException(409,'方案已有新版本，请重新加载后编辑')
        version=old['version']+1 if old else 1
        result={'id':identifier,'version':version,'constraints':body.constraints.model_dump(),'created_by':'管理员','updated_by':'管理员','created_at':old['created_at'] if old else store.now(),'updated_at':store.now()}
        store.write_json(folder/f'v{version}.json',result)
        store.write_json(folder/'latest.json',result)
        return result

@app.post('/api/runs')
def run(body:RunRequest):
    scenario=store.read_json(store.ROOT/'scenarios'/store.safe_id(body.scenario_id)/f'v{body.scenario_version}.json')
    if not scenario: raise HTTPException(404,'方案版本不存在，请先保存方案')
    tables,meta=store.load_dataset(body.dataset_id); c=scenario['constraints']
    result=simulate(tables,c)
    # Evidence must not look ahead beyond the chosen baseline month.
    limited={k:(v[v.month<=c['baseline_month']].copy() if 'month' in v else v.copy()) for k,v in tables.items()}
    evidence=dashboard(limited,int(c['baseline_month'][:4]),c['organization_id'],c['currency'])
    findings=MockProvider().analyze(evidence,c,result)
    identifier=store.uid()
    report={'id':identifier,'created_at':store.now(),'mode':'mock','dataset':meta,'scenario':scenario,'simulation':result,'findings':findings,'evidence':{k:v for k,v in evidence.items() if k!='employees'}}
    store.write_json(store.ROOT/'runs'/f'{identifier}.json',report)
    return report

@app.get('/api/runs')
def runs():
    result=[]
    for path in (store.ROOT/'runs').glob('*.json'):
        r=store.read_json(path)
        result.append({k:r[k] for k in ['id','created_at','mode','dataset','scenario','simulation']} | {'simulation':{k:v for k,v in r['simulation'].items() if k!='employees'}})
    return sorted(result,key=lambda r:r['created_at'],reverse=True)

def read_run(identifier):
    result=store.read_json(store.ROOT/'runs'/f'{store.safe_id(identifier)}.json')
    if not result: raise HTTPException(404,'报告不存在')
    return result

@app.get('/api/runs/{identifier}')
def get_run(identifier:str): return read_run(identifier)

@app.get('/api/runs/{identifier}/csv')
def csv_export(identifier:str):
    result=read_run(identifier); df=pd.DataFrame(result['simulation']['employees'])
    for col in df:
        if df[col].dtype=='object' or pd.api.types.is_string_dtype(df[col]):
            df[col]=df[col].map(lambda v:"'"+v if isinstance(v,str) and v.startswith(('=','+','-','@','\t','\r')) else v)
    return Response(df.to_csv(index=False).encode('utf-8-sig'),media_type='text/csv',headers={'Content-Disposition':f'attachment; filename="compass-{identifier}.csv"'})

@app.get('/api/runs/{identifier}/report',response_class=HTMLResponse)
def report(identifier:str):
    r=read_run(identifier); s=r['simulation']; c=r['scenario']['constraints']; e=html.escape
    findings=''.join(f'<section><h2>{e(f["title"])}</h2><p>{e(f["text"])}</p><small>{e(f["basis"])}</small></section>' for f in r['findings'])
    rows=''.join(f'<tr><td>{e(str(x.get("employee_name",x["employee_id"])))}</td><td>{e(str(x["organization_name"]))}</td><td>{x["standard_monthly_fixed_pay"]:,.2f}</td><td>{x["monthly_increase"]:,.2f}</td><td>{x["after_fixed_pay"]:,.2f}</td></tr>' for x in s['employees'])
    labels={'name':'方案名称','organization_id':'组织范围','baseline_month':'基准月份','effective_month':'生效月份','currency':'币种','budget':'增量预算','budget_basis':'预算口径','strategy':'测算策略','min_raise_pct':'最低涨幅（%）','max_raise_pct':'最高涨幅（%）','default_raise_pct':'统一目标涨幅（%）','target_cr':'目标内部 CR','exclude_recent_months':'排除入职未满月数','excluded_employee_ids':'额外排除员工编号','business_context':'业务背景与偏好'}
    display_values={'annualized':'年化增量（12 个月）','current_year':'生效当年增量','band':'内部薪酬校准','uniform':'统一比例'}
    conditions=[]
    for k,v in c.items():
        if k=='default_raise_pct' and c['strategy']!='uniform': continue
        if k=='target_cr' and c['strategy']!='band': continue
        value=', '.join(v) if isinstance(v,list) else str(v)
        if k=='organization_id' and not v: value='全部组织'
        value=display_values.get(value,value) or '未设置'
        conditions.append(f'<tr><td>{e(labels.get(k,k))}</td><td>{e(value)}</td></tr>')
    constraints=''.join(conditions)
    return f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>{e(c['name'])}</title><style>body{{font-family:Arial,"Microsoft YaHei",sans-serif;color:#183447;max-width:1000px;margin:48px auto;line-height:1.7;padding:0 24px}}h1{{font-size:32px}}h2{{font-size:19px}}small{{color:#607280}}section{{padding:20px 0;border-bottom:1px solid #dde5ea}}.banner{{padding:12px 18px;background:#edf7f6}}.numbers{{display:flex;gap:50px;padding:25px 0;font-size:24px}}table{{border-collapse:collapse;width:100%;font-size:12px;margin-top:20px}}td,th{{border-bottom:1px solid #e0e7ea;text-align:left;padding:9px;overflow-wrap:anywhere}}button{{padding:10px 18px;cursor:pointer}}@media print{{button{{display:none}}body{{margin:0;max-width:none}}tr{{break-inside:avoid}}thead{{display:table-header-group}}}}</style><button onclick="window.print()">打印 / 保存 PDF</button><h1>{e(c['name'])}</h1><div class="banner">Mock 演示报告 · 模板生成建议，数字来自实际规则计算 · {e(r['dataset']['source'])} 数据</div><p>数据：{e(r['dataset']['name'])} / {e(r['dataset']['id'])}<br>方案版本：v{r['scenario']['version']} · 创建时间：{e(r['created_at'])}</p><div class="numbers"><div>{s['adjusted']} 人<br><small>调整人数</small></div><div>{s['budget_cost']:,.2f}<br><small>预算口径增量 / {e(c['currency'])}</small></div><div>{s['remaining_budget']:,.2f}<br><small>剩余预算</small></div></div><p>{e(s['method'])}</p>{findings}<h2>分析条件快照</h2><table>{constraints}</table><h2>人员测算明细 / {e(c['currency'])} / 月固定薪酬</h2><table><thead><tr><th>员工</th><th>组织</th><th>调整前</th><th>月增量</th><th>调整后</th></tr></thead><tbody>{rows}</tbody></table></html>'''

dist=Path(__file__).resolve().parents[1]/'dist'
if dist.exists(): app.mount('/',StaticFiles(directory=dist,html=True),name='frontend')
