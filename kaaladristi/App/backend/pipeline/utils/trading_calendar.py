"""
Trading calendar — weekend/holiday check, pipeline status tracking.
"""

from datetime import date, datetime, timedelta


def is_weekend(d: date) -> bool:
    """Saturday=5, Sunday=6."""
    return d.weekday() >= 5


def is_trading_day(db, d: date, exchange: str = 'NSE') -> bool:
    """Check if a date is a trading day (not weekend, not holiday)."""
    if is_weekend(d):
        return False

    # Check holiday table
    rows = db.select(
        'km_trading_calendar',
        'is_holiday',
        filters={'trade_date': str(d), 'exchange': exchange},
        limit=1,
    )
    if rows and rows[0].get('is_holiday'):
        return False

    return True


def is_already_completed(db, d: date, exchange: str = 'NSE') -> bool:
    """Check if pipeline already ran successfully for this date."""
    rows = db.select(
        'km_trading_calendar',
        'status',
        filters={'trade_date': str(d), 'exchange': exchange},
        limit=1,
    )
    if rows and rows[0].get('status') == 'completed':
        return True
    return False


def mark_day_status(db, d: date, exchange: str, status: str, holiday_name: str = None):
    """Mark a day's pipeline status in the trading calendar."""
    record = {
        'trade_date': str(d),
        'exchange': exchange,
        'status': status,
        'is_holiday': status == 'holiday',
    }
    if holiday_name:
        record['holiday_name'] = holiday_name

    db.upsert('km_trading_calendar', [record], 'trade_date,exchange')


def get_missing_dates(db, from_date: date, to_date: date, exchange: str = 'NSE') -> list:
    """Find trading dates that haven't been processed yet."""
    missing = []
    cursor = from_date

    while cursor <= to_date:
        if not is_weekend(cursor):
            rows = db.select(
                'km_trading_calendar',
                'status',
                filters={'trade_date': str(cursor), 'exchange': exchange},
                limit=1,
            )
            if not rows or rows[0].get('status') in ('pending', 'failed', None):
                missing.append(cursor)
        cursor += timedelta(days=1)

    return missing


def last_trading_day(d: date = None) -> date:
    """Return the most recent trading day (skips weekends)."""
    d = d or date.today()
    while is_weekend(d):
        d -= timedelta(days=1)
    return d


# ── Period boundaries (weekly / monthly bars) ────────────────────────────────
#
# A weekly bar is complete after the week's LAST TRADING DAY, not after Friday;
# a monthly bar after the month's last trading day, not its last calendar day.
# Owner-visible failure that made this necessary (2026-10-01): Friday 2 Oct is
# a holiday, so a Friday-only trigger never builds that week's bar; 31 Oct 2026
# is a Saturday, so a calendar-day trigger never builds October's.
#
# `holidays` is a set of dates the exchange is closed on a weekday (from
# km_trading_calendar). An empty set degrades to "weekdays only", which is
# already right for every week and month that does not end on a holiday.

def load_holidays(conn, from_date: date, to_date: date) -> frozenset:
    """NSE weekday closures between two dates, from km_trading_calendar.
    Same predicate as migration 228's planned Day 0 and health._skip_dates."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT trade_date FROM km_trading_calendar "
            "WHERE exchange = 'NSE' AND trade_date BETWEEN %s AND %s "
            "  AND (is_holiday OR status IN ('holiday', 'no_data', 'weekend'))",
            [str(from_date), str(to_date)],
        )
        return frozenset(r[0] for r in cur.fetchall())


def _trading(d: date, holidays) -> bool:
    return not is_weekend(d) and d not in holidays


def period_start(d: date, weekly: bool) -> date:
    return d - timedelta(days=d.weekday()) if weekly else d.replace(day=1)


def last_trading_day_of_period(d: date, weekly: bool, holidays=frozenset()) -> date | None:
    """The last trading day of the week/month containing d (None if the whole
    period is closed)."""
    start = period_start(d, weekly)
    if weekly:
        end = start + timedelta(days=6)
    else:
        nxt = (start.replace(year=start.year + 1, month=1) if start.month == 12
               else start.replace(month=start.month + 1))
        end = nxt - timedelta(days=1)
    while end >= start:
        if _trading(end, holidays):
            return end
        end -= timedelta(days=1)
    return None


def is_period_end(d: date, weekly: bool, holidays=frozenset()) -> bool:
    """True when d is the last trading day of its week (weekly) or month."""
    return last_trading_day_of_period(d, weekly, holidays) == d
