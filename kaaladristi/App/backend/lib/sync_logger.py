"""
Sync logger — writes download results to km_data_sync_log.
"""

import time
from datetime import datetime


class SyncLogger:
    def __init__(self, sb):
        self.sb = sb

    def log(self, sync_type: str, symbol: str, exchange: str,
            from_date: str, to_date: str, rows_fetched: int,
            rows_upserted: int, status: str, error_msg: str = None,
            duration_ms: int = None):
        record = {
            'sync_type': sync_type,
            'symbol': symbol,
            'exchange': exchange,
            'from_date': from_date,
            'to_date': to_date,
            'rows_fetched': rows_fetched,
            'rows_upserted': rows_upserted,
            'status': status,
            'error_msg': error_msg,
            'duration_ms': duration_ms,
        }
        try:
            self.sb.insert('km_data_sync_log', record)
        except Exception as e:
            print(f'  [sync_log write failed: {e}]')

    def start_timer(self):
        self._start = time.time()

    def elapsed_ms(self) -> int:
        return int((time.time() - self._start) * 1000)
