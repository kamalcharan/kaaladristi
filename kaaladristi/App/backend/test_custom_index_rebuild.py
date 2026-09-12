"""Exercise the real API rebuild function without importing the application or touching a database."""
import ast
import asyncio
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from typing import Optional
import time
import unittest
from unittest.mock import patch

class HTTPException(Exception):
    def __init__(self,status_code,detail):self.status_code=status_code;self.detail=detail

class Conn:
    def __init__(self, conflict=False, fail_breadth=False):
        self.calls=[];self.conflict=conflict;self.fail_breadth=fail_breadth;self.rev_reads=0;self.closed=False
    def cursor(self,**kwargs):return self
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def execute(self,sql,args=None):
        self.calls.append((sql,args));self.sql=sql
        if self.fail_breadth and 'SELECT compute_index_breadth' in sql:raise RuntimeError('fixture breadth failure')
    def fetchone(self):
        if 'SELECT id, name' in self.sql:return {'id':97,'name':'Test basket'}
        if 'SELECT revision' in self.sql:
            self.rev_reads+=1
            return (3 if self.conflict and self.rev_reads>1 else 2,)
        if 'min(trade_date)' in self.sql:return (date(2020,1,1),)
        return (1,)
    def fetchall(self):return [{'rows_updated':1}]
    def commit(self):self.calls.append(('COMMIT',None))
    def rollback(self):self.calls.append(('ROLLBACK',None))
    def close(self):self.closed=True

def function(conn):
    tree=ast.parse(Path('pipeline2_api.py').read_text(encoding='utf-8'))
    node=next(n for n in tree.body if isinstance(n,ast.AsyncFunctionDef) and n.name=='custom_index_compute')
    node.decorator_list=[]
    env={'Optional':Optional,'_CustomComputeReq':object,'date':date,'time':time,'HTTPException':HTTPException,
         '_conn':lambda **kw:conn,'psycopg2':SimpleNamespace(extras=SimpleNamespace(RealDictCursor=object)),
         'log':SimpleNamespace(warning=lambda *args:None),
         'compute_custom_index_indicators':lambda *args,**kw:conn.calls.append(('INDICATORS',kw)) or 1}
    exec(compile(ast.Module(body=[node],type_ignores=[]),'rebuild-api','exec'),env)
    return env['custom_index_compute']

class RebuildTests(unittest.TestCase):
    def test_successful_rebuild_publishes_on_same_locked_connection(self):
        conn=Conn()
        with patch('lib.sector_leadership.refresh_snapshots',return_value=15) as refresh:
            result=asyncio.run(function(conn)(97))
        refresh.assert_called_once_with(conn)
        self.assertIsNone(result['leadership_refresh_error'])
        self.assertTrue(any('pg_try_advisory_lock(208, 1)' in q for q,p in conn.calls))

    def test_publication_failure_does_not_claim_index_calculation_failed(self):
        conn=Conn()
        with patch('lib.sector_leadership.refresh_snapshots',side_effect=ValueError('snapshot unavailable')):
            result=asyncio.run(function(conn)(97))
        self.assertTrue(result['ok'])
        self.assertEqual(result['leadership_refresh_error'],'snapshot unavailable')

    def test_full_history_and_archive_before_replacement(self):
        conn=Conn();result=asyncio.run(function(conn)(97))
        self.assertTrue(result['ok']);self.assertTrue(conn.closed)
        queries=[q for q,p in conn.calls]
        archive=next(i for i,q in enumerate(queries) if 'INSERT INTO km_custom_index_history_archive' in q)
        delete=next(i for i,q in enumerate(queries) if 'DELETE FROM km_index_eod' in q)
        self.assertLess(archive,delete)
        self.assertIn(('SELECT * FROM compute_custom_index_scores_scoped(%s,%s)',[97,None]),conn.calls)
        breadth=next(p for q,p in conn.calls if 'SELECT compute_index_breadth' in q)
        self.assertEqual(breadth[0],'2020-01-01')
        complete=next(i for i,q in enumerate(queries) if 'SET computed_revision=%s' in q)
        self.assertLess(queries.index('INDICATORS'),complete)
    def test_failed_breadth_leaves_revision_pending(self):
        conn=Conn(fail_breadth=True)
        with self.assertRaises(HTTPException) as raised:asyncio.run(function(conn)(97))
        self.assertEqual(raised.exception.status_code,500)
        self.assertFalse(any('SET computed_revision=%s' in q for q,p in conn.calls))
        self.assertTrue(conn.closed)
    def test_concurrent_membership_change_requires_retry(self):
        conn=Conn(conflict=True)
        with self.assertRaises(HTTPException) as raised:asyncio.run(function(conn)(97))
        self.assertEqual(raised.exception.status_code,409)
        self.assertEqual(conn.calls[-1][0],'ROLLBACK')
    def test_windowed_backfill_does_not_replace_full_history(self):
        conn=Conn();asyncio.run(function(conn)(97,SimpleNamespace(from_date='2026-01-01',to_date='2026-02-01')))
        self.assertFalse(any('DELETE FROM' in q or 'SET computed_revision=%s' in q for q,p in conn.calls))

if __name__=='__main__':unittest.main()
