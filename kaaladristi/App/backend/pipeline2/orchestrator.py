"""Execution order for pipeline v2 daily runs.

The daily run is a sequence of 12 steps. Each step:
  1. Runs its dimension handler (compute RPC + fill-rate read).
  2. Writes fill_rate_after to km_jobs.
  3. If after < threshold, marks the step 'partial' but continues —
     downstream steps may still succeed (e.g. index_indicators partial
     doesn't prevent equity indicators).

Step 1 (download) is delegated to the legacy daily_pipeline.run_nse_pipeline
/ run_bse_pipeline functions because their download + parse + insert +
delivery logic is still sound. v2 orchestrates compute on top of v1
downloads until the download layer is rebuilt.
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
DAILY_STEPS: list[tuple[str, Optional[str]]] = [
    ('index_indicators',      None),
    ('nse_equity_indicators', 'NSE'),
    ('bse_equity_indicators', 'BSE'),
    ('index_flow',            None),
    ('nse_flow',              'NSE'),
    ('bse_flow',              'BSE'),
    ('nse_magic_rs',          'NSE'),
    ('bse_magic_rs',          'BSE'),
    ('industry_composites',   None),
    ('market_breadth',        None),
    ('breadth_roc',           None),
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


@dataclass
class RunOutcome:
    trade_date: str
    steps: list[StepOutcome] = field(default_factory=list)

    @property
    def overall_status(self) -> str:
        if any(s.status == 'failed' for s in self.steps):
            return 'failed'
        if any(s.status == 'partial' for s in self.steps):
            return 'partial'
        return 'completed'

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
    """Run the full daily compute chain for `trade_date`.

    Does NOT run the download step — callers should ensure NSE/BSE bhavs
    are already in km_equity_eod / km_index_eod before calling this.
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
