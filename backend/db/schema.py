"""
Kāla-Drishti Database Schema
SQLite schema for all master, transaction, and computed tables.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kaaladristi.db')


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


def create_schema(conn):
    cur = conn.cursor()

    # =========================================================================
    # MASTER / REFERENCE TABLES
    # =========================================================================

    cur.execute("""
    CREATE TABLE IF NOT EXISTS planets (
        id          INTEGER PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE,
        vedic_name  TEXT,
        category    TEXT CHECK(category IN ('classical','node','outer'))
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS nakshatras (
        id          INTEGER PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE,
        start_deg   REAL,
        end_deg     REAL
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS nakshatra_lords (
        nakshatra_id INTEGER NOT NULL REFERENCES nakshatras(id),
        planet_id    INTEGER NOT NULL REFERENCES planets(id),
        PRIMARY KEY (nakshatra_id, planet_id)
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS zodiac_signs (
        id          INTEGER PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE,
        element     TEXT,
        start_deg   REAL,
        end_deg     REAL
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS zodiac_lords (
        zodiac_id   INTEGER NOT NULL REFERENCES zodiac_signs(id),
        planet_id   INTEGER NOT NULL REFERENCES planets(id),
        PRIMARY KEY (zodiac_id, planet_id)
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS days_of_week (
        id          INTEGER PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS day_lords (
        day_id      INTEGER NOT NULL REFERENCES days_of_week(id),
        planet_id   INTEGER NOT NULL REFERENCES planets(id),
        is_primary  INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (day_id, planet_id)
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS sectors (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL UNIQUE
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS sector_lords (
        sector_id   INTEGER NOT NULL REFERENCES sectors(id),
        planet_id   INTEGER NOT NULL REFERENCES planets(id),
        PRIMARY KEY (sector_id, planet_id)
    )""")

    # Index composition: which stocks belong to which index, with weights
    cur.execute("""
    CREATE TABLE IF NOT EXISTS index_master (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol      TEXT NOT NULL UNIQUE,
        name        TEXT NOT NULL,
        yahoo_ticker TEXT
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS index_composition (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        index_id    INTEGER NOT NULL REFERENCES index_master(id),
        stock_symbol TEXT NOT NULL,
        sector      TEXT,
        weight_pct  REAL,
        snapshot_date TEXT,
        UNIQUE(index_id, stock_symbol, snapshot_date)
    )""")

    # =========================================================================
    # TRANSACTION / TIME-SERIES TABLES
    # =========================================================================

    # Index-level daily OHLCV
    cur.execute("""
    CREATE TABLE IF NOT EXISTS market_daily (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        date            TEXT NOT NULL,
        symbol          TEXT NOT NULL,
        open            REAL,
        high            REAL,
        low             REAL,
        close           REAL NOT NULL,
        volume          INTEGER,
        turnover        REAL,
        daily_return     REAL,
        daily_range_pct  REAL,
        gap_pct          REAL,
        UNIQUE(date, symbol)
    )""")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_market_daily_symbol ON market_daily(symbol, date)")

    # Stock-level daily OHLCV
    cur.execute("""
    CREATE TABLE IF NOT EXISTS stock_daily (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        date            TEXT NOT NULL,
        symbol          TEXT NOT NULL,
        open            REAL,
        high            REAL,
        low             REAL,
        close           REAL NOT NULL,
        volume          INTEGER,
        daily_return     REAL,
        daily_range_pct  REAL,
        UNIQUE(date, symbol)
    )""")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_stock_daily_symbol ON stock_daily(symbol, date)")

    # =========================================================================
    # EPHEMERIS TABLES
    # =========================================================================

    cur.execute("""
    CREATE TABLE IF NOT EXISTS planetary_positions (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        date            TEXT NOT NULL,
        planet          TEXT NOT NULL,
        longitude       REAL NOT NULL,
        speed           REAL,
        retrograde      INTEGER DEFAULT 0,
        sign            INTEGER,
        sign_name       TEXT,
        nakshatra       INTEGER,
        nakshatra_name  TEXT,
        nakshatra_pada  INTEGER,
        combust         INTEGER DEFAULT 0,
        UNIQUE(date, planet)
    )""")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_positions_date ON planetary_positions(date)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_positions_planet ON planetary_positions(planet, date)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_positions_retro ON planetary_positions(retrograde, planet) WHERE retrograde=1")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS planetary_aspects (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        date            TEXT NOT NULL,
        planet_1        TEXT NOT NULL,
        planet_2        TEXT NOT NULL,
        aspect_type     TEXT NOT NULL,
        angle           REAL,
        orb             REAL,
        exact           INTEGER DEFAULT 0,
        UNIQUE(date, planet_1, planet_2, aspect_type)
    )""")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_aspects_date ON planetary_aspects(date)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_aspects_type ON planetary_aspects(aspect_type, date)")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS astro_events (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        event_date      TEXT NOT NULL,
        event_type      TEXT NOT NULL,
        planet          TEXT NOT NULL,
        from_value      TEXT,
        to_value        TEXT,
        severity        TEXT DEFAULT 'normal'
    )""")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_events_date ON astro_events(event_date)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_events_severity ON astro_events(severity) WHERE severity='high'")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS moon_intraday (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        date            TEXT NOT NULL,
        time_ist        TEXT NOT NULL,
        longitude       REAL NOT NULL,
        speed           REAL,
        sign            INTEGER,
        sign_name       TEXT,
        nakshatra       INTEGER,
        nakshatra_name  TEXT,
        nakshatra_pada  INTEGER,
        gandanta        INTEGER DEFAULT 0,
        UNIQUE(date, time_ist)
    )""")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_moon_date ON moon_intraday(date)")

    # =========================================================================
    # COMPUTED / INTELLIGENCE TABLES
    # =========================================================================

    cur.execute("""
    CREATE TABLE IF NOT EXISTS risk_scores (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        date            TEXT NOT NULL,
        symbol          TEXT NOT NULL,
        composite_score REAL NOT NULL,
        structural      REAL,
        momentum        REAL,
        volatility      REAL,
        deception       REAL,
        regime          TEXT,
        explanation     TEXT,
        UNIQUE(date, symbol)
    )""")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_risk_date ON risk_scores(symbol, date)")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS factor_correlation_stats (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        factor_type         TEXT NOT NULL,
        index_symbol        TEXT NOT NULL,
        pct_down_days       REAL,
        avg_return          REAL,
        avg_range_pct       REAL,
        volatility_multiplier REAL,
        sample_count        INTEGER,
        baseline_down_pct   REAL,
        baseline_avg_return REAL,
        UNIQUE(factor_type, index_symbol)
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS sector_sensitivity (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        factor_type     TEXT NOT NULL,
        sector          TEXT NOT NULL,
        sensitivity_pct REAL,
        sample_count    INTEGER,
        UNIQUE(factor_type, sector)
    )""")

    conn.commit()
    print("Schema created successfully.")


if __name__ == '__main__':
    conn = get_connection()
    create_schema(conn)
    conn.close()
    print(f"Database at: {DB_PATH}")
