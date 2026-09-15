"""Discovery Phase 3b — the shared turn, and the stirring tally's honest shape.

    python -m unittest test_journey_fields

No DB, no network. `turn_at` and `stir_days_map` are extracted from the real
`compute_wg_journeys.py` so the production code is what runs.

Two things are under test, and each exists because the plan was wrong about it:

  1. THE TURN WAS COMPUTED IN ONE PLACE AND WRITTEN IN ANOTHER. The snapshot
     had it inline; archived rows were written with turn_date NULL. 560 current
     rows carry a turn and 0 archived ones do, so a closed journey could never
     show where its turn was. The plan said "persist turn_date at archive" as
     though it were a copy — but the snapshot's turn is explicitly "a property
     of NOW, anchored to the CURRENT unbroken run above the Golden Line", which
     a closed arc does not have. It is a derivation, and now a shared one.

  2. `stir_start_date` DOES NOT EXIST AND MUST NOT. `stir_days` is a tally over
     the last 60 bars, not a run: 9.4 qualifying bars across a 41.3-bar span on
     the measured population, 2.8% contiguous. A "start date" would read as
     continuous stirring for 97% of stocks.
"""

import ast
import unittest
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

SRC = Path('scripts/compute_wg_journeys.py').read_text(encoding='utf-8')


def _executable(src: str) -> str:
    """Source with comments and docstrings stripped.

    Prose is allowed to NAME the thing it refuses — this file and the module
    both explain at length why `stir_start_date` does not exist — so a bare
    substring search over the whole file flags its own explanation. Same trap
    the journey QA check hit when a JSDoc citing "348 of 595" tripped the
    no-hardcoded-base-rates assertion.
    """
    tree = ast.parse(src)
    docstrings = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            d = ast.get_docstring(node, clean=False)
            if d:
                docstrings.add(d)
    out = []
    for line in src.split('\n'):
        stripped = line.split('#', 1)[0] if line.lstrip().startswith('#') else line
        out.append(stripped)
    text = '\n'.join(out)
    for d in docstrings:
        text = text.replace(d, '')
    return text


def _load_stir_days_map():
    """Execute the real stir_days_map with only the constants it reads."""
    tree = ast.parse(SRC)
    fn = next(n for n in tree.body
              if isinstance(n, ast.FunctionDef) and n.name == 'stir_days_map')
    env = {'pd': pd, 'STIR_DELIV_FLOOR': 45.0, 'STIR_DELIV_MULT': 1.15,
           'STIR_MAX_ABS_PCT': 2.5, 'STIR_MAX_RVOL': 2.5}
    exec(compile(ast.Module(body=[fn], type_ignores=[]), 'stir-test', 'exec'), env)
    return env['stir_days_map']


stir_days_map = _load_stir_days_map()


def make_turn_at(closes, gl, w_known, w_green, idx):
    """Rebuild turn_at's closure from the real source, with the arrays it
    captures bound to fixtures. Extracted rather than reimplemented — a test
    that rewrites the logic tests only itself."""
    body = SRC[SRC.index('    def turn_at(i):'):SRC.index('    def base_years_at(i):')]
    src = '\n'.join(line[4:] if line.startswith('    ') else line
                    for line in body.split('\n'))
    env = {'np': np, 'vals': np.array(closes, dtype=float),
           'gl_arr': np.array(gl, dtype=float),
           'w_known': np.array(w_known, dtype=bool),
           'w_green': np.array(w_green, dtype=bool),
           'idx': pd.to_datetime(idx), 'n': len(closes)}
    exec(compile(src, 'turn-test', 'exec'), env)
    return env['turn_at']


DAYS = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09',
        '2026-01-12', '2026-01-13', '2026-01-14']


