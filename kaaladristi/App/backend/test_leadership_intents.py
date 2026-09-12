import unittest
from unittest.mock import patch
from types import SimpleNamespace
from contextlib import nullcontext
from lib import sector_vani as sector
from lib.sector_leadership_intents import intent_facts


def snapshot():
    def row(name,status,flow):
        return dict(name=name,status=status,aligned_streak=4,alignment_history=[],
                    current=dict(weekly=True,monthly=True,eligible=4,total=5,leaders=2,watch=1,leaders_pct=None),flow={'state':flow})
    return dict(snapshot='published',date='2026-09-11',months=6,
                rows=[row('Building example','Building','Building'),row('Cooling example','Cooling','Strong'),
                      row('Running example','Running broadly','Fading')])


class LeadershipIntents(unittest.TestCase):
    def test_questions_select_relevant_examples_and_missing_requirements(self):
        facts=' '.join(intent_facts(snapshot(),'sector.leadership.building'))
        self.assertIn('Building example',facts)
        self.assertNotIn('Cooling example',facts)
        self.assertIn('fewer than 8 completed aligned weeks',facts)
        self.assertIn('fewer than 5 classified stocks',facts)
        flow=' '.join(intent_facts(snapshot(),'sector.leadership.flow'))
        self.assertIn('Cooling example',flow)
        self.assertIn('Running example',flow)
        self.assertNotIn('Building example',flow)

    def test_all_intents_use_snapshot_and_separate_cache_keys(self):
        saved={};calls=[];logs=[]
        def complete(**kw):calls.append(kw);return ('Factual explanation.','qwen-local')
        def save(db,key,intent,digest,text,*args,**kw):saved[key]=text
        with patch('lib.sector_leadership.load_context',return_value=snapshot()), patch.object(sector,'load_context',side_effect=AssertionError('wrong source')), patch.object(sector,'single_flight',return_value=nullcontext()), patch.object(sector,'get_cached',side_effect=lambda db,key:saved.get(key)), patch.object(sector,'set_cached',side_effect=save):
            for suffix in ('','.building','.cooling','.persistence','.support','.flow','.learn'):
                req=SimpleNamespace(intent_id='sector.leadership'+suffix,sector_snapshot='published',explanation_depth='brief')
                for repeat in (False,True):
                    result=sector.answer(req,None,complete,lambda text:(text,False),lambda **kw:logs.append(kw) or 'log','haiku')
                    self.assertNotIn('error',result)
                    self.assertEqual(result['cached'],repeat)
                    self.assertEqual(result['ai'],suffix!='.learn')
        self.assertEqual(len(saved),7)
        self.assertEqual(len(calls),6)
        self.assertEqual(len(logs),14)
        self.assertTrue(all(c['prefer_local'] and c['allow_cloud_fallback'] for c in calls))

    def test_empty_matching_group_and_missing_snapshot(self):
        ctx=snapshot();ctx['rows']=[]
        self.assertIn('0 baskets match', ' '.join(intent_facts(ctx,'sector.leadership.cooling')))
        req=SimpleNamespace(intent_id='sector.leadership.flow',sector_snapshot='old',explanation_depth='brief')
        with patch('lib.sector_leadership.load_context',return_value=snapshot()):
            self.assertTrue(sector.answer(req,None,None,None,None,None)['context_changed'])
        with patch('lib.sector_leadership.load_context',side_effect=ValueError('Longer-term snapshot is being prepared. Please retry after the data refresh.')):
            self.assertIn('snapshot is being prepared',sector.answer(req,None,None,None,None,None)['error'])


if __name__=='__main__':unittest.main()
