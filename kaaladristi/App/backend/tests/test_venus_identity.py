import unittest
from lib.venus_identity import refresh_venus_data


class Cursor:
    def __init__(self, ready=True): self.ready=ready; self.calls=[]
    def execute(self, sql): self.calls.append(sql)
    def fetchone(self):
        if len(self.calls)==1: return ('refresh_venus_event_windows()' if self.ready else None,)
        return (7,)


class VenusIdentityTests(unittest.TestCase):
    def test_missing_migration_never_starts_refresh(self):
        c=Cursor(False)
        with self.assertRaisesRegex(RuntimeError,'235'): refresh_venus_data(c)
        self.assertEqual(len(c.calls),1)

    def test_refresh_uses_canonical_database_owner(self):
        c=Cursor()
        self.assertEqual(refresh_venus_data(c),7)
        self.assertEqual(c.calls[-1],'SELECT public.refresh_venus_event_windows()')


if __name__=='__main__': unittest.main()
