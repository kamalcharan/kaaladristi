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
    ('scan_refresh',          None),   # matview reads all equity/industry compute above
    ('wg_journeys',           None),   # journey state reads final daily zones + weekly/monthly aggregates
    ('integrity_checks',      None),   # LAST — sweeps every other step's outcome + the day's data
]


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
              force: bool = False) -> RunOutcome:
    """Run the full daily pipeline for `trade_date`: download then compute.

    Steps 1-3 fetch NSE index bhav, NSE equity bhav, and BSE equity bhav.
    Steps 4-22 compute indicators, flow, magic_rs, rs_percentile, supertrend,
    rolling metrics, d365, stage classification, VaNi flags, index returns,
    industry composites, market breadth, breadth ROC, and refresh the scanner
    matviews. A failed download step does not abort compute — downstream steps
    run against whatever rows are already present.
    """
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

    on_progress(f'daily run {outcome.overall_status}', 100)
    return outcome
