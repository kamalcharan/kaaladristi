"""Exercise the real daily orchestrator without importing database handlers."""
import ast
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch


def daily(status):
    tree=ast.parse(Path('pipeline2/orchestrator.py').read_text(encoding='utf-8'))
    names={'StepOutcome','RunOutcome','run_daily'}
    selected=[n for n in tree.body if
              isinstance(n,ast.ImportFrom) and n.module=='__future__' or
              isinstance(n,(ast.ClassDef,ast.FunctionDef)) and n.name in names]
    result=SimpleNamespace(status=status,fill_rate_before=0,fill_rate_after=100,rows_affected=1,error_msg=None)
    env={'dataclass':dataclass,'field':field,'date':date,'CRITICAL_STEPS':{'index_eod_download'},
         'DAILY_STEPS':[('index_eod_download',None)],'handlers':SimpleNamespace(handle=lambda *args:result)}
    exec(compile(ast.Module(body=selected,type_ignores=[]),'daily-test','exec'),env)
    return env['run_daily']


class PipelineTests(unittest.TestCase):
    def test_completed_pipeline_publishes_selected_session(self):
        conn=SimpleNamespace(rollback=lambda:None)
        with patch('lib.sector_leadership.refresh_snapshots',return_value=15) as refresh:
            result=daily('completed')(conn,date(2026,9,11),lambda *args:None)
        refresh.assert_called_once_with(conn,'2026-09-11')
        self.assertEqual(result.steps[-1].dimension,'leadership_snapshot')
        self.assertEqual(result.overall_status,'completed')

    def test_incomplete_sources_do_not_publish(self):
        with patch('lib.sector_leadership.refresh_snapshots') as refresh:
            result=daily('partial')(SimpleNamespace(),date(2026,9,11),lambda *args:None)
        refresh.assert_not_called()
        self.assertEqual(result.overall_status,'partial')

    def test_publication_error_is_visible_in_pipeline_outcome(self):
        with patch('lib.sector_leadership.refresh_snapshots',side_effect=ValueError('pending baskets')):
            result=daily('completed')(SimpleNamespace(rollback=lambda:None),date(2026,9,11),lambda *args:None)
        self.assertEqual(result.overall_status,'partial')
        self.assertEqual(result.steps[-1].error_msg,'pending baskets')


if __name__=='__main__':unittest.main()
