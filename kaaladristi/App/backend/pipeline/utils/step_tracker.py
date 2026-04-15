"""
Step tracker — logs pipeline step progress to km_pipeline_runs.
Each step (download, parse, insert, etc.) is tracked independently
with coverage metrics (rows_expected, coverage_pct).
"""

import time
import json
from datetime import date, datetime

# Import step config for ordering + coverage classification
try:
    from config.pipeline_steps import get_step_order
except ImportError:
    def get_step_order(_name):
        return 99


class StepTracker:
    """Tracks pipeline steps in km_pipeline_runs with coverage."""

    def __init__(self, db, trade_date: date, exchange: str = 'NSE',
                 triggered_by: str = 'scheduler', triggered_user: str = None):
        self.db = db
        self.trade_date = trade_date
        self.exchange = exchange
        self.triggered_by = triggered_by
        self.triggered_user = triggered_user
        self._start_time = None

    def start(self, step: str):
        """Mark a step as running."""
        self._start_time = time.time()
        now = datetime.utcnow().isoformat()

        record = {
            'trade_date': str(self.trade_date),
            'exchange': self.exchange,
            'step': step,
            'step_order': get_step_order(step),
            'status': 'running',
            'started_at': now,
            'completed_at': None,
            'rows_count': 0,
            'rows_expected': None,
            'coverage_pct': None,
            'duration_ms': None,
            'error_msg': None,
            'metadata': None,
            'triggered_by': self.triggered_by,
            'triggered_user': self.triggered_user,
        }
        self.db.upsert('km_pipeline_runs', [record], 'trade_date,exchange,step')
        print(f'  [{step}] started...', end=' ', flush=True)

    def complete(self, step: str, rows: int = 0, rows_expected: int = None,
                 metadata: dict = None):
        """Mark a step as completed with optional coverage tracking."""
        elapsed = int((time.time() - self._start_time) * 1000) if self._start_time else 0
        now = datetime.utcnow().isoformat()

        coverage_pct = None
        if rows_expected and rows_expected > 0:
            coverage_pct = round(100.0 * rows / rows_expected, 2)

        record = {
            'trade_date': str(self.trade_date),
            'exchange': self.exchange,
            'step': step,
            'step_order': get_step_order(step),
            'status': 'completed',
            'rows_count': rows,
            'rows_expected': rows_expected,
            'coverage_pct': coverage_pct,
            'duration_ms': elapsed,
            'completed_at': now,
            'error_msg': None,
            'metadata': json.dumps(metadata) if metadata else None,
            'triggered_by': self.triggered_by,
            'triggered_user': self.triggered_user,
        }
        self.db.upsert('km_pipeline_runs', [record], 'trade_date,exchange,step')

        cov_str = f', coverage {coverage_pct:.0f}%' if coverage_pct is not None else ''
        print(f'done ({rows} rows{cov_str}, {elapsed}ms)')

    def fail(self, step: str, error: str, metadata: dict = None):
        """Mark a step as failed."""
        elapsed = int((time.time() - self._start_time) * 1000) if self._start_time else 0
        now = datetime.utcnow().isoformat()

        record = {
            'trade_date': str(self.trade_date),
            'exchange': self.exchange,
            'step': step,
            'step_order': get_step_order(step),
            'status': 'failed',
            'rows_count': 0,
            'duration_ms': elapsed,
            'completed_at': now,
            'error_msg': error[:500],
            'metadata': json.dumps(metadata) if metadata else None,
            'triggered_by': self.triggered_by,
            'triggered_user': self.triggered_user,
        }
        self.db.upsert('km_pipeline_runs', [record], 'trade_date,exchange,step')
        print(f'FAILED ({error})')

    def skip(self, step: str, reason: str = ''):
        """Mark a step as skipped."""
        record = {
            'trade_date': str(self.trade_date),
            'exchange': self.exchange,
            'step': step,
            'step_order': get_step_order(step),
            'status': 'skipped',
            'rows_count': 0,
            'duration_ms': 0,
            'error_msg': reason or None,
            'metadata': None,
            'triggered_by': self.triggered_by,
            'triggered_user': self.triggered_user,
        }
        self.db.upsert('km_pipeline_runs', [record], 'trade_date,exchange,step')
        if reason:
            print(f'  [{step}] skipped — {reason}')

    def get_step_status(self, step: str) -> str | None:
        """Get current status of a step for this date."""
        rows = self.db.select(
            'km_pipeline_runs',
            'status',
            filters={
                'trade_date': str(self.trade_date),
                'exchange': self.exchange,
                'step': step,
            },
            limit=1,
        )
        return rows[0]['status'] if rows else None
