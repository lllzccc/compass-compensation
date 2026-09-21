import math
import pandas as pd

def records(df):
    return __import__('json').loads(df.to_json(orient='records',force_ascii=False,date_format='iso'))

def number(v):
    return round(float(v),2) if v is not None and pd.notna(v) and math.isfinite(float(v)) else None

def total(df,col):
    return number(df[col].sum()) if col in df and len(df) and df[col].notna().all() else None

def scope_ids(tables, org):
    ids={org}
    if not org: return None
    df=tables['organizations']
    if 'parent_organization_id' not in df: return ids
    while True:
        new=ids | set(df.loc[df.parent_organization_id.isin(ids),'organization_id'])
        if new==ids: return ids
        ids=new

def joined(tables):
    df=tables['payroll_monthly'].merge(tables['employee_monthly'],on=['employee_id','month'],how='left',validate='one_to_one',suffixes=('','_employee'))
    return df.merge(tables['organizations'][['organization_id','organization_name']],on='organization_id',how='left',validate='many_to_one')

def band_rows(df,tables):
    result=[]; bands=tables['job_grades'].set_index('salary_band_id')
    for _,row in df.iterrows():
        item=row.to_dict(); item.update(cr=None,band_min=None,band_mid=None,band_max=None,market_ratio=None)
        b=bands.loc[row.get('salary_band_id')] if row.get('salary_band_id') in bands.index else None
        fixed=row.get('standard_monthly_fixed_pay')
        if b is not None and b.pay_basis=='月固定薪酬' and b.currency==row.currency and str(b.effective_from)[:7]<=row.month and (pd.isna(b.get('effective_to')) or str(b.effective_to)[:7]>=row.month) and b.job_code==row.job_code and b.grade==row.grade and pd.notna(fixed):
            if pd.isna(b.get('location')) or b.get('location')==row.get('location'):
                item.update(cr=float(fixed/b.band_mid),band_min=number(b.band_min),band_mid=number(b.band_mid),band_max=number(b.band_max))
        market=tables.get('market_benchmarks',pd.DataFrame())
        if len(market) and pd.notna(fixed):
            matched=market[(market.internal_job_code==row.job_code)&(market.internal_grade==row.grade)&(market.currency==row.currency)&(market.pay_basis=='月固定薪酬')&(market.location==row.get('location'))&(market.source_date.str[:7]<=row.month)]
            if len(matched):
                bmk=matched.sort_values('source_date').iloc[-1]
                item['market_ratio']=number(fixed/bmk.p50)
                item['market_source']=bmk.source
        result.append(item)
    return pd.DataFrame(result)

def dashboard(tables,year,org='',currency='CNY'):
    df=joined(tables); ids=scope_ids(tables,org)
    df=df[(df.month.str[:4]==str(year))&(df.currency==currency)]
    if ids: df=df[df.organization_id.isin(ids)]
    if df.empty: return {'empty':True,'year':year,'currency':currency}
    latest=df.month.max(); current=band_rows(df[df.month==latest].copy(),tables)
    fixed=current.get('standard_monthly_fixed_pay',pd.Series(dtype=float))
    cr=current.cr.dropna()
    groups=[]
    for identifier,g in df.groupby('organization_id'):
        latest_g=g[g.month==latest]
        revenue=None; business=tables.get('business_metrics',pd.DataFrame())
        if len(business):
            selected=business[(business.organization_id==identifier)&business.month.isin(g.month.unique())&(business.metric_code=='revenue')&(business.currency==currency)&(business.aggregation_method=='sum')]
            if set(selected.month)==set(g.month): revenue=total(selected,'metric_value')
        cost=total(g,'total_employer_cost')
        groups.append(dict(id=identifier,name=g.organization_name.iloc[0],headcount=len(latest_g),cost=cost,cash=total(g,'gross_cash_pay'),revenue=revenue,cost_ratio=number(cost/revenue*100) if cost is not None and revenue else None,average=number(latest_g.standard_monthly_fixed_pay.mean()) if 'standard_monthly_fixed_pay' in latest_g else None))
    trends=[dict(month=m,cost=total(g,'total_employer_cost'),cash=total(g,'gross_cash_pay'),headcount=len(g),commission=total(g,'commission_pay')) for m,g in df.groupby('month')]
    distribution=[]
    for lo,hi,label in [(0,10000,'1万以下'),(10000,20000,'1–2万'),(20000,30000,'2–3万'),(30000,40000,'3–4万'),(40000,float('inf'),'4万以上')]:
        distribution.append(dict(name=label,value=int(((fixed>=lo)&(fixed<hi)).sum())))
    grades=[]
    for grade,g in current.groupby('grade'):
        values=g.standard_monthly_fixed_pay.dropna() if 'standard_monthly_fixed_pay' in g else pd.Series(dtype=float)
        if len(values): grades.append(dict(grade=grade,p25=number(values.quantile(.25)),median=number(values.median()),p75=number(values.quantile(.75)),count=len(values)))
    changes=tables.get('salary_changes',pd.DataFrame())
    if len(changes): changes=changes[(changes.effective_date.str[:4]==str(year))&changes.employee_id.isin(df.employee_id)&(changes.currency==currency)]
    return dict(empty=False,year=year,currency=currency,latest=latest,months=int(df.month.nunique()),headcount=len(current),cash=total(df,'gross_cash_pay'),cost=total(df,'total_employer_cost'),median=number(fixed.median()) if len(fixed) else None,average_cr=number(cr.mean()) if len(cr) else None,cr_coverage=len(cr),below_band=int(((current.standard_monthly_fixed_pay<current.band_min)&current.band_min.notna()).sum()) if 'standard_monthly_fixed_pay' in current else 0,above_band=int(((current.standard_monthly_fixed_pay>current.band_max)&current.band_max.notna()).sum()) if 'standard_monthly_fixed_pay' in current else 0,commission=total(df,'commission_pay'),changed_employees=int(changes.employee_id.nunique()) if len(changes) else 0,trends=trends,organizations=groups,distribution=distribution,grades=grades,employees=records(current),market_coverage=int(current.market_ratio.notna().sum()))

