import ast
from pathlib import Path
import unittest
from unittest.mock import Mock
from datetime import datetime, timedelta

SOURCE = Path(__file__).with_name('pipeline2_api.py')
class EvidenceTests(unittest.TestCase):
    def run_endpoint(self, name, responses):
        tree=ast.parse(SOURCE.read_text(encoding='utf-8'))
        node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name==name)
        node.decorator_list=[]
        db=Mock(); db.execute.side_effect=responses
        class Failure(Exception):
            def __init__(self,*args): super().__init__(*args)
        env={'_AI_ENABLED':True,'_AI_OPTIONAL_OK':True,'_db':lambda:db,'_insight_cache':{},'HTTPException':Failure,'logging':Mock(),'datetime':datetime,'timedelta':timedelta,'_VANI_INTENTS':Mock(),'_ai_complete_src':Mock(return_value=('Evidence explanation','test')),'_sebi_post_filter':lambda s:(s,False),'_log_interaction':Mock(),'_AI_MODEL':'test'}
        exec(compile(ast.Module(body=[node],type_ignores=[]),str(SOURCE),'exec'),env)
        result=env[name]()
        return result,db,env
    def test_new_coils_returns_exact_ids_and_date(self):
        result,_,_=self.run_endpoint('fpb_new_coils',[[{'cur_date':'2026-09-11','prior_date':'2026-09-10','now_count':5,'prior_count':4,'new_ids':[17,23],'new_symbols':'A, B'}]])
        self.assertEqual(result['groups'][0]['equity_ids'],[17,23]);self.assertEqual(result['date'],'2026-09-11')
    def test_zero_new_is_valid(self):
        result,_,_=self.run_endpoint('fpb_new_coils',[[{'cur_date':'2026-09-11','prior_date':'2026-09-10','now_count':0,'prior_count':4,'new_ids':[],'new_symbols':''}]])
        self.assertEqual(result['groups'][0]['equity_ids'],[])
    def test_industry_groups_are_query_membership(self):
        result,_,_=self.run_endpoint('fpb_coiling_industries',[[{'max_date':'2026-09-11'}],[{'industry':'Gems','coil_count':2,'equity_ids':[3,4]}],[{'total':2}]])
        self.assertEqual(result['groups'][0]['equity_ids'],[3,4])
    def test_confluence_separates_direction_and_does_not_zero_missing_rs(self):
        result,db,_=self.run_endpoint('fpb_confluence_outlook',[[{'max_date':'2026-09-11'}],[{'equity_id':3,'symbol':'A','rs_5d_change':2}],[{'equity_id':4,'symbol':'B','rs_5d_change':-1}]])
        self.assertEqual([g['equity_ids'] for g in result['groups']],[[3],[4]])
        sql=db.execute.call_args_list[1].args[0]
        self.assertIn('OFFSET 4 LIMIT 1',sql);self.assertNotIn('COALESCE(t.rs_today',sql);self.assertIn('rs_5d_change > 0',sql)
    def test_outcomes_keep_release_identity(self):
        releases=[{'equity_id':3,'symbol':'A','release_date':'2026-09-01','status':'TARGET_HIT'}]
        result,_,_=self.run_endpoint('fpb_recent_outcomes',[[{'max_date':'2026-09-11'}],[{'total':1,'hits':1}],releases])
        self.assertEqual(result['groups'][0]['releases'],releases)
    def test_evidence_failure_is_not_empty_success(self):
        with self.assertRaises(Exception): self.run_endpoint('fpb_new_coils',[RuntimeError('database unavailable')])

if __name__=='__main__': unittest.main()
