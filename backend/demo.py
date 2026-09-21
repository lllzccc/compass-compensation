"""Deterministic fictional data: never represented as real market evidence."""
import random
from .schema import SCHEMA, CASH, COST

def generate():
    rng = random.Random(42)
    data = {k: [] for k in SCHEMA}
    for i, name in enumerate(['销售中心','运营中心','研发中心']):
        data['organizations'].append(dict(organization_id=f'D{i+1}',organization_name=name,organization_type='业务中心',business_line=name[:2],cost_center_id=f'CC{i+1}',effective_from='2025-01-01'))
        for g in range(4, 9):
            mid = (g-2)*5200 * [1, .86, 1.28][i]
            data['job_grades'].append(dict(salary_band_id=f'B{i+1}-{g}',job_code=f'J{i+1}',job_name=['客户经理','运营专员','研发工程师'][i],job_family=name[:2],career_track='专业',grade=f'P{g}',location='上海',currency='CNY',pay_basis='月固定薪酬',band_min=round(mid*.75),band_mid=round(mid),band_max=round(mid*1.3),effective_from='2025-01-01'))
            data['market_benchmarks'].append(dict(benchmark_id=f'M{i+1}-{g}',source='虚拟市场基准，仅用于演示',source_date='2025-01-01',industry='互联网',company_size='100–500人',location='上海',market_job_name=['客户经理','运营专员','研发工程师'][i],market_grade=f'P{g}',internal_job_code=f'J{i+1}',internal_grade=f'P{g}',pay_basis='月固定薪酬',currency='CNY',p25=round(mid*.84),p50=round(mid*1.06),p75=round(mid*1.25),p90=round(mid*1.5),sample_size=100))
    for n in range(150):
        dept=n%3+1; g=rng.choices(range(4,9),weights=[20,35,28,12,5])[0]
        band=next(b for b in data['job_grades'] if b['salary_band_id']==f'B{dept}-{g}')
        fixed=round(band['band_mid']*rng.uniform(.66,1.35)/100)*100
        employee=f'E{n+1:04}'
        start=0 if n<135 else 12+(n%10)
        end=20 if n in [8,19,34,52,78] else 24
        hire='2023-06-01' if start==0 else f'2026-{start-11:02}-01'
        for t in range(start,end):
            year=2025+t//12; m=t%12+1; month=f'{year}-{m:02}'
            adjusted=round(fixed*1.055) if t>=15 else fixed
            # Small number of internal transfers with month-correct organization history.
            active_dept=2 if n in [3,6] and t>=18 else dept
            row=dict(employee_id=employee,month=month,employee_name=f'同事{n+1:03}',organization_id=f'D{active_dept}',job_code=f'J{dept}',grade=f'P{g}',salary_band_id=f'B{dept}-{g}',location='上海',employment_type='正式',employment_status='在职',hire_date=hire,termination_date='2026-08-31' if end==20 else None,fte=1,annual_salary_months=12,standard_monthly_fixed_pay=adjusted,target_annual_variable_pay=adjusted*2)
            data['employee_monthly'].append(row)
            commission=round(adjusted*rng.uniform(.4,1.2)) if dept==1 and m%3==0 else 0
            bonus=round(adjusted*rng.uniform(.05,.2))
            payroll=dict(employee_id=employee,month=month,currency='CNY',base_pay=adjusted-800,fixed_allowance=800,variable_allowance=0,overtime_pay=0,performance_bonus=bonus,commission_pay=commission,annual_bonus=adjusted*2 if m==12 else 0,other_cash_pay=0,pay_adjustment=0,employer_social_insurance=round(adjusted*.18),employer_housing_fund=round(adjusted*.07),employer_benefit_cost=300,other_employer_cost=0,paid_days=21.75,scheduled_days=21.75)
            payroll['gross_cash_pay']=sum(payroll[k] for k in CASH)
            payroll['total_employer_cost']=payroll['gross_cash_pay']+sum(payroll[k] for k in COST)
            data['payroll_monthly'].append(payroll)
            if commission:
                data['commissions'].append(dict(commission_id=f'C{employee}-{month}',employee_id=employee,business_period=month,payout_month=month,project_or_order_id=f'O{employee}-{month}',scheme_id='SALES-Q',rule_version='1',calculation_basis='回款',eligible_amount=commission*20,commission_rate=.05,calculated_commission=commission,adjustment_amount=0,payable_commission=commission,paid_commission=commission,payment_status='已发放'))
            if m%3==0:
                data['performance'].append(dict(employee_id=employee,period_start=f'{year}-{m-2:02}-01',period_end=f'{month}-{30 if m in [6,9] else 31}',period_type='季度',performance_rating=rng.choices(['A','B','C'],[.25,.6,.15])[0],performance_score=rng.randint(65,98),rating_scale_id='100分制',metric_name='综合绩效',metric_unit='分',target_value=80,actual_value=rng.randint(65,100)))
            if t==15:
                data['salary_changes'].append(dict(change_id=f'S{employee}',employee_id=employee,effective_date='2026-04-01',change_type='年度普调',before_fixed_pay=fixed,after_fixed_pay=adjusted,pay_basis='月固定薪酬',currency='CNY',before_grade=f'P{g}',after_grade=f'P{g}',reason='虚拟年度调薪记录'))
    for t in range(24):
        month=f'{2025+t//12}-{t%12+1:02}'
        for d in range(1,4):
            for code,title,value,unit,method in [('revenue','收入',round((3200000+d*100000)*(1+t*.013)*rng.uniform(.9,1.1)),'元','sum'),('delivery','交付项目数',rng.randint(8,20),'个','sum')]:
                data['business_metrics'].append(dict(organization_id=f'D{d}',month=month,metric_code=code,metric_name=title,metric_value=value,metric_unit=unit,currency='CNY' if unit=='元' else None,metric_definition='演示数据，归属本组织当月，不含下级重复汇总',aggregation_method=method))
    for m in range(1,13):
        for b in data['job_grades']:
            data['workforce_budget'].append(dict(scenario_id='PLAN-2027',month=f'2027-{m:02}',organization_id=f'D{b["job_code"][-1]}',job_code=b['job_code'],grade=b['grade'],planned_fte=10,planned_hires=1 if m==4 else 0,planned_exits=0,planned_avg_monthly_fixed_pay=b['band_mid'],planned_variable_pay=b['band_mid']*2,planned_employer_contributions=b['band_mid']*2.5,planned_other_cost=3000,approved_budget=b['band_mid']*15))
    return data

if __name__=='__main__':
    import json
    from pathlib import Path
    out=Path('outputs/demo'); out.mkdir(parents=True,exist_ok=True)
    (out/'source.json').write_text(json.dumps(generate(),ensure_ascii=False),encoding='utf-8')
    (out/'schema.json').write_text(json.dumps(SCHEMA,ensure_ascii=False),encoding='utf-8')
    print('Fictional source records and schema written.')
