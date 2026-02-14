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

    # =========================================================================
    # PANCHANG MASTER TABLES
    # =========================================================================

    cur.execute("""
    CREATE TABLE IF NOT EXISTS tithis (
        id          INTEGER PRIMARY KEY,
        num         INTEGER NOT NULL,
        name        TEXT NOT NULL,
        base_name   TEXT NOT NULL,
        paksha      TEXT NOT NULL CHECK(paksha IN ('Shukla','Krishna')),
        tattva_group TEXT,
        group_lord  TEXT
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS yogas (
        id          INTEGER PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE,
        nature      TEXT CHECK(nature IN ('auspicious','inauspicious','neutral'))
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS karanas (
        id          INTEGER PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE,
        type        TEXT CHECK(type IN ('recurring','fixed'))
    )""")

    # =========================================================================
    # DAILY PANCHANG (Ujjain-based, time-series)
    # =========================================================================

    cur.execute("""
    CREATE TABLE IF NOT EXISTS daily_panchang (
        date                TEXT PRIMARY KEY,
        -- Sunrise / Sunset (Ujjain)
        sunrise_jd          REAL,
        sunrise_ist         TEXT,
        sunset_jd           REAL,
        sunset_ist          TEXT,
        -- Tithi
        tithi_num           INTEGER,
        tithi_name          TEXT,
        tithi_base_name     TEXT,
        paksha              TEXT,
        tithi_group         TEXT,
        tithi_lord          TEXT,
        -- Nakshatra (Moon at sunrise)
        nakshatra_num       INTEGER,
        nakshatra_name      TEXT,
        nakshatra_lord      TEXT,
        nakshatra_pada      INTEGER,
        -- Yoga
        yoga_num            INTEGER,
        yoga_name           TEXT,
        -- Karana
        karana_num          INTEGER,
        karana_name         TEXT,
        -- Vara (weekday)
        vara                TEXT,
        vara_lord           TEXT,
        -- DLNL match
        dlnl_match          INTEGER DEFAULT 0,
        -- Sun position
        sun_sign            INTEGER,
        sun_sign_name       TEXT,
        sun_longitude       REAL,
        sun_tropical_longitude REAL,
        -- Moon position
        moon_sign           INTEGER,
        moon_sign_name      TEXT,
        moon_longitude      REAL,
        -- Sankranti
        is_sankranti        INTEGER DEFAULT 0,
        sankranti_from      TEXT,
        sankranti_to        TEXT,
        -- Hemisphere events
        hemisphere_event    TEXT,
        -- Special flags
        is_purnima          INTEGER DEFAULT 0,
        is_amavasya         INTEGER DEFAULT 0,
        is_ekadashi         INTEGER DEFAULT 0
    )""")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_panchang_tithi ON daily_panchang(tithi_base_name)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_panchang_nakshatra ON daily_panchang(nakshatra_name)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_panchang_vara ON daily_panchang(vara)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_panchang_dlnl ON daily_panchang(dlnl_match) WHERE dlnl_match=1")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_panchang_sankranti ON daily_panchang(is_sankranti) WHERE is_sankranti=1")

    # =========================================================================
    # RULE ENGINE TABLES
    # =========================================================================

    # Rules: both given (domain knowledge) and discovered (data-driven)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS rules (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        code            TEXT NOT NULL UNIQUE,
        category        TEXT NOT NULL,
        name            TEXT NOT NULL,
        description     TEXT,
        conditions      TEXT NOT NULL,
        signal          TEXT NOT NULL CHECK(signal IN ('Super Bullish','Bullish','Neutral','Bearish','Super Bearish')),
        strength        INTEGER DEFAULT 1,
        source          TEXT DEFAULT 'given' CHECK(source IN ('given','discovered')),
        active          INTEGER DEFAULT 1,
        historical_note TEXT,
        created_at      TEXT DEFAULT (datetime('now')),
        updated_at      TEXT DEFAULT (datetime('now'))
    )""")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_rules_category ON rules(category)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_rules_active ON rules(active) WHERE active=1")

    # Rule signals: which rules fired on which dates
    cur.execute("""
    CREATE TABLE IF NOT EXISTS rule_signals (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        date            TEXT NOT NULL,
        rule_id         INTEGER NOT NULL REFERENCES rules(id),
        signal          TEXT NOT NULL,
        strength        INTEGER DEFAULT 1,
        details         TEXT,
        UNIQUE(date, rule_id)
    )""")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_signals_date ON rule_signals(date)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_signals_rule ON rule_signals(rule_id, date)")

    # Candidate rules: discovered by the pattern agent, pending human review
    cur.execute("""
    CREATE TABLE IF NOT EXISTS candidate_rules (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_description TEXT NOT NULL,
        conditions          TEXT NOT NULL,
        signal              TEXT NOT NULL,
        statistical_confidence REAL,
        sample_count        INTEGER,
        pct_correct         REAL,
        avg_return          REAL,
        volatility_impact   REAL,
        discovered_date     TEXT,
        reviewed            INTEGER DEFAULT 0,
        approved            INTEGER DEFAULT 0,
        promoted_to_rule_id INTEGER REFERENCES rules(id),
        notes               TEXT
    )""")

    conn.commit()
    print("Schema created successfully.")


if __name__ == '__main__':
    conn = get_connection()
    create_schema(conn)
    conn.close()
    print(f"Database at: {DB_PATH}")