class TestTurnAt(unittest.TestCase):
    def test_first_weekly_green_of_the_containing_run(self):
        #            0    1    2    3    4    5    6    7
        closes =   [ 90,  95, 105, 106, 107, 108, 109, 110]
        gl =       [100, 100, 100, 100, 100, 100, 100, 100]
        #  above the line from bar 2 on; weekly green from bar 3
        w_known =  [ 1,   1,   1,   1,   1,   1,   1,   1]
        w_green =  [ 0,   0,   0,   1,   1,   1,   1,   1]
        t = make_turn_at(closes, gl, w_known, w_green, DAYS)
        d, c = t(7)
        self.assertEqual(d, date(2026, 1, 8), 'the turn is the run’s first weekly-green bar')
        self.assertEqual(c, 106.0)

    def test_a_broken_run_resets_the_turn(self):
        """The run is unbroken by construction — a dip below the line starts a
        new one, so the turn cannot be inherited from before the break."""
        closes =   [105, 106,  95, 104, 105, 106, 107, 108]
        gl =       [100, 100, 100, 100, 100, 100, 100, 100]
        w_known =  [ 1,   1,   1,   1,   1,   1,   1,   1]
        w_green =  [ 1,   1,   1,   1,   1,   1,   1,   1]
        t = make_turn_at(closes, gl, w_known, w_green, DAYS)
        self.assertEqual(t(7)[0], date(2026, 1, 8), 'run restarts at bar 3, not bar 0')

    def test_below_the_line_has_no_turn(self):
        t = make_turn_at([95] * 8, [100] * 8, [1] * 8, [1] * 8, DAYS)
        self.assertEqual(t(7), (None, None))

    def test_run_with_no_weekly_green_has_no_turn(self):
        t = make_turn_at([105] * 8, [100] * 8, [1] * 8, [0] * 8, DAYS)
        self.assertEqual(t(7), (None, None))

    def test_unknown_weekly_clock_is_not_green(self):
        """w_known gates w_green — an unmeasured clock must not read as a turn."""
        t = make_turn_at([105] * 8, [100] * 8, [0] * 8, [1] * 8, DAYS)
        self.assertEqual(t(7), (None, None))

    def test_nan_golden_line_has_no_turn(self):
        gl = [float('nan')] * 8
        t = make_turn_at([105] * 8, gl, [1] * 8, [1] * 8, DAYS)
        self.assertEqual(t(7), (None, None))

    def test_same_function_answers_for_an_archived_wake_bar(self):
        """THE POINT OF EXTRACTING IT. Asked at an interior (wake) bar it
        returns that arc's turn, not the latest one — so a closed journey can
        finally say where its turn was."""
        closes =  [ 95, 104, 105, 106,  94, 103, 108, 110]
        gl =      [100, 100, 100, 100, 100, 100, 100, 100]
        w_known = [  1,   1,   1,   1,   1,   1,   1,   1]
        w_green = [  0,   1,   1,   1,   1,   1,   1,   1]
        t = make_turn_at(closes, gl, w_known, w_green, DAYS)
        self.assertEqual(t(3)[0], date(2026, 1, 6), 'first arc turned at bar 1')
        self.assertEqual(t(7)[0], date(2026, 1, 12), 'second arc turned at bar 5')
        self.assertNotEqual(t(3), t(7), 'two arcs must not share one turn')

    def test_returns_a_python_float(self):
        """vals[j] is a numpy.float64; under numpy>=2 its repr is
        'np.float64(106.0)', which psycopg2 binds verbatim and Postgres reads
        as a schema name. The cast lives inside the helper now."""
        t = make_turn_at([105.0] * 8, [100.0] * 8, [1] * 8, [1] * 8, DAYS)
        self.assertIsInstance(t(7)[1], float)
        self.assertNotIsInstance(t(7)[1], np.floating)


def _bars(rows):
    """rows: list of (date, delivery_pct, pct_chng, rvol)."""
    return pd.DataFrame(
        [{'equity_id': 1, 'trade_date': pd.Timestamp(d), 'delivery_pct': dp,
          'pct_chng': pc, 'rvol': rv} for d, pc, dp, rv in
         [(r[0], r[2], r[1], r[3]) for r in rows]])


