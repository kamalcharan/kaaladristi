"""
NSE trading holidays → km_trading_calendar
==========================================
Fetches NSE's published holiday master and upserts the capital-market (CM)
holidays as `status='holiday', is_holiday=TRUE` rows for NSE and BSE, so
kd_day_zero_trade_date (migration 228) can PLAN a Day 0 across a holiday
before the surrounding bars exist.

    python3 scripts/sync_nse_holidays.py             # upsert
    python3 scripts/sync_nse_holidays.py --dry-run   # print what would change

⚠ Must run on the VPS: the cloud dev container has no route to nseindia.com.
Run it once after migration 228 and again each December when NSE publishes
the next year's list. A missing holiday is not fatal — reconcile_day_zero()
corrects a provisional Day 0 once the bars land — it just widens the window
during which a filing carries a date one session early.

The guard is the same as the migration's seed: a date the pipeline recorded
as traded (status completed/partial) is never overwritten. NSE's list is the
authority for NSE; BSE mirrors it in practice and the health grid reads the
table without an exchange filter, so both rows are written — exactly what
/api/pipeline2/calendar/mark does by hand.
"""

import argparse
import logging
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib.config import DATABASE_URL                      # noqa: E402
from pipeline.utils.nse_session import NseSession        # noqa: E402

log = logging.getLogger(__name__)

HOLIDAY_URL = 'https://www.nseindia.com/api/holiday-master?type=trading'
HOLIDAY_REFERER = 'https://www.nseindia.com/resources/exchange-communication-holidays'
SEGMENT = 'CM'          # capital market — the equity segment the pipeline ingests
EXCHANGES = ('NSE', 'BSE')

UPSERT_SQL = """
    INSERT INTO km_trading_calendar (trade_date, exchange, is_holiday, holiday_name, status)
    VALUES (%s, %s, TRUE, %s, 'holiday')
    ON CONFLICT (trade_date, exchange) DO UPDATE
       SET is_holiday = TRUE, holiday_name = EXCLUDED.holiday_name, status = 'holiday'
     WHERE km_trading_calendar.status IS DISTINCT FROM 'completed'
       AND km_trading_calendar.status IS DISTINCT FROM 'partial'
"""


def parse_holidays(payload: dict) -> list[tuple]:
    """(date, description) for every CM row. NSE dates the rows '26-Jan-2026'."""
    out = []
    for row in payload.get(SEGMENT) or []:
        raw = (row.get('tradingDate') or '').strip()
        if not raw:
            continue
        d = datetime.strptime(raw, '%d-%b-%Y').date()
        out.append((d, (row.get('description') or '').strip() or None))
    return out


def fetch_holidays(session: NseSession) -> list[tuple]:
    resp = session.get(HOLIDAY_URL, referer=HOLIDAY_REFERER)
    return parse_holidays(resp.json())


def upsert_holidays(conn, holidays: list[tuple]) -> int:
    """Rows written or updated. A traded date is left alone (the WHERE on the
    conflict clause), so the count can be lower than len(holidays) * 2."""
    n = 0
    with conn.cursor() as cur:
        for d, name in holidays:
            for ex in EXCHANGES:
                cur.execute(UPSERT_SQL, (d, ex, name))
                n += cur.rowcount
    conn.commit()
    return n


def main():
    ap = argparse.ArgumentParser(description='Sync NSE trading holidays into km_trading_calendar')
    ap.add_argument('--dry-run', action='store_true', help='fetch and print, write nothing')
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(message)s')

    holidays = fetch_holidays(NseSession())
    print(f'NSE holiday master: {len(holidays)} {SEGMENT} holidays')
    for d, name in holidays:
        print(f'  {d}  {d.strftime("%a")}  {name or ""}')
    if args.dry_run or not holidays:
        return

    import psycopg2
    conn = psycopg2.connect(DATABASE_URL)
    try:
        n = upsert_holidays(conn, holidays)
        print(f'km_trading_calendar: {n} row(s) written across {EXCHANGES}')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
