import re
import pandas as pd
from .schema import SCHEMA, CORE, CASH, COST

def validate(raw, mappings=None):
    issues=[]; actions=[]; clean={}; mappings=mappings or {}
    def issue(sheet, field, message, row=None, severity='error'):
        issues.append(dict(sheet=sheet,field=field,message=message,row=row,severity=severity))
    for key in CORE:
        if key not in raw:
            issue(key,'',f'缺少核心工作表：{SCHEMA[key]["label"]}（{key}）')
    for key, source in raw.items():
        if key not in SCHEMA:
            continue
        spec=SCHEMA[key]; df=source.copy()
        aliases={v['label']:k for k,v in spec['fields'].items()}
        cols=[mappings.get(key,{}).get(str(c).strip(),aliases.get(str(c).strip(),str(c).strip())) for c in df.columns]
        if len(set(cols))!=len(cols):
            issue(key,'','多个列映射到了同一个字段，请修改映射'); continue
        df.columns=cols
        before=len(df); df=df.dropna(how='all').reset_index(drop=True)
        if len(df)!=before:
            actions.append(f'{spec["label"]}：移除 {before-len(df)} 个空行')
        for col, field in spec['fields'].items():
            if col not in df:
                if field['required']:
                    issue(key,col,f'缺少必填字段：{field["label"]}')
                continue
            original=df[col].copy()
            df[col]=df[col].map(lambda v: v.strip() if isinstance(v,str) else v)
            df[col]=df[col].replace('',None)
            if field['type']=='number':
                df[col]=pd.to_numeric(df[col],errors='coerce')
                bad=(original.notna() & original.astype(str).str.strip().ne('') & df[col].isna()) | df[col].isin([float('inf'),float('-inf')])
                for idx in df.index[bad]: issue(key,col,'需要有限数值，不能包含货币符号或文字',int(idx)+2)
            elif field['type'] in ['month','date']:
                df[col]=df[col].astype(object)
                for idx,v in df[col].items():
                    if pd.isna(v): continue
                    try:
                        if isinstance(v,(int,float)): raise ValueError()
                        text=str(v)
                        if field['type']=='month' and not re.match(r'^\d{4}-\d{2}($|-\d{2})',text): raise ValueError()
                        d=pd.Timestamp(v)
                        if pd.isna(d): raise ValueError()
                        df.at[idx,col]=d.strftime('%Y-%m' if field['type']=='month' else '%Y-%m-%d')
                    except (ValueError,TypeError,OverflowError): issue(key,col,'日期格式应为 YYYY-MM 或 YYYY-MM-DD',int(idx)+2)
            else:
                df[col]=df[col].map(lambda x: str(x) if pd.notna(x) else None)
                if col=='currency': df[col]=df[col].str.upper()
            if field['required']:
                for idx in df.index[df[col].isna()]: issue(key,col,'必填值为空',int(idx)+2)
        keys=[k for k in spec['key'] if k in df]
        if len(keys)==len(spec['key']):
            for idx in df.index[df.duplicated(keys,keep=False)]: issue(key,','.join(keys),'唯一键重复，请在原表中核对并修正',int(idx)+2)
        if key in CORE and df.empty: issue(key,'','核心工作表不能为空')
        # Keep unknown columns for traceability, but only known fields participate in computation.
        clean[key]=df
    def usable(key,cols): return key in clean and all(c in clean[key] for c in cols)
    if usable('organizations',['organization_id']):
        org=clean['organizations']; ids=set(org.organization_id)
        for key in ['employee_monthly','business_metrics','workforce_budget']:
            if usable(key,['organization_id']):
                for idx in clean[key].index[~clean[key].organization_id.isin(ids)]: issue(key,'organization_id','组织编号不存在',int(idx)+2)
        if 'parent_organization_id' in org:
            parents=dict(zip(org.organization_id,org.parent_organization_id))
            for identifier,parent in parents.items():
                if pd.notna(parent) and parent not in ids: issue('organizations','parent_organization_id',f'{identifier} 的上级组织不存在')
                visited={identifier}; cursor=parent
                while pd.notna(cursor) and cursor in parents:
                    if cursor in visited:
                        issue('organizations','parent_organization_id','组织层级存在循环'); break
                    visited.add(cursor); cursor=parents[cursor]
    if usable('employee_monthly',['employee_id','month']):
        employees=clean['employee_monthly']; ids=set(employees.employee_id)
        for key in ['performance','commissions','salary_changes']:
            if usable(key,['employee_id']):
                for idx in clean[key].index[~clean[key].employee_id.isin(ids)]: issue(key,'employee_id','员工编号不存在',int(idx)+2)
        if usable('payroll_monthly',['employee_id','month']):
            keys=set(zip(employees.employee_id,employees.month)); payroll=clean['payroll_monthly']
            for idx,row in payroll.iterrows():
                if (row.employee_id,row.month) not in keys: issue('payroll_monthly','employee_id,month','找不到该员工当月任职信息',int(idx)+2)
            pkeys=set(zip(payroll.employee_id,payroll.month))
            for idx,row in employees.iterrows():
                if (row.employee_id,row.month) not in pkeys: issue('employee_monthly','employee_id,month','缺少该员工当月薪酬，指标可能不完整',int(idx)+2,'warning')
    if usable('job_grades',['band_min','band_mid','band_max']):
        bands=clean['job_grades']
        for idx in bands.index[(bands.band_min<0)|(bands.band_min>bands.band_mid)|(bands.band_mid>bands.band_max)|(bands.band_mid<=0)]: issue('job_grades','band_mid','薪酬范围必须满足 0 ≤ 下限 ≤ 中点 ≤ 上限，且中点大于 0',int(idx)+2)
        if 'salary_band_id' in bands and usable('employee_monthly',['salary_band_id']):
            emp=clean['employee_monthly']; invalid=emp.salary_band_id.notna() & ~emp.salary_band_id.isin(bands.salary_band_id)
            for idx in emp.index[invalid]: issue('employee_monthly','salary_band_id','薪酬标准编号不存在',int(idx)+2)
    if usable('payroll_monthly',['gross_cash_pay']):
        df=clean['payroll_monthly']
        for target,components in [('gross_cash_pay',CASH),('total_employer_cost',['gross_cash_pay']+COST)]:
            if target not in df: continue
            if all(c in df for c in components):
                complete=df[components+[target]].notna().all(axis=1)
                bad=complete & ((df[components].sum(axis=1)-df[target]).abs()>.05)
                for idx in df.index[bad]: issue('payroll_monthly',target,'金额明细与合计不一致（容差 0.05 元）',int(idx)+2)
        if 'total_employer_cost' not in df:
            issue('payroll_monthly','total_employer_cost','未提供完整公司用工成本，成本指标将显示未提供',severity='warning')
    for key in clean:
        for col in ['fte','standard_monthly_fixed_pay','annual_salary_months','planned_fte','p50','sample_size','paid_days','scheduled_days']:
            if col in clean[key] and pd.api.types.is_numeric_dtype(clean[key][col]):
                for idx in clean[key].index[clean[key][col]<0]: issue(key,col,'该字段不能为负数',int(idx)+2)
    if usable('market_benchmarks',['p50']):
        df=clean['market_benchmarks']
        for idx in df.index[df.p50<=0]: issue('market_benchmarks','p50','市场基准必须大于 0',int(idx)+2)
    for key,df in clean.items():
        for start,end in [('effective_from','effective_to'),('period_start','period_end'),('hire_date','termination_date')]:
            if start in df and end in df:
                a=pd.to_datetime(df[start],errors='coerce'); b=pd.to_datetime(df[end],errors='coerce')
                for idx in df.index[a>b]: issue(key,end,'结束日期不能早于开始日期',int(idx)+2)
    actions.append('统一字段名称、首尾空格、日期格式与数值类型；未自动填补缺失薪酬或删除重复业务记录')
    return clean,issues,actions
