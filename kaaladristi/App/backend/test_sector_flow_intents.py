import unittest
from unittest.mock import patch
from lib.sector_flow_intents import build_views, intent_facts, INTENTS
from lib import sector_vani as sector
from test_sector_vani import Database, request


def row(id, fast=30, slow=10, date='2026-09-10', **kwargs):
    return dict(index_id=id,name=f'Basket {id}',trade_date=date,score_5d=fast,score_22d=slow,
                avg_amt_5d=kwargs.get('amount',120),avg_amt_22d=100,ret_5d=kwargs.get('ret',2))


def context(rows, history=None, total=None):
    return dict(rows=rows,history=history if history is not None else rows,date='2026-09-10',
                category='custom',period=22,index_count=total if total is not None else len(rows))


class IntentContracts(unittest.TestCase):
    def test_groups_keep_quiet_and_missing_separate(self):
        ctx=context([row(1),row(2,5),row(3,5,20),row(4,0,0,amount=80,ret=-2),row(5,0,0),row(6,None)],total=7)
        views=build_views(ctx)
        self.assertEqual(views['sector.entering']['matching_ids'],[1])  # 5 below baseline is Fading
        self.assertEqual(views['sector.fading']['matching_ids'],[2,3])
        self.assertEqual(views['sector.leaving']['matching_ids'],[4])
        self.assertEqual(views['sector.read']['unavailable'],2)
        self.assertNotIn(6,views['sector.compare']['matching_ids'])
    def test_building_counts_as_entering_and_runs_do_not_cross_gaps(self):
        rows=[row(1,5,2),row(2)]
        history=[row(1,30,date='2026-09-08'),row(2,date='2026-09-09'),*rows]
        view=build_views(context(rows,history))['sector.persistence']
        example=next(r for r in view['examples'] if r['id']==1)
        self.assertEqual(example['run'],1)
        self.assertEqual(example['cells'][1]['state'],'Unavailable')
        self.assertEqual(example['cells'][0]['date'],'2026-09-10')
    def test_empty_matching_group_is_not_whole_category(self):
        view=build_views(context([row(1,0,0)]))['sector.entering']
        self.assertEqual(view['matching_ids'],[])
        self.assertIn('No entering',view['title'])
    def test_examples_capped_but_personal_scope_complete(self):
        view=build_views(context([row(i) for i in range(10)]))['sector.entering']
        self.assertEqual(len(view['examples']),3)
        self.assertEqual(len(view['matching_ids']),10)
    def test_future_history_excluded(self):
        view=build_views(context([row(1)],[row(1),row(1,date='2026-09-11')]))['sector.persistence']
        self.assertEqual(view['examples'][0]['sessions'],1)
    def test_all_main_questions_are_available_from_context(self):
        req=request('sector.context'); req.entity_id=None
        ctx=sector.load_context(req,Database())
        self.assertEqual(set(ctx['intent_views']),set(INTENTS))
    def test_llm_uses_matching_facts_and_existing_cache_routing(self):
        for intent in ('sector.entering','sector.fading','sector.leaving','sector.persistence','sector.compare'):
            db=Database(); req=request(intent); req.entity_id=None
            ctx=sector.load_context(req,db);req.sector_snapshot=ctx['snapshot']
            calls=[]
            with patch.object(sector,'get_cached',return_value=None),patch.object(sector,'set_cached'):
                result=sector.answer(req,db,lambda **kw:(calls.append(kw) or ('Grounded explanation.','qwen-local')),lambda s:(s,False),lambda **kw:'id','haiku')
            self.assertNotIn('error',result)
            self.assertIn(ctx['intent_views'][intent]['title'],calls[0]['user'])
            self.assertTrue(calls[0]['prefer_local'])
            self.assertTrue(calls[0]['allow_cloud_fallback'])
            self.assertNotIn('flow states:',calls[0]['user'])
    def test_facts_do_not_claim_daily_acceleration(self):
        ctx=context([row(1)]);ctx['intent_views']=build_views(ctx)
        self.assertIn('neither a return percentage nor a change since yesterday',' '.join(intent_facts(ctx,'sector.compare')))

if __name__=='__main__':unittest.main()
