import unittest
from datetime import date, timedelta
from lib.sector_leadership import alignment, build_snapshot, month_start, load_context
from types import SimpleNamespace

class LeadershipTests(unittest.TestCase):
    def test_short_warmup_and_missing(self):
        points=[{'ratio':1+i/100} for i in range(22)]
        values=alignment(points,True)
        self.assertIsNone(values[19]['aligned'])
        self.assertTrue(values[20]['aligned'])
        points[-1]['ratio']=None
        self.assertIsNone(alignment(points,True)[-1]['aligned'])
        for p in points[-6:]: p['ratio']=None
        points[-1]['ratio']=2
        self.assertIsNone(alignment(points,True)[-1]['aligned'])
    def test_weekly_long_and_monthly_short_are_distinct(self):
        points=[{'ratio':1+i/1000} for i in range(210)]
        self.assertEqual(alignment(points)[-1]['method'],'long')
        self.assertEqual(alignment(points,True)[-1]['method'],'short')
    def test_flat_is_not_positive(self):
        self.assertFalse(alignment([{'ratio':1}]*30,True)[-1]['aligned'])
    def test_month_window_leap_boundary(self):
        self.assertEqual(month_start(date(2024,5,31),3),date(2024,2,29))
    def snapshot(self,eligible=5,members=None):
        return build_snapshot([{'id':1,'name':'Example','category':'custom'}],[],[
            {'index_id':1,'date':'2026-09-11','eligible':eligible,'leaders':3,'watch':1}],
            '2026-09-11',6,{1:members or list(range(7))})
    def test_denominator_is_classified_not_all_members(self):
        row=self.snapshot()['rows'][0]
        self.assertEqual(row['current']['leaders_pct'],60)
        self.assertEqual(row['current']['eligible'],5)
        self.assertEqual(row['current']['total'],7)
    def test_small_sample_is_unavailable_not_zero(self):
        self.assertIsNone(self.snapshot(4)['rows'][0]['current']['leaders_pct'])
    def test_missing_alignment_not_counted_as_negative(self):
        row=self.snapshot()['rows'][0]
        self.assertEqual(row['known_samples'],0)
        self.assertEqual(row['aligned_streak'],0)
    def test_membership_changes_invalidate_snapshot(self):
        self.assertNotEqual(self.snapshot()['snapshot'],self.snapshot(members=list(range(8)))['snapshot'])
    def test_completed_period_cannot_leak_into_earlier_reading(self):
        periods=[]
        for i in range(22):
            d=date(2024,1,1)+timedelta(days=28*i)
            periods.append({'index_id':1,'tf':'month','date':d.isoformat(),'available':(d+timedelta(days=30)).isoformat(),'ratio':1+i/10})
        last=periods[-1]
        payload=build_snapshot([{'id':1,'name':'Example','category':'custom'}],periods,[],last['date'],6,{1:[]})
        self.assertNotEqual(payload['rows'][0]['current']['monthly_date'],last['date'])
    def test_current_reading_stable_across_windows(self):
        symbols=[{'id':1,'name':'Example','category':'custom'}]
        support=[{'index_id':1,'date':d,'eligible':5,'leaders':3,'watch':1} for d in ('2025-10-01','2026-04-01','2026-09-11')]
        results=[build_snapshot(symbols,[],support,'2026-09-11',m,{1:list(range(5))}) for m in (3,6,12)]
        self.assertEqual(results[0]['rows'][0]['current'],results[2]['rows'][0]['current'])
        self.assertLess(len(results[0]['rows'][0]['history']),len(results[2]['rows'][0]['history']))
        self.assertNotEqual(results[0]['snapshot'],results[2]['snapshot'])

    def test_loader_binds_dates_and_archives_observation(self):
        class DB:
            def __init__(self):self.calls=[]
            def execute(self,sql,args=None):
                self.calls.append((sql,args))
                if sql.startswith('SELECT id,name'):return [{'id':1,'name':'Example','category':'custom'}]
                if sql.startswith('SELECT DISTINCT index_id'):return [{'index_id':1,'equity_id':i} for i in range(5)]
                return []
            def execute_write(self,sql,args=None):
                self.calls.append((sql,args))
                return 1
        db=DB();req=SimpleNamespace(date='2026-09-11',sector_category='custom',leadership_months=6)
        result=load_context(req,db)
        query=next((q,p) for q,p in db.calls if 'WITH benchmark' in q)
        self.assertIn('b.available <= %s',query[0]);self.assertEqual(query[1][-1],req.date)
        self.assertTrue(any('INSERT INTO km_leadership_observations' in q for q,p in db.calls))
        self.assertEqual(result['months'],6)

if __name__=='__main__':unittest.main()