class TestStirTally(unittest.TestCase):
    def test_returns_count_first_date_and_window(self):
        rows = [('2026-06-01', 20, 0.5, 1.0),    # low delivery — no
                ('2026-06-02', 80, 0.5, 1.0),    # qualifies
                ('2026-06-03', 20, 0.5, 1.0),
                ('2026-06-04', 80, 0.5, 1.0)]    # qualifies
        n, first, window = stir_days_map(_bars(rows))[1]
        self.assertEqual(n, 2)
        self.assertEqual(first, date(2026, 6, 2), 'the EARLIEST qualifying bar')
        self.assertEqual(window, 4, 'the denominator is the bars measured, not 60')

    def test_scattered_bars_report_the_span_not_a_run(self):
        """The whole reason stir_start_date was refused: first and last
        qualifying bars can be far apart with gaps between."""
        rows = ([('2026-06-01', 80, 0.5, 1.0)]
                + [(f'2026-06-{d:02d}', 20, 0.5, 1.0) for d in range(2, 20)]
                + [('2026-06-20', 80, 0.5, 1.0)])
        n, first, window = stir_days_map(_bars(rows))[1]
        self.assertEqual(n, 2)
        self.assertEqual(first, date(2026, 6, 1))
        self.assertEqual(window, 20,
                         '2 of 20 — reporting "stirring since 1 June" would be false')

    def test_no_qualifying_bar_gives_no_date(self):
        rows = [('2026-06-01', 10, 0.5, 1.0), ('2026-06-02', 10, 0.5, 1.0)]
        self.assertEqual(stir_days_map(_bars(rows))[1], (0, None, 2))

    def test_all_null_delivery_is_zero_with_no_window(self):
        """Unchanged early-out: with no delivery there is no median to gate on."""
        rows = [('2026-06-01', None, 0.5, 1.0), ('2026-06-02', None, 0.5, 1.0)]
        self.assertEqual(stir_days_map(_bars(rows))[1], (0, None, 0))

    def test_gates_still_bind(self):
        """The tally rule is untouched — a big move or a volume spike
        disqualifies a bar however high its delivery."""
        self.assertEqual(stir_days_map(_bars(
            [('2026-06-01', 80, 9.0, 1.0)]))[1][0], 0, 'pct_chng gate')
        self.assertEqual(stir_days_map(_bars(
            [('2026-06-01', 80, 0.5, 9.0)]))[1][0], 0, 'rvol gate')

    def test_window_is_capped_at_sixty(self):
        """80 bars in, 60 measured. Delivery alternates because the gate is
        RELATIVE to the stock's own 60-day median — a uniformly high-delivery
        stock qualifies on nothing, since the median rises with it. (This test
        first used flat 80% delivery and correctly returned zero.)"""
        rows = [(f'2026-0{(i // 28) + 4}-{(i % 28) + 1:02d}',
                 80 if i % 2 else 30, 0.5, 1.0) for i in range(80)]
        n, _, window = stir_days_map(_bars(rows))[1]
        self.assertEqual(window, 60, 'the gate reads the last 60 bars, not all 80')
        self.assertGreater(n, 0)
        self.assertLess(n, 60)

    def test_the_gate_is_relative_to_the_stock(self):
        """A stock whose delivery is uniformly high qualifies on NOTHING: the
        median rises with it, so nothing clears median x 1.15. That is the
        sniper_inst lesson expressed in the stirring rule — never an absolute
        threshold — and it is worth pinning, because 'high delivery = stirring'
        is the intuitive reading and it is wrong."""
        flat = [(f'2026-06-{d:02d}', 80, 0.5, 1.0) for d in range(1, 21)]
        self.assertEqual(stir_days_map(_bars(flat))[1][0], 0)


class TestNoStartDate(unittest.TestCase):
    def test_the_refused_name_is_absent_everywhere(self):
        """A future edit renaming stir_first_date to stir_start_date brings the
        false continuity claim back with it. Checked against EXECUTABLE code:
        the prose may name the field it refuses (and does), the code may not."""
        self.assertNotIn('stir_start_date', _executable(SRC))
        mig = Path('../DBscripts/km_migration_211_journey_stir_window.sql')
        sql = mig.read_text(encoding='utf-8')
        self.assertNotIn('ADD COLUMN IF NOT EXISTS stir_start_date', sql)
        self.assertIn('stir_first_date', sql)
        self.assertIn('stir_window_bars', sql)

    def test_columns_reach_the_writer(self):
        """Both must be in CURRENT_COLS or the row dict is filtered and the
        values silently never land."""
        cols = SRC[SRC.index('CURRENT_COLS'):SRC.index('CURRENT_COLS') + 900]
        self.assertIn("'stir_first_date'", cols)
        self.assertIn("'stir_window_bars'", cols)

    def test_archive_rows_carry_the_turn(self):
        arc = SRC[SRC.index('for j in archived:'):]
        arc = arc[:arc.index('\n\n')]
        self.assertIn("'turn_date': j.get('turn_date')", arc)
        self.assertIn("'gl_dist_pct': j.get('gl_dist_pct')", arc)
        self.assertIn("'stir_days': None", arc,
                      'stirring is a property of now — meaningless on a closed arc')

    def test_archive_turn_is_taken_at_the_wake_bar(self):
        """At the sleep bar the stock has usually lost the Golden Line — often
        why it slept — so asking there returns NULL for exactly the arcs worth
        inspecting."""
        self.assertIn("turn_at(journey['wake_i'])", SRC)

    def test_snapshot_uses_the_same_helper(self):
        """Not a second inline block: two definitions of 'the turn' on one
        column would be worse than none."""
        self.assertIn('turn_at(n - 1)', SRC)
        self.assertNotIn('above_gl = (vals > gl_arr)', SRC,
                         'the old inline snapshot turn must be gone, not shadowed')


if __name__ == '__main__':
    unittest.main(verbosity=2)
