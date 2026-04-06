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
