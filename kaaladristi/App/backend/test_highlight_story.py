import unittest
from lib.vani_assemblers import _clean_highlight_facts, build_scanner_cache_context, format_scanner_user_message

class HighlightStory(unittest.TestCase):
 def test_coverage_survives_sanitization_without_arbitrary_fields(self):
  facts=_clean_highlight_facts({'count':6,'readings':{'rsi_available':4,'high_rsi':2,'invented_rule':99}})
  self.assertEqual(facts['readings']['rsi_available'],4)
  self.assertEqual(facts['readings']['high_rsi'],2)
  self.assertIsNone(facts['readings']['rs_available'])
  self.assertNotIn('invented_rule',facts['readings'])
 def test_changed_context_invalidates_the_story(self):
  ctx={'preset_id':'breakout_surge','data_date':'2026-09-11','highlight_facts':_clean_highlight_facts({'count':6,'readings':{'high_rsi':1}})}
  first=build_scanner_cache_context('scanner.why_highlighted',ctx)
  ctx['highlight_facts']=_clean_highlight_facts({'count':6,'readings':{'high_rsi':3}})
  self.assertNotEqual(first,build_scanner_cache_context('scanner.why_highlighted',ctx))
 def test_legacy_payload_does_not_invent_coverage(self):
  self.assertEqual(_clean_highlight_facts({'count':6})['readings'],{})
if __name__=='__main__':unittest.main()