def simulate(tables,constraints):
    c=constraints; df=joined(tables)
    df=df[(df.month==c['baseline_month'])&(df.currency==c['currency'])]
    ids=scope_ids(tables,c.get('organization_id'))
    if ids: df=df[df.organization_id.isin(ids)]
    if df.empty: raise ValueError('基准月份和组织范围内没有薪酬数据')
    df=band_rows(df,tables)
    if 'standard_monthly_fixed_pay' not in df or df.standard_monthly_fixed_pay.isna().any(): raise ValueError('测算需要每位员工的标准月固定薪酬，不能用当月实发替代')
    if c['exclude_recent_months']:
        if 'hire_date' not in df or df.hire_date.isna().any(): raise ValueError('按入职时间排除人员需要完整入职日期')
        effective=pd.Timestamp(c['effective_month']+'-01')
        cutoff=effective-pd.DateOffset(months=c['exclude_recent_months'])
        df=df[pd.to_datetime(df.hire_date)<cutoff]
    df=df[~df.employee_id.isin(c['excluded_employee_ids'])]
    if 'employment_status' in df: df=df[df.employment_status!='离职']
    if df.empty: raise ValueError('排除条件生效后没有可调整员工')
    months=12 if c['budget_basis']=='annualized' else 13-int(c['effective_month'][5:7])
    # First release explicitly measures 12 monthly fixed payments only, excluding taxes,
    # annual guaranteed extra months, employer costs and variable-pay linkage.
    base=df.standard_monthly_fixed_pay.astype(float)
    minimum=base*c['min_raise_pct']/100
    maximum=base*c['max_raise_pct']/100
    floor_cost=float(minimum.sum())*months
    if floor_cost>c['budget']+.001: raise ValueError(f'最低涨幅需要 {floor_cost:,.2f} 元，超过预算 {c["budget"]:,.2f} 元，请降低最低涨幅或增加预算')
    if c['strategy']=='band':
        if df.band_mid.isna().any(): raise ValueError('薪酬校准策略需要范围内所有员工匹配有效的月固定薪酬标准')
        target=(df.band_mid*c['target_cr']-base).clip(lower=0)
    else:
        target=base*c['default_raise_pct']/100
    desired=target.clip(lower=minimum,upper=maximum)
    extra=(desired-minimum).clip(lower=0)
    room=max(0,c['budget']/months-float(minimum.sum()))
    factor=min(1,room/float(extra.sum())) if extra.sum()>0 else 0
    increments=(minimum+extra*factor)
    # Enforce minima at cent precision; allocate only whole cents that fit the budget.
    min_cents=(minimum*100).apply(math.ceil).astype(int)
    max_cents=(maximum*100).apply(math.floor).astype(int)
    if (min_cents>max_cents).any(): raise ValueError('涨幅上下限在分币精度下冲突，请放宽范围')
    budget_cents=math.floor(c['budget']*100/months)
    if int(min_cents.sum())>budget_cents: raise ValueError('按分币取整后最低涨幅超过预算，请增加少量预算')
    cents=(increments*100).apply(math.floor).astype(int).clip(lower=min_cents,upper=max_cents)
    excess=int(cents.sum())-budget_cents
    if excess>0:
        for index in cents.index:
            reduce=min(excess,int(cents[index]-min_cents[index])); cents[index]-=reduce; excess-=reduce
            if excess==0: break
    df['monthly_increase']=cents/100
    df['after_fixed_pay']=base+df.monthly_increase
    df['raise_pct']=(df.monthly_increase/base.replace(0,float('nan'))*100).round(2)
    cols=['employee_id','employee_name','organization_name','grade','standard_monthly_fixed_pay','monthly_increase','after_fixed_pay','raise_pct']
    monthly=number(df.monthly_increase.sum()); cost=round(monthly*months,2)
    return dict(eligible=len(df),adjusted=int((df.monthly_increase>0).sum()),months=months,monthly_increase=monthly,budget_cost=cost,annualized_cost=round(monthly*12,2),remaining_budget=round(c['budget']-cost,2),average_raise_pct=number(monthly/base.sum()*100) if base.sum() else 0,employees=records(df[[x for x in cols if x in df]]),method='仅测算每年 12 个月固定薪酬增量；不含额外计薪月、浮动薪酬及公司缴费联动。人员以基准月快照为准。')
