import copy
import os
import tempfile
import unittest
from pathlib import Path
os.environ['COMPASS_DATA_DIR']=tempfile.mkdtemp(prefix='compass-tests-')
import pandas as pd
from fastapi.testclient import TestClient
from backend.main import app, Constraints
from backend.demo import generate
from backend.validation import validate
from backend.analysis import dashboard, simulate

class WorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tables={k:pd.DataFrame(v) for k,v in generate().items()}
        cls.tables,issues,_=validate(cls.tables)
        assert not issues,issues
        cls.client=TestClient(app)
        cls.dataset=cls.client.post('/api/demo').json()

    def test_reconciles_annual_cash_and_cost(self):
        d=dashboard(self.tables,2026)
        payroll=self.tables['payroll_monthly']; annual=payroll[payroll.month.str.startswith('2026')]
        self.assertEqual(d['cash'],annual.gross_cash_pay.sum())
        self.assertEqual(d['cost'],sum(o['cost'] for o in d['organizations']))
        self.assertEqual(d['headcount'],145)
        self.assertEqual(d['headcount'],sum(x['value'] for x in d['distribution']))

    def test_missing_cost_is_not_zero(self):
        t=copy.deepcopy(self.tables); t['payroll_monthly']=t['payroll_monthly'].drop(columns='total_employer_cost')
        self.assertIsNone(dashboard(t,2026)['cost'])

    def test_missing_market_is_not_invented(self):
        t=copy.deepcopy(self.tables); del t['market_benchmarks']
        self.assertEqual(dashboard(t,2026)['market_coverage'],0)

    def test_future_benchmark_not_used(self):
        t=copy.deepcopy(self.tables);t['market_benchmarks']['source_date']='2030-01-01'
        self.assertEqual(dashboard(t,2026)['market_coverage'],0)

    def test_currency_is_separate(self):
        self.assertTrue(dashboard(self.tables,2026,currency='USD')['empty'])

    def test_organization_history(self):
        self.assertEqual(dashboard(self.tables,2026,'D2')['headcount'],49)
        self.assertEqual(dashboard(self.tables,2025,'D2')['headcount'],45)

    def test_duplicates_block_import(self):
        t=copy.deepcopy(self.tables);t['payroll_monthly']=pd.concat([t['payroll_monthly'],t['payroll_monthly'].head(1)],ignore_index=True)
        _,issues,_=validate(t)
        self.assertTrue(any('唯一键重复' in x['message'] for x in issues))

    def test_missing_fk_blocks_import(self):
        t=copy.deepcopy(self.tables);t['employee_monthly'].loc[0,'organization_id']='MISSING'
        _,issues,_=validate(t);self.assertTrue(any('组织编号不存在' in x['message'] for x in issues))

    def test_bad_totals_block_import(self):
        t=copy.deepcopy(self.tables);t['payroll_monthly'].loc[0,'gross_cash_pay']+=100
        _,issues,_=validate(t);self.assertTrue(any('合计不一致' in x['message'] for x in issues))

    def test_blank_not_imputed(self):
        t=copy.deepcopy(self.tables);t['payroll_monthly'].loc[0,'gross_cash_pay']=None
        clean,issues,_=validate(t);self.assertTrue(pd.isna(clean['payroll_monthly'].loc[0,'gross_cash_pay']))
        self.assertTrue(any(x['message']=='必填值为空' for x in issues))

    def test_missing_band_id_does_not_crash_validation(self):
        t=copy.deepcopy(self.tables);t['job_grades']=t['job_grades'].drop(columns='salary_band_id')
        _,issues,_=validate(t);self.assertTrue(any(x['field']=='salary_band_id' for x in issues))

    def test_budget_and_maximum_are_hard_limits(self):
        c=Constraints().model_dump();r=simulate(self.tables,c)
        self.assertLessEqual(r['budget_cost'],c['budget'])
        for e in r['employees']:
            self.assertLessEqual(e['monthly_increase'],e['standard_monthly_fixed_pay']*.15+.001)
        self.assertAlmostEqual(r['budget_cost'],sum(e['monthly_increase'] for e in r['employees'])*12,places=2)

    def test_zero_budget_and_zero_minimum(self):
        c=Constraints(budget=0).model_dump();r=simulate(self.tables,c)
        self.assertEqual(r['budget_cost'],0);self.assertEqual(r['adjusted'],0)

    def test_minimum_conflict_rejected(self):
        with self.assertRaisesRegex(ValueError,'超过预算'):
            simulate(self.tables,Constraints(budget=1,min_raise_pct=5).model_dump())

    def test_current_year_counts_effective_month(self):
        c=Constraints(budget_basis='current_year',effective_month='2027-04').model_dump();r=simulate(self.tables,c)
        self.assertEqual(r['months'],9)
        self.assertAlmostEqual(r['budget_cost'],r['monthly_increase']*9,places=2)

    def test_excluded_employee(self):
        c=Constraints(excluded_employee_ids=['E0001']).model_dump();r=simulate(self.tables,c)
        self.assertNotIn('E0001',[e['employee_id'] for e in r['employees']])

    def test_invalid_constraint_order(self):
        r=self.client.post('/api/scenarios',json={'constraints':{'min_raise_pct':20,'max_raise_pct':10}})
        self.assertEqual(r.status_code,422)

    def test_scenario_version_and_immutable_run(self):
        c=Constraints(name='测试快照').model_dump()
        s=self.client.post('/api/scenarios',json={'constraints':c}).json()
        r=self.client.post('/api/runs',json={'dataset_id':self.dataset['id'],'scenario_id':s['id'],'scenario_version':1})
        self.assertEqual(r.status_code,200,r.text);run=r.json()
        c['budget']=0
        updated=self.client.post('/api/scenarios',json={'id':s['id'],'expected_version':1,'constraints':c})
        self.assertEqual(updated.json()['version'],2)
        conflict=self.client.post('/api/scenarios',json={'id':s['id'],'expected_version':1,'constraints':c})
        self.assertEqual(conflict.status_code,409)
        old=self.client.get('/api/runs/'+run['id']).json()
        self.assertEqual(old['scenario']['constraints']['budget'],1000000)
        report=self.client.get('/api/runs/'+run['id']+'/report');self.assertIn('Mock',report.text)
        self.assertTrue(self.client.get('/api/runs/'+run['id']+'/csv').content.startswith(b'\xef\xbb\xbf'))

    def test_excel_import_roundtrip_and_idempotent_commit(self):
        path=Path('outputs/demo/compass-demo.xlsx')
        self.assertTrue(path.exists())
        r=self.client.post('/api/import/preview',files={'file':(path.name,path.read_bytes(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')})
        self.assertEqual(r.status_code,200,r.text);preview=r.json()
        self.assertEqual(preview['error_count'],0)
        commit=self.client.post(f'/api/import/{preview["id"]}/commit')
        self.assertEqual(commit.status_code,200,commit.text)
        self.assertEqual(commit.json()['id'],self.client.post(f'/api/import/{preview["id"]}/commit').json()['id'])
        d=self.client.get('/api/dashboard',params={'dataset_id':commit.json()['id'],'year':2026}).json()
        self.assertEqual(d['cash'],dashboard(self.tables,2026)['cash'])

    def test_csv_invalid_import_cannot_commit(self):
        text='employee_id,month,currency,gross_cash_pay\nMISSING,2026-12,CNY,100\n'
        r=self.client.post('/api/import/preview',files={'file':('bad.csv',text.encode())})
        self.assertEqual(r.status_code,200,r.text)
        p=r.json();self.assertGreater(p['error_count'],0)
        self.assertEqual(self.client.post(f'/api/import/{p["id"]}/commit').status_code,422)

    def test_custom_mapping(self):
        t=copy.deepcopy(self.tables);t['payroll_monthly']=t['payroll_monthly'].rename(columns={'employee_id':'工号'})
        _,issues,_=validate(t,{'payroll_monthly':{'工号':'employee_id'}})
        self.assertFalse(any(x['severity']=='error' for x in issues))

if __name__=='__main__':unittest.main()
