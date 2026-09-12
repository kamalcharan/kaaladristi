"""Offline contract checks: source dates, missing data, score states and cache routing."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from lib import sector_vani as sector


def request(intent='sector.read', **kwargs):
    return SimpleNamespace(intent_id=intent, date='2026-09-10', entity_type='index',
        entity_id=97, sector_category='custom', sector_period=22, explanation_depth='brief',
        sector_snapshot=kwargs.get('snapshot'))


class Database:
    def __init__(self):
        self.calls = []
        self.fast = 20
    def execute(self, sql, params=None):
        self.calls.append((sql, params))
        if 'max(trade_date)' in sql:
            return [{'d':'2026-09-10'}]
        if 'SELECT id,name,category' in sql:
            return [{'id':97,'name':'Example sector','category':'custom'}]
        if 'row_number()' in sql:
            return [dict(index_id=97, trade_date=d, close=100, score_5d=s, score_22d=10,
                         avg_amt_5d=120, avg_amt_22d=100, ret_5d=2, pct_chng=1)
                    for d,s in [('2026-09-09',25),('2026-09-10',self.fast)]]
        if 'JOIN km_equity_symbols' in sql:
            return [dict(id=i, symbol=f'STOCK{i}', company_name=f'Stock {i}',
                score_5d=80 if i==0 else 5, score_22d=5, pct_chng=20 if i==0 else -1,
                ret_5d=2, avg_amt_5d=120, avg_amt_22d=100, flow_type='SHORT_COVERING') for i in range(5)]
        if 'FROM km_index_breadth' in sql:
            return [dict(trade_date='2026-09-10', stock_count=5, pct_above_20=40,
                pct_above_50=60, pct_above_150=80, breadth_score=54, roc_13=-.2, roc_55=.1, sma_breadth=-.4)]
        raise AssertionError(sql)


class SectorContracts(unittest.TestCase):
    def test_zero_scores_can_still_show_outflow(self):
        r=dict(score_5d=0,score_22d=0,avg_amt_5d=80,avg_amt_22d=100,ret_5d=-3)
        self.assertEqual(sector.flow_state(r),'Outflow')
    def test_missing_is_not_quiet(self):
        self.assertEqual(sector.flow_state({'score_5d':None,'score_22d':0}),'Unavailable')
    def test_relative_strength_is_not_daily_acceleration(self):
        db=Database(); context=sector.load_context(request(),db)
        facts=' '.join(context['facts'])
        self.assertIn('ABOVE underlying',facts)
        self.assertIn('DECREASED by 5.00',facts)
        self.assertIn('80.0% of summed positive constituent',facts)
        self.assertIn('not its contribution to the index price return',facts)
        self.assertIn('negative and ABOVE',facts)
    def test_all_reads_bound_to_selected_date(self):
        db=Database(); sector.load_context(request(),db)
        history=next((sql,p) for sql,p in db.calls if 'row_number()' in sql)
        self.assertIn('trade_date <= %s',history[0]); self.assertEqual(history[1][1],'2026-09-10')
        for sql,p in db.calls:
            if 'JOIN km_equity_symbols' in sql: self.assertEqual(p[0],'2026-09-10')
            if 'FROM km_index_breadth' in sql: self.assertEqual(p[1],'2026-09-10')
    def test_same_session_correction_invalidates_snapshot(self):
        db=Database(); before=sector.load_context(request(),db)['snapshot']
        db.fast=21
        self.assertNotEqual(before,sector.load_context(request(),db)['snapshot'])
    def test_context_endpoint_never_calls_llm(self):
        def never(**kwargs): self.fail('LLM should not run')
        out=sector.answer(request('sector.context'),Database(),never,None,None,None)
        self.assertIn('snapshot',out)
    def test_changed_snapshot_blocks_generation(self):
        def never(**kwargs): self.fail('LLM should not run')
        out=sector.answer(request(snapshot='old'),Database(),never,None,None,None)
        self.assertTrue(out['context_changed'])
    def test_cache_miss_qwen_fallback_then_cache_hit_with_feedback(self):
        db=Database(); req=request(snapshot=sector.load_context(request(),db)['snapshot'])
        saved={}; llm=[]; logs=[]
        def complete(**kwargs): llm.append(kwargs); return ('A factual reading.','qwen-local')
        def cache(db,key,*args,**kwargs): saved[key]=args[2]
        def log(**kwargs): logs.append(kwargs); return str(len(logs))
        with patch.object(sector,'get_cached',side_effect=lambda db,key:saved.get(key)), patch.object(sector,'set_cached',side_effect=cache):
            first=sector.answer(req,db,complete,lambda s:(s,False),log,'haiku')
            second=sector.answer(req,db,complete,lambda s:(s,False),log,'haiku')
        self.assertFalse(first['cached']); self.assertTrue(second['cached'])
        self.assertEqual(len(llm),1); self.assertEqual(len(logs),2)
        self.assertTrue(llm[0]['prefer_local']); self.assertTrue(llm[0]['allow_cloud_fallback'])
        self.assertNotEqual(first['log_id'],second['log_id'])
    def test_education_does_not_invoke_llm(self):
        def never(**kwargs): self.fail('LLM should not run')
        with patch.object(sector,'get_cached',return_value=None), patch.object(sector,'set_cached'):
            result=sector.answer(request('sector.learn'),Database(),never,None,lambda **kw:'education','haiku')
        self.assertFalse(result['ai']); self.assertIn('near-term',result['response'])
    def test_rejected_output_is_not_cached(self):
        db=Database(); req=request(snapshot=sector.load_context(request(),db)['snapshot'])
        with patch.object(sector,'get_cached',return_value=None), patch.object(sector,'set_cached') as cache:
            out=sector.answer(req,db,lambda **kw:('bad','qwen-local'),lambda s:('',True),None,'haiku')
        self.assertIn('error',out); cache.assert_not_called()
    def test_invalid_period_rejected(self):
        req=request(); req.sector_period=1000
        self.assertIn('error',sector.answer(req,Database(),None,None,None,None))

    def test_overall_snapshot_ignores_tab_date_and_entity(self):
        snapshots = []
        for tab in ('broad', 'sectoral', 'thematic', 'custom'):
            req = request('sector.pulse.context')
            req.sector_category = tab
            req.date = '2020-01-01'
            req.sector_period = 66
            db = Database()
            context = sector.load_context(req, db)
            snapshots.append(context['snapshot'])
            self.assertEqual(context['date'], '2026-09-10')
            self.assertEqual(context['period'], 22)
            self.assertIsNone(context['index_id'])
            symbols = next(p for sql,p in db.calls if 'SELECT id,name,category' in sql)
            self.assertEqual(symbols, (['sectoral index', 'custom'],))
        self.assertEqual(len(set(snapshots)), 1)
        req.intent_id = 'sector.overview'
        self.assertEqual(sector.load_context(req, Database())['snapshot'], snapshots[0])

    def test_overall_missing_session_does_not_use_stale_row(self):
        class MissingSession(Database):
            def execute(self, sql, params=None):
                rows = super().execute(sql, params)
                if 'row_number()' in sql:
                    return rows[:1]
                return rows
        ctx = sector.load_context(request('sector.pulse.context'), MissingSession())
        self.assertEqual(ctx['rows'], [])
        self.assertEqual(ctx['index_count'], 1)

    def test_overview_only_supplies_group_balance_to_llm(self):
        db=Database(); req=request('sector.overview'); req.entity_id=None
        req.sector_snapshot=sector.load_context(req,db)['snapshot']
        calls=[]
        def complete(**kwargs):
            calls.append(kwargs)
            return ('More indices show entering flow. Inspect their persistence next.','qwen-local')
        with patch.object(sector,'get_cached',return_value=None), patch.object(sector,'set_cached'):
            result=sector.answer(req,db,complete,lambda s:(s,False),lambda **kw:'overview','haiku')
        self.assertNotIn('error',result)
        self.assertIn('Money Entering: 1',calls[0]['user'])
        self.assertNotIn('Example sector',calls[0]['user'])
        self.assertNotIn('constituent',calls[0]['user'])
        self.assertIn('40 words',calls[0]['system'])
        self.assertTrue(calls[0]['prefer_local'])


if __name__ == '__main__': unittest.main()
