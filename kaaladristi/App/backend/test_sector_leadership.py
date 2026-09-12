import unittest
from datetime import date, timedelta
from lib.sector_leadership import alignment, build_snapshot, month_start, load_context, compute_context, window_snapshot, NOT_READY
from types import SimpleNamespace
from unittest.mock import patch

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
        self.assertEqual(self.snapshot(4)['rows'][0]['current']['leaders'],3)
        self.assertEqual(self.snapshot(4)['rows'][0]['status'],'Limited coverage')

    def classification(self, weeks=8, eligible=5, total=5, leaders=3, current=True):
        target='2026-09-11'
        weekly=[{'index_id':1,'tf':'week','date':(date(2026,9,4)-timedelta(weeks=weeks-1-i)).isoformat(),
                 'available':(date(2026,9,7)-timedelta(weeks=weeks-1-i)).isoformat(),
                 'ratio':1,'aligned':current if i==weeks-1 else True,'method':'short',
                 'short_rs':1,'short_ma':0,'long_rs':None,'long_ma':None} for i in range(weeks)]
        monthly=[dict(weekly[0],tf='month',date='2025-01-31',available='2025-02-01',aligned=True)]
        with patch('lib.sector_leadership.alignment',side_effect=lambda points,*args:points):
            return build_snapshot([{'id':1,'name':'Example','category':'custom'}],weekly+monthly,
                [{'index_id':1,'date':target,'eligible':eligible,'leaders':leaders,'watch':1}],
                target,12,{1:list(range(total))})

    def test_classification_boundaries_and_distinct_current_flow(self):
        self.assertEqual(self.classification()['rows'][0]['status'],'Running broadly')
        self.assertEqual(self.classification(weeks=7)['rows'][0]['status'],'Building')
        self.assertEqual(self.classification(leaders=2)['rows'][0]['status'],'Building')
        self.assertEqual(self.classification(total=7)['rows'][0]['status'],'Limited coverage')
        cooling=self.classification(current=False)['rows'][0]
        self.assertEqual(cooling['status'],'Cooling')
        self.assertEqual(cooling['aligned_streak'],0)
        self.assertEqual(self.classification(weeks=1,current=False)['rows'][0]['status'],'Not aligned')
        missing=self.classification(current=None)['rows'][0]
        self.assertEqual(missing['status'],'Unavailable')

    def test_display_window_does_not_reclassify_or_recount_run(self):
        source=self.classification(weeks=30)
        outputs=[window_snapshot(source,m) for m in (3,6,12)]
        self.assertEqual({p['rows'][0]['status'] for p in outputs},{'Running broadly'})
        self.assertEqual({p['rows'][0]['aligned_streak'] for p in outputs},{30})
        self.assertLess(len(outputs[0]['rows'][0]['alignment_history']),len(outputs[2]['rows'][0]['alignment_history']))

    def test_read_path_only_loads_published_snapshot(self):
        source=window_snapshot(self.classification(),6)
        class DB:
            def __init__(self):self.calls=[]
            def execute(self,sql,args=None):
                self.calls.append(sql)
                return [{'payload':source}] if 'SELECT s.payload' in sql else []
        db=DB()
        result=load_context(SimpleNamespace(date='2026-09-11',sector_category='custom',leadership_months=6),db)
        self.assertEqual(result['snapshot'],source['snapshot'])
        self.assertEqual(len(db.calls),2)
        self.assertFalse(any('km_equity_eod' in sql or 'WITH benchmark' in sql for sql in db.calls))

    def test_unpublished_or_changed_membership_never_falls_back_to_compute(self):
        class DB:
            def execute(self,sql,args=None):return []
        req=SimpleNamespace(date='2026-09-11',sector_category='custom',leadership_months=6)
        with patch('lib.sector_leadership.compute_context') as compute:
            with self.assertRaisesRegex(ValueError,'snapshot is being prepared'):load_context(req,DB())
            compute.assert_not_called()
        source=window_snapshot(self.classification(),6)
        class ChangedDB:
            def execute(self,sql,args=None):
                return [{'payload':source}] if 'SELECT s.payload' in sql else [{'index_id':1,'revision':2,'computed_revision':1}]
        with self.assertRaisesRegex(ValueError,'snapshot is being prepared'):load_context(req,ChangedDB())

    def test_chart_average_matches_migration_169_short_warmup(self):
        points=alignment([{'ratio':1+i/100} for i in range(50)],True)
        self.assertIsNone(points[39]['short_ma'])
        self.assertAlmostEqual(points[40]['short_ma'],round(sum(p['short_rs'] for p in points[20:41])/21,4))

    def test_publication_commits_whole_batch_or_rolls_back(self):
        import sys
        from types import ModuleType
        from lib.sector_leadership import refresh_snapshots
        pg=ModuleType('psycopg2');extra=ModuleType('psycopg2.extras');extra.RealDictCursor=object
        class Conn:
            def __init__(self,fail=False):self.commits=0;self.rollbacks=0;self.writes=0;self.fail=fail;self.calls=[]
            def cursor(self,**kwargs):return self
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def execute(self,sql,args=None):
                self.calls.append(sql);self.sql=sql
                if 'INSERT INTO km_sector_leadership_snapshots' in sql:
                    self.writes+=1
                    if self.fail and self.writes==2:raise RuntimeError('fixture publication failure')
            def fetchall(self):return [{'locked':True}] if 'advisory' in self.sql else [{'generation':1}]
            def commit(self):self.commits+=1
            def rollback(self):self.rollbacks+=1
        with patch.dict(sys.modules,{'psycopg2':pg,'psycopg2.extras':extra}), patch('lib.sector_leadership.compute_context',return_value=self.classification()):
            success=Conn()
            self.assertEqual(refresh_snapshots(success,'2026-09-11'),15)
            self.assertEqual(success.commits,2)
            self.assertEqual(success.rollbacks,0)
            self.assertTrue(any('FOR SHARE' in q for q in success.calls))
            failed=Conn(True)
            with self.assertRaisesRegex(RuntimeError,'publication failure'):refresh_snapshots(failed,'2026-09-11')
            self.assertEqual(failed.commits,1)  # initial caller transaction only
            self.assertEqual(failed.rollbacks,1)
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

    def test_job_binds_dates_and_computes_canonical_history(self):
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
        result=compute_context(req,db)
        query=next((q,p) for q,p in db.calls if 'WITH benchmark' in q)
        self.assertIn('b.available <= %s',query[0]);self.assertEqual(query[1][-1],req.date)
        self.assertFalse(any('INSERT INTO km_leadership_observations' in q for q,p in db.calls))
        self.assertEqual(result['months'],12)

if __name__=='__main__':unittest.main()
