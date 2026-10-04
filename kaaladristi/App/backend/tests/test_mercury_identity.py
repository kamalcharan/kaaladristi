"""No database or ephemeris dependencies: python -m unittest discover -s tests -p test_mercury_identity.py"""
import unittest
from lib.mercury_identity import RULE_EVENTS, canonical_snapshot, assert_identity_ready


class Cursor:
    def __init__(self, present=True, rows=None):
        self.present = present
        self.rows = rows if rows is not None else [(k,v,'defined',v,True) for k,v in RULE_EVENTS.items()]
    def execute(self, *args): pass
    def fetchone(self): return ('km_astro_rule_event_map' if self.present else None,)
    def fetchall(self): return self.rows


class MercuryIdentityTests(unittest.TestCase):
    def test_station_is_not_manifestation_and_input_is_preserved(self):
        old={'event':'mercury_station_direct','rule_type':'manifestation'}
        new=canonical_snapshot(old)
        self.assertEqual(new['event_type'],'mercury_turns_direct')
        self.assertEqual(new['rule_type'],'motion_transition')
        self.assertEqual(old['rule_type'],'manifestation')

    def test_sign_journey_not_manifestation(self):
        new=canonical_snapshot({'rule_type':'sign_transit','sign':'Gemini'})
        self.assertEqual(new['event_type'],'mercury_sign_journey')
        self.assertEqual(new['sign'],'Gemini')

    def test_visibility_provenance_survives(self):
        old={'rule_type':'combust','detect':'visibility_v3','combust_source':'almanac_ujjain','conjunction':'inferior'}
        new=canonical_snapshot(old)
        self.assertTrue(all(new[k]==v for k,v in old.items()))
        self.assertEqual(new['event_type'],'mercury_combustion')

    def test_co_retrograde_not_relabelled_plain_motion(self):
        old={'rule_type':'retrograde','co_planet':'Venus'}
        self.assertEqual(canonical_snapshot(old),old)

    def test_migration_required_before_regeneration(self):
        with self.assertRaisesRegex(RuntimeError,'234'):
            assert_identity_ready(Cursor(present=False))

    def test_missing_mapping_rejected(self):
        with self.assertRaisesRegex(RuntimeError,'mismatch'):
            assert_identity_ready(Cursor(rows=[]))

    def test_drift_in_name_or_type_rejected(self):
        for column,value in [(1,'mercury_manifestation'),(2,'pending'),(3,'mercury_manifestation'),(4,False)]:
            rows=[list(r) for r in Cursor().rows]
            rows[0][column]=value
            with self.subTest(column=column), self.assertRaisesRegex(RuntimeError,'mismatch'):
                assert_identity_ready(Cursor(rows=[tuple(r) for r in rows]))

    def test_ready_registry(self):
        assert_identity_ready(Cursor())


if __name__ == '__main__': unittest.main()
