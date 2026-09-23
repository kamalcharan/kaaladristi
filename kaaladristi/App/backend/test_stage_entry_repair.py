"""
The stage dimension is TWO writes, and a repair that does one is a wrong answer
==============================================================================

`stage_since` / `stage_since_close` / `pct_from_stage_entry` are a FORWARD
CARRY: each bar reads the single prior classified bar and either extends its
run or opens a new one. Three consequences, each of which has now cost a
production outage or was one step from it:

  1. Repairing the `stage` LABEL on a bar does not repair that bar's entry
     trio -- it is still whatever was derived from the label being replaced.
  2. It does not repair any LATER bar either, because each one already stored
     a value carried from the corrupted predecessor.
  3. A bar where the label merely flips BACK breaks the run a second time.
     That echo is the one nobody repairs, because nothing was ever wrong with
     that bar's own inputs.

Measured on the live DB, 2026-09-23, after the 09-16/09-22 cascade deadlock was
repaired with `backfill_stage_classification.py --date ... --full`:

    baseline entries/session   ~450
    2026-09-16                1,395   <- deadlock
    2026-09-17                1,245   <- the ECHO
    2026-09-22                1,379   <- deadlock
    09-22 rows reading stage_since = 09-22 whose stage
    is IDENTICAL to 09-21's:    983   (all S2, all pct_from_stage_entry 0.00)

These tests run no DB and no network. They read the source, because what broke
is WIRING -- two functions that must be called together, and an order that must
be ascending -- and wiring is invisible to a type and to any fixture.
"""

import ast
import os
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
_STAGE = os.path.join(_HERE, 'scripts', 'backfill_stage_classification.py')
_ENTRY = os.path.join(_HERE, 'scripts', 'backfill_stage_entry.py')


def _src(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def _func(path, name):
    """The AST of one top-level function, so assertions cannot match a comment
    or a docstring elsewhere in the file -- the trap that made an earlier
    wiring test pass against the very code it was written to catch."""
    for node in ast.parse(_src(path)).body:
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return node
    raise AssertionError(f'{name}() not found in {os.path.basename(path)}')


def _calls(node):
    out = []
    for n in ast.walk(node):
        if isinstance(n, ast.Call):
            f = n.func
            out.append(f.id if isinstance(f, ast.Name)
                       else f.attr if isinstance(f, ast.Attribute) else '')
    return out


class RepairWritesTheWholeDimension(unittest.TestCase):
    """pipeline2 runs stage + entry as ONE unit. The manual repair path must
    too, or a hand-repaired bar keeps an entry date derived from the label
    that was just replaced."""

    def test_run_date_runs_the_entry_carry(self):
        calls = _calls(_func(_STAGE, 'run_date'))
        self.assertIn('compute_stage_entry_for_date', calls,
                      'run_date() repairs `stage` and must also recompute the '
                      'entry trio -- exactly as handle_stage_classification does')

    def test_run_date_names_the_follow_up_for_later_bars(self):
        calls = _calls(_func(_STAGE, 'run_date'))
        self.assertIn('_warn_if_later_bars_exist', calls,
                      'repairing a past bar leaves every LATER bar carrying the '
                      'old answer; the script must say so')

    def test_the_handler_still_pairs_them(self):
        """The precedent this mirrors. If pipeline2 ever stops pairing them,
        these tests are guarding a rule the product no longer follows."""
        h = _src(os.path.join(_HERE, 'pipeline2', 'handlers.py'))
        fn = _func(os.path.join(_HERE, 'pipeline2', 'handlers.py'),
                   'handle_stage_classification')
        calls = _calls(fn)
        self.assertIn('compute_stage_for_date', calls)
        self.assertIn('compute_stage_entry_for_date', calls)
        self.assertIn('backfill_stage_entry', h)


class ReplayIsAChain(unittest.TestCase):
    """The carry reads the bar before it. Replaying out of order, or skipping a
    session inside the range, writes a wrong answer with no error."""

    def setUp(self):
        self.fn = _func(_ENTRY, 'replay_range')
        self.src = ast.unparse(self.fn)

    def test_dates_come_from_the_table_ascending(self):
        self.assertIn('ORDER BY trade_date', self.src,
                      'the replay must be ascending -- a descending or arbitrary '
                      'order hands a bar a predecessor holding the old value')
        self.assertNotIn('DESC', self.src)

    def test_dates_are_read_not_generated(self):
        """A generated calendar guesses holidays and half-days wrong, and a
        skipped session breaks the chain silently."""
        self.assertIn('FROM km_equity_eod', self.src)
        self.assertIn("stage IS NOT NULL", self.src)
        self.assertNotIn('timedelta', self.src)

    def test_it_calls_the_real_nightly_carry(self):
        self.assertIn('compute_stage_entry_for_date', _calls(self.fn),
                      'the replay must reuse the nightly function, not restate '
                      'the rule -- two implementations of one carry is how the '
                      'rebuild and the nightly path start to disagree')

    def test_default_end_is_the_latest_bar(self):
        self.assertIn('max(trade_date)', self.src,
                      'stopping short of the latest bar leaves every later '
                      'session carrying the value it derived from the old data')

    def test_a_short_replay_warns(self):
        self.assertIn('latest', self.src)
        self.assertRegex(self.src, r'(?s)dates\[-1\].*!=.*|.*!=.*dates\[-1\]')


class EntrypointIsReachable(unittest.TestCase):
    """main() is defined ABOVE compute_stage_entry_for_date in the file. The
    entrypoint used to sit between them, so main() ran before the name existed
    -- harmless until main() called it, then a NameError on every --from run."""

    def test_entrypoint_is_last(self):
        tree = ast.parse(_src(_ENTRY))
        defs = [n.lineno for n in tree.body
                if isinstance(n, ast.FunctionDef) and n.name in
                ('replay_range', 'compute_stage_entry_for_date', 'main')]
        guards = [n.lineno for n in tree.body if isinstance(n, ast.If)]
        self.assertTrue(guards, "no `if __name__ == '__main__'` guard found")
        self.assertGreater(max(guards), max(defs),
                           'the __main__ guard must come after every function '
                           'main() can reach, or the call is a NameError')

    def test_from_and_to_are_wired(self):
        calls = _calls(_func(_ENTRY, 'main'))
        self.assertIn('replay_range', calls)
        self.assertIn("'--from'", _src(_ENTRY))
        self.assertIn("'--to'", _src(_ENTRY))


if __name__ == '__main__':
    unittest.main(verbosity=2)
