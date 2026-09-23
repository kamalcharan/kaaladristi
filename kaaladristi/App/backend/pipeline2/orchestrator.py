"""Execution order for pipeline v2 daily runs.

The daily run is a sequence of 22 steps:
  Steps 1-3:  Download index bhav + NSE equity bhav + BSE equity bhav.
  Steps 4-22: Compute indicators, flow, magic_rs, rs_percentile, supertrend,
              rolling metrics, d365, stage classification, VaNi flags, index
              returns + custom index EOD + scores, industry composites, market
              breadth, breadth ROC, and finally refresh the scanner
              materialized views (km_scan_results).

Each step:
  1. Runs its dimension handler (download/compute + fill-rate read).
  2. Writes fill_rate_after to km_jobs.
  3. If after < threshold, marks the step 'partial' but continues —
     downstream steps may still succeed (e.g. a partial index download
     doesn't prevent equity indicator compute for already-present rows).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Callable, Optional

import psycopg2

from . import handlers
from . import health


# Sequence executed for a daily_run job. Each entry: (dimension, exchange_hint).
# exchange_hint narrows magic_rs / flow jobs to one exchange; None means
# the dimension key itself carries the exchange (e.g. 'nse_flow').
# Downloads run first so compute steps always operate on fresh data.
DAILY_STEPS: list[tuple[str, Optional[str]]] = [
    ('index_eod_download',    None),
    ('nse_eod_download',      'NSE'),
    ('bse_eod_download',      'BSE'),
    # Enrich any newly-registered symbols with industry/company_name/is_fno
    # before compute steps read them. Bhavcopy carries no industry column,
    # so without this step every new listing lands untagged and drops out of
    # every industry-aware view. Capped per run so a large backlog can't
    # stall the nightly job; the backlog drains over multiple runs.
    ('symbol_enrichment',     None),
    ('index_indicators',      None),
    ('nse_equity_indicators', 'NSE'),
    ('bse_equity_indicators', 'BSE'),
    ('index_flow',            None),
    ('nse_flow',              'NSE'),
    ('bse_flow',              'BSE'),
    ('index_magic_rs',        None),   # index RS vs NIFTY 500 (both in km_index_eod)
    ('nse_magic_rs',          'NSE'),
    ('bse_magic_rs',          'BSE'),
    ('rs_percentile',         None),   # ranks by magic_rs — must run after magic_rs, before vani_flags
    ('magic_rs_momentum',     None),   # magic_rs 5/22/66-bar changes + align (migration 219) — LAGs magic_rs, so after it
    ('supertrend',            None),
    ('rolling_metrics',       None),
    ('d365',                  None),
    ('stage_classification',  None),
    ('vani_flags',            None),
    # Period aggregates — must follow rolling_metrics/stage/vani_flags because
    # aggregate_*_bars runs its own indicator chain over the aggregated bars.
    # No-ops except on Fridays / month-end (boundary check lives in the handler).
    ('equity_weekly',         None),
    ('equity_monthly',        None),
    ('index_returns',         None),
    ('industry_composites',   None),
    ('market_breadth',        None),
    ('breadth_roc',           None),
    ('index_breadth',         None),   # per-index constituent breadth → km_index_breadth (migration 203); after indicators, standard + custom indices
    ('dots',                  None),   # SVD/SBD/SYD — Volume Drive selects on these; must precede scan_refresh
    ('gl_events',             None),   # Golden Line breakout/retest — reads sma_150 AND the dots, so AFTER `dots`
    # Big Money days — delivered value vs the stock's own 66-day norm. AFTER
    # `rolling_metrics`, which writes the avg_amt_66d baseline it measures
    # against; BEFORE `scan_refresh`, whose bm_* rollup columns read the
    # bm_event this writes. Reads no dots, so its position relative to
    # `dots`/`gl_events` is grouping, not dependency.
    ('big_money',             None),
    ('scan_refresh',          None),   # matview reads all equity/industry compute above
    ('scan_membership_snapshot', None),  # freezes today's scan membership + magic_rs_zone for day-over-day VaNi intents; after scan_refresh (same data), before wg_journeys
    ('wg_journeys',           None),   # journey state reads final daily zones + weekly/monthly aggregates
    ('integrity_checks',      None),   # LAST — sweeps every other step's outcome + the day's data
]


# ── Recompute dependencies ───────────────────────────────────────────────
#
# DAILY_STEPS gets the order right on a nightly run. The `fix` path did not:
# a fix job runs ONE dimension and stops, so a corrected input left every
# dimension derived from it holding a value computed from the superseded data,
# with nothing recording that. Measured over six weeks to 2026-09-14:
# vani_flags took 162 fix jobs, nse_magic_rs 160, nse_equity_indicators 128 —
# while gl_events, big_money, dots, wg_journeys and scan_refresh took ZERO.
# Fix jobs land 1-6 days after the bar (2026-09-01 was still being rewritten
# on 09-07), so this is not a rare window.
#
# A fill-rate check cannot catch it: gl_events and big_money ARE in
# health.DIMENSIONS and report `ok`, because gl_days_above / bm_ratio are
# populated. Populated, not current — the presence-vs-correctness lesson.
#
# Each entry maps a dimension to the dimensions that must be RECOMPUTED when
# it changes. Direct edges only; dependents_closure() walks the transitive set.
# Every edge below is justified by a comment in DAILY_STEPS or by the reading
# the handler does — do not add one on a hunch, and keep the graph acyclic
# (validate_dependents() enforces both shape rules).
#
# integrity_checks is deliberately absent: it is a nightly sweep over the whole
# day, not a per-dimension derivative, and cascading into it would enqueue a
# full audit on every column repair.
DIMENSION_DEPENDENTS: dict[str, list[str]] = {
    # Downloads rewrite the bars themselves, so the compute chain re-enters at
    # the indicator step and the closure carries it the rest of the way.
    'index_eod_download':     ['index_indicators'],
    'nse_eod_download':       ['nse_equity_indicators'],
    'bse_eod_download':       ['bse_equity_indicators'],

    # Indicator columns feed every later per-bar computation.
    'index_indicators':       ['index_flow', 'index_magic_rs', 'index_returns'],
    'nse_equity_indicators':  ['nse_flow', 'nse_magic_rs', 'supertrend',
                               'rolling_metrics', 'd365', 'stage_classification',
                               'equity_weekly', 'equity_monthly',
                               'market_breadth', 'index_breadth'],
    'bse_equity_indicators':  ['bse_flow', 'bse_magic_rs', 'supertrend',
                               'rolling_metrics', 'd365', 'stage_classification'],

    # 'rs_percentile ranks by magic_rs - must run after magic_rs, before
    # vani_flags'; wg_journeys reads the final daily zones.
    'nse_magic_rs':           ['rs_percentile', 'magic_rs_momentum', 'dots',
                               'industry_composites', 'wg_journeys'],
    'bse_magic_rs':           ['rs_percentile', 'magic_rs_momentum', 'dots'],
    'index_magic_rs':         ['index_returns'],
    'rs_percentile':          ['vani_flags'],

    # is_vani_52wh / is_vani_ath read w52_high / lifetime_high; big_money
    # measures against the avg_amt_66d baseline rolling_metrics writes.
    #
    # stage_classification added 2026-09-23 — THIS EDGE WAS MISSING and it cost
    # a production outage. The Weinstein S2 gate requires
    # `w52l IS NOT NULL AND w52h IS NOT NULL AND close >= w52l*1.25
    #  AND close >= w52h*0.75` (scripts/backfill_stage_classification.py), all
    # of which rolling_metrics writes. On 2026-09-16 and 2026-09-22 the rolling
    # RANGE group (w52_high / w52_low / lifetime_high) came out NULL for the
    # whole bar while every other rolling column populated normally, so every
    # would-be S2 fell through to S2_CANDIDATE: 0 S2 against ~1,030 the day
    # before, and the Stage 2 Leaders scanner (`.eq('stage','S2')`) served an
    # empty list.
    #
    # ⚠ THE EDGE IS CORRECT BUT IT IS NOT THE ROOT CAUSE. Declaring it stops a
    # repaired rolling_metrics from leaving stage stale, which is real. What
    # actually produced both outages is in worker._cascade_dependents: the whole
    # closure is enqueued in ONE pass as sibling jobs, all force=True, all with
    # the same created_at, with no execution ordering between them and NO
    # "parent failed -> skip dependents" rule. km_jobs shows the consequence on
    # 2026-09-16 AND 2026-09-22: rolling_metrics and stage_classification run
    # concurrently, both UPDATE km_equity_eod, and DEADLOCK. rolling_metrics
    # loses, but its forced nullify has already COMMITTED (separately from the
    # recompute, or a rollback would have restored the old values), so
    # w52_high / w52_low / lifetime_high are left NULL — and
    # stage_classification then completes successfully against those NULLs and
    # demotes every S2 to S2_CANDIDATE.
    #
    # So adding this edge does not fix the outage and, on its own, adds one
    # more forced sibling to the same batch. Three things are still open:
    #   1. a dependent must NOT run when its parent's fix failed;
    #   2. siblings that write the same table must be serialised, or the
    #      handler must retry on deadlock (40P01);
    #   3. gap_sweep re-fires an nse_equity_indicators fix that repairs 0 rows
    #      every ~2h, and each one cascades a destructive forced nullify of
    #      rolling_metrics. That is what sets the frequency.
    'rolling_metrics':        ['big_money', 'vani_flags', 'stage_classification'],

    # The Flower Pot arm gates on stage; the journey walk excludes S3/S4.
    'stage_classification':   ['vani_flags', 'scan_refresh', 'wg_journeys'],

    # Everything the km_scan_results arms select on.
    'nse_flow':               ['scan_refresh'],
    'bse_flow':               ['scan_refresh'],
    'index_flow':             ['index_returns'],
    'supertrend':             ['scan_refresh'],
    'd365':                   ['scan_refresh'],
    'industry_composites':    ['scan_refresh'],

    # 'SVD/SBD/SYD - Volume Drive selects on these; must precede scan_refresh'
    # and 'gl_events reads sma_150 AND the dots, so AFTER dots'.
    'dots':                   ['gl_events', 'scan_refresh'],
    'gl_events':              ['scan_refresh', 'scan_membership_snapshot',
                               'wg_journeys'],
    'big_money':              ['scan_refresh'],
    'vani_flags':             ['scan_refresh', 'scan_membership_snapshot'],

    # 'journey state reads final daily zones + weekly/monthly aggregates'
    'equity_weekly':          ['wg_journeys'],
    'equity_monthly':         ['wg_journeys'],

    'market_breadth':         ['breadth_roc'],

    # scan_membership_snapshot reads km_equity_eod directly and by its own
    # header 'does NOT depend on scan_refresh having just run', so the matview
    # is a leaf rather than its parent.
    'scan_refresh':           [],
}

# Rank by nightly execution order so a cascade is enqueued in the order the
# daily run would have computed it.
_STEP_ORDER: dict[str, int] = {dim: i for i, (dim, _) in enumerate(DAILY_STEPS)}


def validate_dependents() -> None:
    """Fail loudly on an unknown dimension name or a cycle.

    Called at import so a typo is a startup error, not a fix job that dies at
    2am having already written half a cascade.
    """
    known = set(handlers.KNOWN_DIMENSIONS)
    for dim, deps in DIMENSION_DEPENDENTS.items():
        if dim not in known:
            raise ValueError(f'DIMENSION_DEPENDENTS: unknown dimension {dim!r}')
        for d in deps:
            if d not in known:
                raise ValueError(
                    f'DIMENSION_DEPENDENTS[{dim!r}]: unknown dependent {d!r}')
            if d == dim:
                raise ValueError(f'DIMENSION_DEPENDENTS[{dim!r}] depends on itself')

    # Depth-first cycle check. A cycle would make dependents_closure loop, and
    # every dependent is also enqueued as a job — so a cycle is an outage.
    WHITE, GREY, BLACK = 0, 1, 2
    colour: dict[str, int] = {}

    def visit(node: str, path: list[str]) -> None:
        colour[node] = GREY
        for nxt in DIMENSION_DEPENDENTS.get(node, []):
            c = colour.get(nxt, WHITE)
            if c == GREY:
                raise ValueError(
                    'DIMENSION_DEPENDENTS has a cycle: '
                    + ' -> '.join(path + [node, nxt]))
            if c == WHITE:
                visit(nxt, path + [node])
        colour[node] = BLACK

    for dim in DIMENSION_DEPENDENTS:
        if colour.get(dim, WHITE) == WHITE:
            visit(dim, [])


def dependents_closure(dimension: str) -> list[str]:
    """Every dimension that must be recomputed after `dimension` changed.

    Transitive and computed in ONE pass, returned in DAILY_STEPS order. Doing
    the whole closure up front is what keeps this bounded: the worker enqueues
    this list and those jobs do not cascade again, so one repaired column can
    never start a self-feeding chain of fix jobs.

    The source dimension is never included.
    """
    seen: set[str] = set()
    stack = list(DIMENSION_DEPENDENTS.get(dimension, []))
    while stack:
        d = stack.pop()
        if d in seen or d == dimension:
            continue
        seen.add(d)
        stack.extend(DIMENSION_DEPENDENTS.get(d, []))
    return sorted(seen, key=lambda d: _STEP_ORDER.get(d, len(_STEP_ORDER)))


validate_dependents()


@dataclass
class StepOutcome:
    dimension: str
    status: str
    fill_rate_before: float
    fill_rate_after: float
    rows_affected: int
    error_msg: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            'dimension': self.dimension,
            'status': self.status,
            'fill_rate_before': self.fill_rate_before,
            'fill_rate_after': self.fill_rate_after,
            'rows_affected': self.rows_affected,
            'error_msg': self.error_msg,
        }


# Only these steps failing means the run genuinely failed — without fresh EOD
# rows the day has no usable data. Every other step is enrichment layered on top;
# if one of those fails the day is still usable, so the run is 'partial' (not
# 'failed') and the failing step can be re-run on its own via a fix job. This is
# what stops a single non-critical step (e.g. scan_refresh) from marking the whole
# daily_run failed — and keeps the day from being withheld from the frontend
# (a 'failed' run is not written to km_trading_calendar).
CRITICAL_STEPS = frozenset({
    'index_eod_download', 'nse_eod_download', 'bse_eod_download',
})


@dataclass
class RunOutcome:
    trade_date: str
    steps: list[StepOutcome] = field(default_factory=list)

    @property
    def overall_status(self) -> str:
        if any(s.status == 'failed' and s.dimension in CRITICAL_STEPS for s in self.steps):
            return 'failed'
        if any(s.status in ('failed', 'partial') for s in self.steps):
            return 'partial'
        return 'completed'

    @property
    def failed_steps(self) -> list[str]:
        """Dimensions that hard-failed this run (any severity)."""
        return [s.dimension for s in self.steps if s.status == 'failed']

    def to_dict(self) -> dict:
        return {
            'trade_date': self.trade_date,
            'steps': [s.to_dict() for s in self.steps],
            'overall_status': self.overall_status,
        }


ProgressFn = Callable[[str, int], None]


def run_daily(conn: 'psycopg2.extensions.connection',
              trade_date: date,
              on_progress: ProgressFn,
              force: bool = False,
              job_id: int | None = None) -> RunOutcome:
    """Run the full daily pipeline for `trade_date`: download then compute.

    Steps 1-3 fetch NSE index bhav, NSE equity bhav, and BSE equity bhav.
    Steps 4-22 compute indicators, flow, magic_rs, rs_percentile, supertrend,
    rolling metrics, d365, stage classification, VaNi flags, index returns,
    industry composites, market breadth, breadth ROC, and refresh the scanner
    matviews. A failed download step does not abort compute — downstream steps
    run against whatever rows are already present.
    """
    # Imported here rather than at module scope: watermarks reads
    # DIMENSION_DEPENDENTS and DAILY_STEPS from THIS module, so a top-level
    # import is circular. ABSOLUTE, not `from . import` — test_leadership_pipeline
    # compiles run_daily on its own via ast/exec, where a relative import has no
    # __package__ to resolve against and raises
    # KeyError: "'__name__' not in globals". One lookup per run, not per step.
    from pipeline2 import watermarks

    outcome = RunOutcome(trade_date=str(trade_date))
    total_steps = len(DAILY_STEPS)

    for i, (dim, exchange) in enumerate(DAILY_STEPS):
        base_pct = int(i / total_steps * 100)
        step_scale = int((1 / total_steps) * 100)

        def _progress(text: str, step_pct: int, _i=i, _base=base_pct, _scale=step_scale):
            # Map the handler's 0..100 into this step's slot.
            overall = _base + int(step_pct * _scale / 100)
            on_progress(f'[{_i+1}/{total_steps}] {dim}: {text}', min(overall, 99))

        on_progress(f'[{i+1}/{total_steps}] starting {dim}', base_pct)
        try:
            result = handlers.handle(dim, conn, trade_date, force, exchange, _progress)
        except Exception as e:
            conn.rollback()
            outcome.steps.append(StepOutcome(
                dimension=dim, status='failed',
                fill_rate_before=0.0, fill_rate_after=0.0, rows_affected=0,
                error_msg=str(e)[:500],
            ))
            # Continue to next dimension; one failure shouldn't block the rest.
            continue

        outcome.steps.append(StepOutcome(
            dimension=dim, status=result.status,
            fill_rate_before=result.fill_rate_before,
            fill_rate_after=result.fill_rate_after,
            rows_affected=result.rows_affected,
            error_msg=result.error_msg,
        ))

        # Watermark (migration 210). These 22 StepOutcomes were built and then
        # discarded — the worker folds them into ONE aggregate km_jobs row, so
        # nothing in the database could say when a given dimension was last
        # computed for a date. Without that, the Phase-0 cascade can recompute a
        # dependent and no one can prove it happened; a row derived from
        # superseded inputs is indistinguishable from a current one, and
        # fill-rate checks cannot see the difference by construction.
        # Best-effort: instrumentation must never fail a compute that worked.
        watermarks.stamp(conn, dim, trade_date, result.status,
                         source='daily_run', job_id=job_id,
                         rows_affected=result.rows_affected)

    # Publish only after the full source refresh succeeds; retain old dated
    # snapshots if any enrichment failed instead of presenting partial evidence.
    if outcome.overall_status == 'completed':
        try:
            from lib.sector_leadership import refresh_snapshots
            on_progress('Publishing longer-term sector readings', 99)
            count = refresh_snapshots(conn, str(trade_date))
            outcome.steps.append(StepOutcome('leadership_snapshot', 'completed', 0, 100, count))
        except Exception as exc:
            conn.rollback()
            outcome.steps.append(StepOutcome('leadership_snapshot', 'failed', 0, 0, 0, str(exc)[:500]))
    on_progress(f'daily run {outcome.overall_status}', 100)
    return outcome
