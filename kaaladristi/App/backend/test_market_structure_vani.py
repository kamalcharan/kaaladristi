"""Offline regression tests: no VPS, database or model access."""
import copy
import threading
import time
import unittest
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch

from lib import market_structure_vani as v


class MarketStructureTests(unittest.TestCase):
    def setUp(self):
        self.breadth = [dict(trade_date='2026-09-10', pct_above_20=40, pct_above_50=50,
                             pct_above_150=60, breadth_score=47, stock_count=3000),
                        dict(trade_date='2026-09-11', pct_above_20=36, pct_above_50=50,
                             pct_above_150=62, breadth_score=44.8, stock_count=3000)]
        self.roc = [dict(trade_date='2026-09-11', roc_13=.0235, roc_55=.0596,
                         sma_breadth=.0700, stock_count=3069)]
        self.cache, self.logs, self.calls = {}, [], []
        def select(table, *args, **kwargs):
            return copy.deepcopy(list(reversed(self.breadth if table == 'km_market_breadth' else self.roc)))
        self.db = SimpleNamespace(select=select)
        self.req = SimpleNamespace(intent_id='structure.momentum', date=None, structure_period=66,
                                   structure_snapshot=v.snapshot(self.breadth, self.roc), explanation_depth='brief')
        self.patches = [patch.object(v, 'get_cached', side_effect=lambda db, key: self.cache.get(key)),
                        patch.object(v, 'set_cached', side_effect=lambda db, key, intent, h, text, ttl, **kw: self.cache.update({key: text}))]
        for p in self.patches:
            p.start()
            self.addCleanup(p.stop)

    def complete(self, **kwargs):
        self.calls.append(kwargs)
        return 'ROC 13 is positive but below its signal. Momentum is fading relative to signal.', 'qwen'

    def log(self, **kwargs):
        self.logs.append(kwargs)
        return f'log-{len(self.logs)}'

    def answer(self, **kwargs):
        return v.answer(self.req, self.db, kwargs.get('complete', self.complete),
                        kwargs.get('post_filter', lambda text: (text, False)), self.log, 'configured-model')

    def test_cache_hit_has_own_feedback_log_and_only_one_model_call(self):
        first, second = self.answer(), self.answer()
        self.assertFalse(first['cached'])
        self.assertTrue(second['cached'])
        self.assertEqual(len(self.calls), 1)
        self.assertNotEqual(first['log_id'], second['log_id'])
        self.assertTrue(self.calls[0]['prefer_local'])
        self.assertTrue(self.calls[0]['no_think'])
        self.assertTrue(self.calls[0]['allow_cloud_fallback'])

    def test_busy_worker_returns_pending_without_duplicate_model(self):
        @contextmanager
        def busy(*args):
            raise v.ReadingInProgress()
            yield
        with patch.object(v, 'single_flight', busy):
            self.assertTrue(self.answer()['pending'])
        self.assertEqual(self.calls, [])

    def test_explicit_cloud_fallback_and_legacy_qwen_only_routing(self):
        from lib import ai_client
        events = []
        def local(*args):
            events.append('qwen')
            return None
        def cloud(*args):
            events.append('cloud')
            return 'fallback explanation'
        with patch.object(ai_client, '_fallback_complete', local), patch.object(ai_client, '_primary_complete', cloud):
            self.assertEqual(ai_client.complete_with_source('s', 'u', prefer_local=True), (None, None))
            self.assertEqual(events, ['qwen'])
            events.clear()
            result = ai_client.complete_with_source('s', 'u', prefer_local=True, allow_cloud_fallback=True)
            self.assertEqual(events, ['qwen', 'cloud'])
            self.assertEqual(result, ('fallback explanation', ai_client.AI_PROVIDER))
        with patch.object(ai_client, '_fallback_complete', return_value='local explanation'), patch.object(ai_client, '_primary_complete') as cloud_mock:
            self.assertEqual(ai_client.complete_with_source('s', 'u', prefer_local=True, allow_cloud_fallback=True), ('local explanation', 'qwen-local'))
            cloud_mock.assert_not_called()

    def test_precomputed_comparisons_match_fading_positive_example(self):
        facts = '\n'.join(self.answer()['facts'])
        self.assertIn('BELOW the five-session signal', facts)
        self.assertIn('fading relative to signal, while still positive', facts)
        self.assertIn('4.0 percentage points lower', facts)
        self.assertIn('20 EMA is LOWER THAN participation above 50 EMA', facts)

    def test_same_date_correction_rejects_old_snapshot_before_model(self):
        self.answer()
        self.roc[0]['roc_13'] = .023500001
        result = self.answer()
        self.assertTrue(result['context_changed'])
        self.assertEqual(len(self.calls), 1)
        self.req.structure_snapshot = v.snapshot(self.breadth, self.roc)
        self.assertFalse(self.answer()['cached'])
        self.assertEqual(len(self.calls), 2)

    def test_depth_and_period_do_not_reuse_other_readings(self):
        self.answer()
        self.req.explanation_depth = 'detailed'
        self.answer()
        self.req.structure_period = 22
        self.answer()
        self.assertEqual(len(self.calls), 3)

    def test_static_education_never_invokes_model_or_loads_market(self):
        self.req.intent_id = 'structure.fear_greed'
        self.db.select = lambda *a, **kw: self.fail('Static explanation fetched live data')
        self.assertFalse(self.answer()['ai'])
        self.req.explanation_depth = 'detailed'
        self.assertTrue(self.answer()['cached'])
        self.assertEqual(self.calls, [])

    def test_mismatch_dates_missing_zero_and_negative_recovery(self):
        self.roc[0].update(trade_date='2026-09-10', roc_13=-.01, sma_breadth=-.02, roc_55=None)
        facts = '\n'.join(v.derive_facts(self.breadth, self.roc))
        self.assertIn('recovering relative to signal, while still negative', facts)
        self.assertIn('different latest dates', facts)
        self.assertIn('ROC 55 is unavailable', facts)
        self.roc[0]['roc_13'] = 0
        self.assertIn('quiet relative to signal', '\n'.join(v.derive_facts([], self.roc)))
        self.roc[0]['roc_13'] = None
        self.assertIn('momentum cannot be classified', '\n'.join(v.derive_facts([], self.roc)))

    def test_rejected_or_failed_model_does_not_populate_cache(self):
        result = self.answer(post_filter=lambda text: (None, True))
        self.assertIn('error', result)
        self.assertTrue(result['facts'])
        self.assertEqual(self.cache, {})
        def failed(**kwargs):
            raise RuntimeError('private provider failure')
        result = self.answer(complete=failed)
        self.assertTrue(result['facts'])
        self.assertNotIn('private provider failure', str(result))

    def test_fallback_provider_result_uses_same_cache(self):
        result = self.answer(complete=lambda **kwargs: ('Verified explanation.', 'haiku'))
        self.assertEqual(result['provider'], 'haiku')
        self.assertTrue(self.answer()['cached'])
        self.assertEqual(self.calls, [])

    def test_invalid_intent_period_and_date_do_not_call_model(self):
        for key, value in [('intent_id', 'structure.unknown'), ('structure_period', 5), ('date', 'invalid')]:
            old = getattr(self.req, key)
            setattr(self.req, key, value)
            self.assertIn('error', self.answer())
            setattr(self.req, key, old)
        self.assertFalse(self.calls)

    def test_concurrent_first_requests_share_generation(self):
        gate = threading.Barrier(4)
        def slow(**kwargs):
            time.sleep(.05)
            return self.complete(**kwargs)
        def run(_):
            gate.wait()
            return self.answer(complete=slow)
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(run, range(4)))
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(sum(r['cached'] for r in results), 3)
        self.assertEqual(len({r['log_id'] for r in results}), 4)


if __name__ == '__main__':
    unittest.main()
