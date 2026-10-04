import unittest
import ast
from pathlib import Path
from types import SimpleNamespace
from datetime import date, datetime, timezone
from unittest.mock import patch
from lib import astro_events as service


class AstroEventsTests(unittest.TestCase):
    def test_invalid_ranges_do_not_query(self):
        class DB:
            def execute(self, *args):
                raise AssertionError('Should reject before SQL')
        for start, end in [('2026-10-04', '2026-10-01'), ('1990-01-01', '2090-01-01')]:
            with self.assertRaises(ValueError):
                service.occurrences(DB(), start, end)

    def test_exact_timestamp_serialized_in_ist(self):
        value = service.serial({'start_ts': datetime(2026, 10, 14, 12, 30, 27, tzinfo=timezone.utc), 'start_date': date(2026, 10, 14)})
        self.assertEqual(value['start_ts'], '2026-10-14T18:00:27+05:30')
        self.assertEqual(value['start_date'], '2026-10-14')

    def test_narration_preserves_precision_and_does_not_claim_direction(self):
        event = dict(family_id='conjunction', display_name='Mercury–Venus Crossing', start_date='2026-10-07', end_date='2026-10-07',
                     start_ts=None, end_ts=None, shape='point', bracket_start_date='2026-10-06', bracket_end_date='2026-10-07', details={})
        with patch.object(service, 'occurrences', return_value=[event]), patch.object(service, 'families', return_value=[{'id':'conjunction'}]):
            text = service.narration(None, '2026-10-04')
        self.assertIn('daily-sample bracket', text)
        self.assertIn('weekends and holidays', text)
        self.assertNotIn('bullish', text)
        self.assertNotIn('00:00', text)

    def test_no_published_events_no_narration(self):
        with patch.object(service, 'occurrences', return_value=[]):
            self.assertIsNone(service.narration(None, '2026-10-04'))

    def test_publication_requires_admin_and_invalidates_cache(self):
        # Exercise the real handler without importing pipeline workers or a DB driver.
        tree = ast.parse((Path(__file__).parents[1] / 'pipeline2_api.py').read_text(encoding='utf-8'))
        fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'publish_astro_family')
        fn.decorator_list = []
        fn.returns = None
        for arg in fn.args.args:
            arg.annotation = None
        fn.args.defaults = []

        class Connection:
            def __init__(self): self.statements, self.closed = [], False
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def cursor(self): return self
            def execute(self, sql, params=None): self.statements.append((sql, params))
            def fetchone(self): return (1000,)
            def close(self): self.closed = True

        connection = Connection()
        def admin(conn, caller):
            if caller != 'admin': raise PermissionError('Administrator required')
        scope = {'_conn':lambda:connection, '_require_admin':admin}
        exec(compile(ast.fix_missing_locations(ast.Module(body=[fn], type_ignores=[])), '<handler>', 'exec'), scope)
        handler = scope['publish_astro_family']
        with self.assertRaises(PermissionError):
            handler('venus-visibility', SimpleNamespace(catalog_visible=False), 'ordinary-user')
        self.assertEqual(connection.statements, [])
        self.assertTrue(connection.closed)
        handler('venus-visibility', SimpleNamespace(catalog_visible=False), 'admin')
        self.assertEqual(connection.statements[0][1], (False, 'venus-visibility'))
        self.assertIn('DELETE FROM km_vani_cache', connection.statements[1][0])


if __name__ == '__main__':
    unittest.main()
