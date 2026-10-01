"""Routing kinds the scanner contract derives from scanEngine.ts (no DB).

Pins the 2026-09-29 fix: a fetcher that reads km_scan_results ABOUT OTHER
presets (fetchStandouts counts same-side flags across the arms) is 'derived',
not matview-served — the contract check had reported standouts and
standouts_caution as arms the matview fails to produce, every night since
migration 223, which kept integrity_checks critical and the pipeline banner red.
"""
import unittest

from lib import scan_contract as sc


class RoutingKinds(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.routes = sc.routing()

    def test_standouts_are_derived_not_served(self):
        for pid in ('standouts', 'standouts_caution'):
            self.assertEqual(self.routes.get(pid), 'derived', pid)
            self.assertNotIn(pid, sc.matview_served(), pid)

    def test_matview_served_presets_still_resolve(self):
        # fetchFromScanMatview filters `.eq('preset_id', presetId)` — that is
        # what makes a preset SERVED by the matview rather than derived over it.
        self.assertEqual(self.routes.get('breakout_surge'), 'matview')
        self.assertIn('breakout_surge', sc.matview_served())

    def test_other_kinds_unchanged(self):
        self.assertEqual(self.routes.get('waking_giants'), 'journeys')
        self.assertEqual(self.routes.get('stage_2_leaders'), 'live')

    def test_derived_requires_missing_own_preset_filter(self):
        # A synthetic engine: preset a reads its own rows, preset b reads the
        # matview about other presets. Only a is served.
        src = """
        const WG_JOURNEY_PRESETS = {
          waking_giants: 'WAKING',
        }
        const MATVIEW_BUNDLE_PRESETS = new Set(['power_buy'])
        export async function executeScan(scanId) {
          if (scanId === 'a') return fetchA(x);
          if (scanId === 'b') return fetchB(x);
          if (WG_JOURNEY_PRESETS[scanId]) return fetchWg(x);
          if (MATVIEW_BUNDLE_PRESETS.has(scanId)) return fetchFromScanMatview(x);
        }
        async function fetchA(x) { const r = await from('km_scan_results').select('*').eq('preset_id', presetId); }
        async function fetchB(x) { const r = await from('km_scan_results').select('equity_id,preset_id').in('preset_id', ids); }
        async function fetchWg(x) { return from('km_wg_journeys').select('*'); }
        async function fetchFromScanMatview(x) { return from('km_scan_results').select('*').eq('preset_id', presetId); }
        """
        # studio_descriptors() reads the real file; the synthetic engine only
        # needs the executeScan walk, so patch the descriptor lookup to empty
        # matview sources would trip _require — keep the real one.
        routes = sc.routing(src)
        self.assertEqual(routes['a'], 'matview')
        self.assertEqual(routes['b'], 'derived')
        self.assertEqual(routes['waking_giants'], 'journeys')


class ArmFindingsTests(unittest.TestCase):
    """2026-10-01: quiet_accumulation was empty after a broad fall and the
    night went critical. Empty-but-defined is a warning; undefined is critical."""
    VIEWDEF = "SELECT 'quiet_accumulation'::text AS preset_id ... UNION ALL SELECT 'smart_money'::text"

    def test_defined_but_empty_is_a_warning(self):
        from lib.integrity_checks import arm_findings
        f = arm_findings({'quiet_accumulation', 'smart_money'}, {'smart_money'}, self.VIEWDEF)
        self.assertEqual([(x.check_key, x.severity) for x in f],
                         [('contract_arm_empty_quiet_accumulation', 'warning')])

    def test_undefined_arm_stays_critical(self):
        from lib.integrity_checks import arm_findings
        f = arm_findings({'new_preset'}, set(), self.VIEWDEF)
        self.assertEqual([(x.check_key, x.severity) for x in f],
                         [('contract_arm_missing_new_preset', 'critical')])

    def test_unreadable_definition_fails_loud(self):
        from lib.integrity_checks import arm_findings
        self.assertEqual(arm_findings({'quiet_accumulation'}, set(), '')[0].severity, 'critical')


if __name__ == '__main__':
    unittest.main()
