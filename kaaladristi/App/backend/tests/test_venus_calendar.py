import unittest
from datetime import date, datetime, timezone
from lib.venus_calendar import load_venus_calendar, build_venus_readiness_text


def point(kind, day, hour):
    return dict(event_key=kind+day, event_type=kind,
                display_name='Venus Tara Asta' if kind=='venus_tara_asta' else 'Venus Tara Udaya',
                shape='point',start_date=date.fromisoformat(day),end_date=date.fromisoformat(day),
                start_ts=datetime.fromisoformat(day+'T'+hour+'+05:30'),
                end_ts=datetime.fromisoformat(day+'T'+hour+'+05:30'),
                precision='calculated_visibility_model')


class DB:
    def __init__(self, events, sample=None):
        self.events, self.sample, self.calls = events, sample or [], []

    def execute(self, sql, args):
        self.calls.append((sql,args))
        return self.sample if 'SELECT venus_sign' in sql else self.events


class VenusCalendarTest(unittest.TestCase):
    def test_ist_serialization_and_shapes(self):
        e=point('venus_tara_asta','2026-10-14','18:00:27')
        e['start_ts']=e['start_ts'].astimezone(timezone.utc)
        db=DB([e])
        result=load_venus_calendar(db,'2026-10-01','2026-10-31')
        self.assertEqual(result['markers'][0]['start_ts'],'2026-10-14T18:00:27+05:30')
        self.assertEqual(result['bands'],[])
        self.assertFalse(result['market_day_adjustment'])
        self.assertEqual(db.calls[0][1],(date(2026,10,31),date(2026,10,1)))

    def test_invalid_ranges_do_not_query(self):
        db=DB([])
        for start,end in [('2026-10-31','2026-10-01'),('1990-01-01','2030-01-01')]:
            with self.assertRaises(ValueError): load_venus_calendar(db,start,end)
        self.assertEqual(db.calls,[])

    def test_boundary_day_does_not_claim_all_day_asta(self):
        text=build_venus_readiness_text(DB([point('venus_tara_asta','2026-10-14','18:00:27')]),'2026-10-14')
        self.assertIn('14 Oct 2026 at 18:00 IST',text)
        self.assertNotIn('within the calculated',text)

    def test_period_does_not_duplicate_endpoint(self):
        p=point('venus_tara_asta','2026-10-14','18:00:27')
        p.update(event_type='venus_tara_asta_period',shape='period',
                 end_date=date(2026,10,28),end_ts=datetime.fromisoformat('2026-10-28T06:10:13+05:30'))
        end=point('venus_tara_udaya','2026-10-28','06:10:13')
        text=build_venus_readiness_text(DB([p,end],[{'venus_sign':'Libra','venus_retrograde':True}]),'2026-10-20')
        self.assertIn('retrograde in Libra',text)
        self.assertEqual(text.count('28 Oct 2026 at 06:10 IST'),1)

    def test_crossing_preserves_bracket(self):
        event=dict(event_type='mercury_direct_venus_retrograde_crossing',shape='point',
                   start_date=date(2026,10,7),end_date=date(2026,10,7),start_ts=None,end_ts=None,
                   bracket_start_date=date(2026,10,6),bracket_end_date=date(2026,10,7))
        text=build_venus_readiness_text(DB([event]),'2026-10-04')
        self.assertIn('between 06 Oct 2026 and 07 Oct 2026 (daily-sample bracket)',text)

    def test_empty_is_not_an_invented_state(self):
        self.assertIsNone(build_venus_readiness_text(DB([]),'2040-01-01'))

    def test_missing_schema_is_not_silently_legacy_data(self):
        class Missing:
            def execute(self,*args): raise RuntimeError('missing view')
        with self.assertRaises(RuntimeError): load_venus_calendar(Missing(),'2026-10-01','2026-10-31')


if __name__=='__main__': unittest.main()
