"""
Step tracker — logs pipeline step progress to km_pipeline_runs.
Each step (download, parse, insert, etc.) is tracked independently.
"""

import time
import json
from datetime import date, datetime


class StepTracker:
    """Tracks pipeline steps in km_pipeline_runs."""

    def __init__(self, db, trade_date: date, exchange: str = 'NSE'):
        self.db = db
        self.trade_date = trade_date
        self.exchange = exchange
        self._start_time = None

    def start(self, step: str):
        """Mark a step as running."""
        self._start_time = time.time()
        now = datetime.utcnow().isoformat()

        record = {
            'trade_date': str(self.trade_date),
            'exchange': self.exchange,
            'step': step,
            'status': 'running',
            'started_at': now,
            'completed_at': None,
            'rows_count': 0,
            'duration_ms': None,
            'error_msg': None,
            'metadata': None,
        }
        self.db.upsert('km_pipeline_runs', [record], 'trade_date,exchange,step')
        print(f'  [{step}] started...', end=' ', flush=True)

    def complete(self, step: str, rows: int = 0, metadata: dict = None):
        """Mark a step as completed."""
        elapsed = int((time.time() - self._start_time) * 1000) if self._start_time else 0
        now = datetime.utcnow().isoformat()

        record = {
            'trade_date': str(self.trade_date),
            'exchange': self.exchange,
            'step': step,
            'status': 'completed',
            'rows_count': rows,
            'duration_ms': elapsed,
            'completed_at': now,
            'error_msg': None,
            'metadata': json.dumps(metadata) if metadata else None,
        }
        self.db.upsert('km_pipeline_runs', [record], 'trade_date,exchange,step')
        print(f'done ({rows} rows, {elapsed}ms)')

    def fail(self, step: str, error: str, metadata: dict = None):
        """Mark a step as failed."""
        elapsed = int((time.time() - self._start_time) * 1000) if self._start_time else 0
        now = datetime.utcnow().isoformat()

        record = {
            'trade_date': str(self.trade_date),
            'exchange': self.exchange,
            'step': step,
            'status': 'failed',
            'rows_count': 0,
            'duration_ms': elapsed,
            'completed_at': now,
            'error_msg': error[:500],
            'metadata': json.dumps(metadata) if metadata else None,
        }
        self.db.upsert('km_pipeline_runs', [record], 'trade_date,exchange,step')
        print(f'FAILED ({error})')

    def skip(self, step: str, reason: str = ''):
        """Mark a step as skipped."""
        record = {
            'trade_date': str(self.trade_date),
            'exchange': self.exchange,
            'step': step,
            'status': 'skipped',
            'rows_count': 0,
            'duration_ms': 0,
            'error_msg': reason or None,
            'metadata': None,
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
