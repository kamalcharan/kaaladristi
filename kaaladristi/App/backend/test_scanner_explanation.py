import unittest
from lib.scanner_explanation import with_depth, style
from lib.vani_cache import make_cache_key
class ScannerExplanation(unittest.TestCase):
 def test_each_depth_has_its_own_versioned_cache(self):
  keys=[make_cache_key('scanner.momentum_gap',with_depth({'v':2,'date':'2026-09-11'},'breakout_surge',d)) for d in ('brief','simple','detailed')]
  self.assertEqual(len(set(keys)),3)
  self.assertNotIn(make_cache_key('scanner.momentum_gap',{'v':2,'date':'2026-09-11'}),keys)
 def test_other_scanners_keep_existing_context(self):
  ctx={'v':2};self.assertIs(with_depth(ctx,'weekly_movers','brief'),ctx)
 def test_invalid_depth_is_rejected(self):
  with self.assertRaises(ValueError):with_depth({},'breakout_surge','unknown')
 def test_styles_change_meaning_not_just_length(self):
  self.assertIn('CONCISE',style('brief'));self.assertIn('Define relevant terminology',style('simple'));self.assertIn('supporting evidence',style('detailed'))
  for depth in ('brief','simple','detailed'):
   self.assertIn('not change since yesterday',style(depth));self.assertIn('Do not infer Greed/Fear',style(depth))
if __name__=='__main__':unittest.main()
