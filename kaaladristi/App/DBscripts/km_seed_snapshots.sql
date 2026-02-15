-- ============================================================================
-- KĀLA-DRISHTI SNAPSHOT SEED DATA
-- Run this in Supabase SQL Editor to populate km_daily_snapshots
-- with sample data so the /api/snapshot edge function returns results.
--
-- Covers: 2026-02-09 to 2026-02-21 (Mon-Fri trading days + weekends)
-- Symbols: NIFTY, BANKNIFTY, NIFTYIT, NIFTYFMCG
-- ============================================================================

-- Helper: generate snapshots for a date range × symbol list
-- Each INSERT uses ON CONFLICT to be safely re-runnable.

-- ── NIFTY snapshots ──

INSERT INTO km_daily_snapshots (date, symbol, version, snapshot) VALUES

-- 2026-02-09 (Monday)
('2026-02-09', 'NIFTY', 1, '{
  "date": "2026-02-09",
  "symbol": "NIFTY",
  "version": 1,
  "generated_at": "2026-02-09T10:00:00Z",
  "risk": {
    "composite_score": 38.5,
    "regime": "expansion",
    "structural": 8.2,
    "momentum": 11.3,
    "volatility": 12.0,
    "deception": 7.0,
    "explanation": "Moderate conditions (score: 38.5). Favorable for measured exposure. Momentum dimension contributes most (11.3/25)."
  },
  "panchang": {
    "tithi_num": 12,
    "tithi_name": "Dwadashi",
    "paksha": "shukla",
    "nakshatra_name": "Pushya",
    "nakshatra_pada": 3,
    "yoga_name": "Shobhana",
    "karana_name": "Baalava",
    "vara": "Monday",
    "dlnl_match": false,
    "is_sankranti": false,
    "is_purnima": false,
    "is_amavasya": false,
    "is_ekadashi": false,
    "sunrise": "06:55:12"
  },
  "planets": [
    {"planet": "Sun", "longitude": 326.12, "speed": 1.01, "retrograde": false, "sign": "Aquarius", "nakshatra": "Shatabhisha", "nakshatra_pada": 3, "combust": false},
    {"planet": "Moon", "longitude": 98.45, "speed": 13.2, "retrograde": false, "sign": "Cancer", "nakshatra": "Pushya", "nakshatra_pada": 3, "combust": false},
    {"planet": "Mars", "longitude": 85.67, "speed": 0.62, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 1, "combust": false},
    {"planet": "Mercury", "longitude": 312.34, "speed": 1.45, "retrograde": false, "sign": "Aquarius", "nakshatra": "Shatabhisha", "nakshatra_pada": 1, "combust": false},
    {"planet": "Jupiter", "longitude": 78.90, "speed": 0.11, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 1, "combust": false},
    {"planet": "Venus", "longitude": 345.23, "speed": 1.22, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 1, "combust": false},
    {"planet": "Saturn", "longitude": 350.78, "speed": 0.05, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false},
    {"planet": "Rahu", "longitude": 350.12, "speed": -0.05, "retrograde": true, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 1, "combust": false},
    {"planet": "Ketu", "longitude": 170.12, "speed": -0.05, "retrograde": true, "sign": "Virgo", "nakshatra": "Hastha", "nakshatra_pada": 3, "combust": false}
  ],
  "aspects": [
    {"planet_1": "Jupiter", "planet_2": "Saturn", "aspect_type": "square", "angle": 91.88, "orb": 1.88, "exact": false},
    {"planet_1": "Sun", "planet_2": "Saturn", "aspect_type": "conjunction", "angle": 24.66, "orb": 5.34, "exact": false}
  ],
  "events": [],
  "signals": {
    "net_score": 1.5,
    "classification": "mildly_bullish",
    "fired_count": 5,
    "total_rules": 18,
    "rules": [
      {"code": "R003", "name": "Moon in Pushya", "category": "nakshatra", "signal": "bullish", "strength": 1.0},
      {"code": "R007", "name": "Jupiter Direct", "category": "planetary", "signal": "bullish", "strength": 1.5},
      {"code": "R012", "name": "Rahu-Ketu Axis Active", "category": "nodal", "signal": "bearish", "strength": 1.0}
    ]
  },
  "sectors": [
    {"sector": "Banking & Finance", "factor_type": "moon_nakshatra", "volatility_multiplier": 1.02, "direction": "bullish"},
    {"sector": "Information Technology", "factor_type": "day_lord", "volatility_multiplier": 1.01, "direction": "bullish"}
  ],
  "outlook": [
    {"date": "2026-02-09", "score": 38.5, "regime": "expansion"},
    {"date": "2026-02-10", "score": 42.1, "regime": "expansion"},
    {"date": "2026-02-11", "score": 45.0, "regime": "expansion"},
    {"date": "2026-02-12", "score": 40.3, "regime": "expansion"},
    {"date": "2026-02-13", "score": 36.8, "regime": "expansion"},
    {"date": "2026-02-14", "score": 33.2, "regime": "expansion"},
    {"date": "2026-02-15", "score": 35.0, "regime": "expansion"}
  ],
  "market": {
    "trade_date": "2026-02-07",
    "close": 23508.40,
    "prev_close": 23482.15,
    "change": 26.25,
    "pct_change": 0.11,
    "open": 23495.00,
    "high": 23565.80,
    "low": 23420.10,
    "volume": 382000000,
    "w52_high": 26277.35,
    "w52_low": 21964.60
  }
}'::jsonb),

-- 2026-02-10 (Tuesday)
('2026-02-10', 'NIFTY', 1, '{
  "date": "2026-02-10",
  "symbol": "NIFTY",
  "version": 1,
  "generated_at": "2026-02-10T10:00:00Z",
  "risk": {
    "composite_score": 42.1,
    "regime": "expansion",
    "structural": 9.5,
    "momentum": 12.6,
    "volatility": 13.0,
    "deception": 7.0,
    "explanation": "Moderate conditions (score: 42.1). Favorable for measured exposure. Volatility dimension shows slight uptick."
  },
  "panchang": {
    "tithi_num": 13,
    "tithi_name": "Trayodashi",
    "paksha": "shukla",
    "nakshatra_name": "Ashlesha",
    "nakshatra_pada": 1,
    "yoga_name": "Atiganda",
    "karana_name": "Kaulava",
    "vara": "Tuesday",
    "dlnl_match": true,
    "is_sankranti": false,
    "is_purnima": false,
    "is_amavasya": false,
    "is_ekadashi": false,
    "sunrise": "06:54:30"
  },
  "planets": [
    {"planet": "Sun", "longitude": 327.13, "speed": 1.01, "retrograde": false, "sign": "Aquarius", "nakshatra": "Shatabhisha", "nakshatra_pada": 3, "combust": false},
    {"planet": "Moon", "longitude": 112.30, "speed": 12.8, "retrograde": false, "sign": "Cancer", "nakshatra": "Ashlesha", "nakshatra_pada": 1, "combust": false},
    {"planet": "Mars", "longitude": 86.05, "speed": 0.61, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 2, "combust": false},
    {"planet": "Mercury", "longitude": 313.80, "speed": 1.44, "retrograde": false, "sign": "Aquarius", "nakshatra": "Shatabhisha", "nakshatra_pada": 1, "combust": false},
    {"planet": "Jupiter", "longitude": 78.92, "speed": 0.11, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 1, "combust": false},
    {"planet": "Venus", "longitude": 346.45, "speed": 1.22, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 1, "combust": false},
    {"planet": "Saturn", "longitude": 350.83, "speed": 0.05, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false},
    {"planet": "Rahu", "longitude": 350.07, "speed": -0.05, "retrograde": true, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 1, "combust": false},
    {"planet": "Ketu", "longitude": 170.07, "speed": -0.05, "retrograde": true, "sign": "Virgo", "nakshatra": "Hastha", "nakshatra_pada": 3, "combust": false}
  ],
  "aspects": [
    {"planet_1": "Mars", "planet_2": "Jupiter", "aspect_type": "conjunction", "angle": 7.13, "orb": 2.87, "exact": false}
  ],
  "events": [],
  "signals": {
    "net_score": 0.5,
    "classification": "mildly_bullish",
    "fired_count": 4,
    "total_rules": 18,
    "rules": [
      {"code": "R002", "name": "Tuesday Mars Day", "category": "vara", "signal": "bearish", "strength": 0.5},
      {"code": "R007", "name": "Jupiter Direct", "category": "planetary", "signal": "bullish", "strength": 1.5},
      {"code": "R015", "name": "DLNL Match", "category": "panchang", "signal": "bearish", "strength": 0.5}
    ]
  },
  "sectors": [
    {"sector": "Iron & Steel", "factor_type": "day_lord", "volatility_multiplier": 1.04, "direction": "bullish"},
    {"sector": "Defence", "factor_type": "day_lord", "volatility_multiplier": 1.03, "direction": "bullish"}
  ],
  "outlook": [
    {"date": "2026-02-10", "score": 42.1, "regime": "expansion"},
    {"date": "2026-02-11", "score": 45.0, "regime": "expansion"},
    {"date": "2026-02-12", "score": 40.3, "regime": "expansion"},
    {"date": "2026-02-13", "score": 36.8, "regime": "expansion"},
    {"date": "2026-02-14", "score": 33.2, "regime": "expansion"},
    {"date": "2026-02-15", "score": 35.0, "regime": "expansion"},
    {"date": "2026-02-16", "score": 37.5, "regime": "expansion"}
  ],
  "market": {
    "trade_date": "2026-02-09",
    "close": 23545.70,
    "prev_close": 23508.40,
    "change": 37.30,
    "pct_change": 0.16,
    "open": 23520.00,
    "high": 23610.50,
    "low": 23480.20,
    "volume": 395000000,
    "w52_high": 26277.35,
    "w52_low": 21964.60
  }
}'::jsonb),

-- 2026-02-11 (Wednesday)
('2026-02-11', 'NIFTY', 1, '{
  "date": "2026-02-11",
  "symbol": "NIFTY",
  "version": 1,
  "generated_at": "2026-02-11T10:00:00Z",
  "risk": {
    "composite_score": 45.0,
    "regime": "expansion",
    "structural": 10.0,
    "momentum": 13.5,
    "volatility": 14.0,
    "deception": 7.5,
    "explanation": "Moderate conditions (score: 45.0). Approaching distribution territory. Monitor momentum closely."
  },
  "panchang": {
    "tithi_num": 14,
    "tithi_name": "Chaturdashi",
    "paksha": "shukla",
    "nakshatra_name": "Magha",
    "nakshatra_pada": 2,
    "yoga_name": "Sukarma",
    "karana_name": "Taitila",
    "vara": "Wednesday",
    "dlnl_match": false,
    "is_sankranti": false,
    "is_purnima": false,
    "is_amavasya": false,
    "is_ekadashi": false,
    "sunrise": "06:53:48"
  },
  "planets": [
    {"planet": "Sun", "longitude": 328.14, "speed": 1.01, "retrograde": false, "sign": "Aquarius", "nakshatra": "Purva Bhadra", "nakshatra_pada": 1, "combust": false},
    {"planet": "Moon", "longitude": 125.80, "speed": 13.5, "retrograde": false, "sign": "Leo", "nakshatra": "Magha", "nakshatra_pada": 2, "combust": false},
    {"planet": "Mars", "longitude": 86.43, "speed": 0.61, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 2, "combust": false},
    {"planet": "Mercury", "longitude": 315.25, "speed": 1.43, "retrograde": false, "sign": "Aquarius", "nakshatra": "Shatabhisha", "nakshatra_pada": 2, "combust": false},
    {"planet": "Jupiter", "longitude": 78.94, "speed": 0.11, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 1, "combust": false},
    {"planet": "Venus", "longitude": 347.67, "speed": 1.22, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 1, "combust": false},
    {"planet": "Saturn", "longitude": 350.88, "speed": 0.05, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false},
    {"planet": "Rahu", "longitude": 350.02, "speed": -0.05, "retrograde": true, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 1, "combust": false},
    {"planet": "Ketu", "longitude": 170.02, "speed": -0.05, "retrograde": true, "sign": "Virgo", "nakshatra": "Hastha", "nakshatra_pada": 3, "combust": false}
  ],
  "aspects": [
    {"planet_1": "Mars", "planet_2": "Jupiter", "aspect_type": "conjunction", "angle": 7.49, "orb": 2.51, "exact": false},
    {"planet_1": "Venus", "planet_2": "Saturn", "aspect_type": "conjunction", "angle": 3.21, "orb": 3.21, "exact": false}
  ],
  "events": [
    {"event_type": "approaching_conjunction", "planet": "Venus", "from_value": "347.67", "to_value": "Saturn at 350.88", "severity": "medium"}
  ],
  "signals": {
    "net_score": -0.5,
    "classification": "neutral",
    "fired_count": 6,
    "total_rules": 18,
    "rules": [
      {"code": "R004", "name": "Mercury Day Boost", "category": "vara", "signal": "bullish", "strength": 0.5},
      {"code": "R007", "name": "Jupiter Direct", "category": "planetary", "signal": "bullish", "strength": 1.5},
      {"code": "R010", "name": "Venus-Saturn Conjunction", "category": "aspect", "signal": "bearish", "strength": 1.5},
      {"code": "R012", "name": "Rahu-Ketu Axis Active", "category": "nodal", "signal": "bearish", "strength": 1.0}
    ]
  },
  "sectors": [
    {"sector": "Information Technology", "factor_type": "day_lord", "volatility_multiplier": 1.03, "direction": "bullish"},
    {"sector": "Telecommunication", "factor_type": "day_lord", "volatility_multiplier": 1.02, "direction": "bullish"},
    {"sector": "Banking & Finance", "factor_type": "moon_nakshatra", "volatility_multiplier": 1.01, "direction": "bearish"}
  ],
  "outlook": [
    {"date": "2026-02-11", "score": 45.0, "regime": "expansion"},
    {"date": "2026-02-12", "score": 40.3, "regime": "expansion"},
    {"date": "2026-02-13", "score": 36.8, "regime": "expansion"},
    {"date": "2026-02-14", "score": 33.2, "regime": "expansion"},
    {"date": "2026-02-15", "score": 35.0, "regime": "expansion"},
    {"date": "2026-02-16", "score": 37.5, "regime": "expansion"},
    {"date": "2026-02-17", "score": 41.0, "regime": "expansion"}
  ],
  "market": {
    "trade_date": "2026-02-10",
    "close": 23490.25,
    "prev_close": 23545.70,
    "change": -55.45,
    "pct_change": -0.24,
    "open": 23560.00,
    "high": 23580.30,
    "low": 23440.50,
    "volume": 410000000,
    "w52_high": 26277.35,
    "w52_low": 21964.60
  }
}'::jsonb),

-- 2026-02-12 (Thursday)
('2026-02-12', 'NIFTY', 1, '{
  "date": "2026-02-12",
  "symbol": "NIFTY",
  "version": 1,
  "generated_at": "2026-02-12T10:00:00Z",
  "risk": {
    "composite_score": 40.3,
    "regime": "expansion",
    "structural": 9.0,
    "momentum": 11.8,
    "volatility": 12.5,
    "deception": 7.0,
    "explanation": "Moderate conditions (score: 40.3). Expansion regime continues. Thursday Jupiter lord favors banking sector."
  },
  "panchang": {
    "tithi_num": 15,
    "tithi_name": "Purnima",
    "paksha": "shukla",
    "nakshatra_name": "Purva Phalguni",
    "nakshatra_pada": 4,
    "yoga_name": "Dhriti",
    "karana_name": "Bava",
    "vara": "Thursday",
    "dlnl_match": false,
    "is_sankranti": false,
    "is_purnima": true,
    "is_amavasya": false,
    "is_ekadashi": false,
    "sunrise": "06:53:05"
  },
  "planets": [
    {"planet": "Sun", "longitude": 329.15, "speed": 1.01, "retrograde": false, "sign": "Aquarius", "nakshatra": "Purva Bhadra", "nakshatra_pada": 1, "combust": false},
    {"planet": "Moon", "longitude": 143.50, "speed": 12.6, "retrograde": false, "sign": "Leo", "nakshatra": "Purva Phalguni", "nakshatra_pada": 4, "combust": false},
    {"planet": "Mars", "longitude": 86.81, "speed": 0.60, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 2, "combust": false},
    {"planet": "Mercury", "longitude": 316.70, "speed": 1.42, "retrograde": false, "sign": "Aquarius", "nakshatra": "Shatabhisha", "nakshatra_pada": 2, "combust": false},
    {"planet": "Jupiter", "longitude": 78.96, "speed": 0.11, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 1, "combust": false},
    {"planet": "Venus", "longitude": 348.89, "speed": 1.22, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false},
    {"planet": "Saturn", "longitude": 350.93, "speed": 0.05, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false},
    {"planet": "Rahu", "longitude": 349.97, "speed": -0.05, "retrograde": true, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 1, "combust": false},
    {"planet": "Ketu", "longitude": 169.97, "speed": -0.05, "retrograde": true, "sign": "Virgo", "nakshatra": "Hastha", "nakshatra_pada": 3, "combust": false}
  ],
  "aspects": [
    {"planet_1": "Venus", "planet_2": "Saturn", "aspect_type": "conjunction", "angle": 2.04, "orb": 2.04, "exact": false},
    {"planet_1": "Venus", "planet_2": "Rahu", "aspect_type": "conjunction", "angle": 1.08, "orb": 1.08, "exact": true}
  ],
  "events": [
    {"event_type": "purnima", "planet": "Moon", "from_value": null, "to_value": "Full Moon in Purva Phalguni", "severity": "high"}
  ],
  "signals": {
    "net_score": 2.0,
    "classification": "mildly_bullish",
    "fired_count": 7,
    "total_rules": 18,
    "rules": [
      {"code": "R005", "name": "Jupiter Day Lord", "category": "vara", "signal": "bullish", "strength": 1.0},
      {"code": "R007", "name": "Jupiter Direct", "category": "planetary", "signal": "bullish", "strength": 1.5},
      {"code": "R008", "name": "Purnima Effect", "category": "panchang", "signal": "bullish", "strength": 1.0},
      {"code": "R010", "name": "Venus-Saturn Conjunction", "category": "aspect", "signal": "bearish", "strength": 1.5}
    ]
  },
  "sectors": [
    {"sector": "Banking & Finance", "factor_type": "day_lord", "volatility_multiplier": 1.05, "direction": "bullish"},
    {"sector": "FMCG", "factor_type": "moon_nakshatra", "volatility_multiplier": 1.02, "direction": "bullish"}
  ],
  "outlook": [
    {"date": "2026-02-12", "score": 40.3, "regime": "expansion"},
    {"date": "2026-02-13", "score": 36.8, "regime": "expansion"},
    {"date": "2026-02-14", "score": 33.2, "regime": "expansion"},
    {"date": "2026-02-15", "score": 35.0, "regime": "expansion"},
    {"date": "2026-02-16", "score": 37.5, "regime": "expansion"},
    {"date": "2026-02-17", "score": 41.0, "regime": "expansion"},
    {"date": "2026-02-18", "score": 44.2, "regime": "expansion"}
  ],
  "market": {
    "trade_date": "2026-02-11",
    "close": 23532.80,
    "prev_close": 23490.25,
    "change": 42.55,
    "pct_change": 0.18,
    "open": 23480.00,
    "high": 23590.40,
    "low": 23465.30,
    "volume": 398000000,
    "w52_high": 26277.35,
    "w52_low": 21964.60
  }
}'::jsonb),

-- 2026-02-13 (Friday)
('2026-02-13', 'NIFTY', 1, '{
  "date": "2026-02-13",
  "symbol": "NIFTY",
  "version": 1,
  "generated_at": "2026-02-13T10:00:00Z",
  "risk": {
    "composite_score": 36.8,
    "regime": "expansion",
    "structural": 8.0,
    "momentum": 10.8,
    "volatility": 11.5,
    "deception": 6.5,
    "explanation": "Moderate conditions (score: 36.8). Risk declining — favorable trend. Venus day lord supports FMCG and luxury sectors."
  },
  "panchang": {
    "tithi_num": 1,
    "tithi_name": "Pratipada",
    "paksha": "krishna",
    "nakshatra_name": "Uttara Phalguni",
    "nakshatra_pada": 2,
    "yoga_name": "Shoola",
    "karana_name": "Kimstughna",
    "vara": "Friday",
    "dlnl_match": false,
    "is_sankranti": false,
    "is_purnima": false,
    "is_amavasya": false,
    "is_ekadashi": false,
    "sunrise": "06:52:22"
  },
  "planets": [
    {"planet": "Sun", "longitude": 330.16, "speed": 1.01, "retrograde": false, "sign": "Pisces", "nakshatra": "Purva Bhadra", "nakshatra_pada": 1, "combust": false},
    {"planet": "Moon", "longitude": 155.30, "speed": 13.0, "retrograde": false, "sign": "Leo", "nakshatra": "Uttara Phalguni", "nakshatra_pada": 2, "combust": false},
    {"planet": "Mars", "longitude": 87.19, "speed": 0.60, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 2, "combust": false},
    {"planet": "Mercury", "longitude": 318.15, "speed": 1.41, "retrograde": false, "sign": "Aquarius", "nakshatra": "Shatabhisha", "nakshatra_pada": 2, "combust": false},
    {"planet": "Jupiter", "longitude": 78.98, "speed": 0.11, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 1, "combust": false},
    {"planet": "Venus", "longitude": 350.11, "speed": 1.22, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false},
    {"planet": "Saturn", "longitude": 350.98, "speed": 0.05, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false},
    {"planet": "Rahu", "longitude": 349.92, "speed": -0.05, "retrograde": true, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 1, "combust": false},
    {"planet": "Ketu", "longitude": 169.92, "speed": -0.05, "retrograde": true, "sign": "Virgo", "nakshatra": "Hastha", "nakshatra_pada": 3, "combust": false}
  ],
  "aspects": [
    {"planet_1": "Venus", "planet_2": "Saturn", "aspect_type": "conjunction", "angle": 0.87, "orb": 0.87, "exact": true},
    {"planet_1": "Venus", "planet_2": "Rahu", "aspect_type": "conjunction", "angle": 0.19, "orb": 0.19, "exact": true}
  ],
  "events": [
    {"event_type": "exact_conjunction", "planet": "Venus", "from_value": "Revathi", "to_value": "conjunct Saturn & Rahu in Pisces", "severity": "high"}
  ],
  "signals": {
    "net_score": -1.0,
    "classification": "mildly_bearish",
    "fired_count": 8,
    "total_rules": 18,
    "rules": [
      {"code": "R006", "name": "Venus Day Lord", "category": "vara", "signal": "bullish", "strength": 0.5},
      {"code": "R010", "name": "Venus-Saturn Conjunction Exact", "category": "aspect", "signal": "bearish", "strength": 2.0},
      {"code": "R011", "name": "Venus-Rahu Conjunction", "category": "aspect", "signal": "bearish", "strength": 1.5},
      {"code": "R007", "name": "Jupiter Direct", "category": "planetary", "signal": "bullish", "strength": 1.5},
      {"code": "R016", "name": "Krishna Paksha Start", "category": "panchang", "signal": "bearish", "strength": 0.5}
    ]
  },
  "sectors": [
    {"sector": "FMCG", "factor_type": "day_lord", "volatility_multiplier": 1.04, "direction": "bullish"},
    {"sector": "Precious Pearls & Gems", "factor_type": "day_lord", "volatility_multiplier": 1.03, "direction": "bearish"},
    {"sector": "Banking & Finance", "factor_type": "moon_nakshatra", "volatility_multiplier": 1.02, "direction": "bearish"}
  ],
  "outlook": [
    {"date": "2026-02-13", "score": 36.8, "regime": "expansion"},
    {"date": "2026-02-14", "score": 33.2, "regime": "expansion"},
    {"date": "2026-02-15", "score": 35.0, "regime": "expansion"},
    {"date": "2026-02-16", "score": 37.5, "regime": "expansion"},
    {"date": "2026-02-17", "score": 41.0, "regime": "expansion"},
    {"date": "2026-02-18", "score": 44.2, "regime": "expansion"},
    {"date": "2026-02-19", "score": 48.5, "regime": "expansion"}
  ],
  "market": {
    "trade_date": "2026-02-12",
    "close": 23478.60,
    "prev_close": 23532.80,
    "change": -54.20,
    "pct_change": -0.23,
    "open": 23540.00,
    "high": 23555.70,
    "low": 23430.80,
    "volume": 425000000,
    "w52_high": 26277.35,
    "w52_low": 21964.60
  }
}'::jsonb),

-- 2026-02-14 (Saturday - non-trading, but snapshot still useful for calendar view)
('2026-02-14', 'NIFTY', 1, '{
  "date": "2026-02-14",
  "symbol": "NIFTY",
  "version": 1,
  "generated_at": "2026-02-14T10:00:00Z",
  "risk": {
    "composite_score": 33.2,
    "regime": "expansion",
    "structural": 7.5,
    "momentum": 9.7,
    "volatility": 10.0,
    "deception": 6.0,
    "explanation": "Low-moderate conditions (score: 33.2). Weekend — no trading. Risk trend improving heading into next week."
  },
  "panchang": {
    "tithi_num": 2,
    "tithi_name": "Dwitiya",
    "paksha": "krishna",
    "nakshatra_name": "Hastha",
    "nakshatra_pada": 1,
    "yoga_name": "Ganda",
    "karana_name": "Baalava",
    "vara": "Saturday",
    "dlnl_match": false,
    "is_sankranti": false,
    "is_purnima": false,
    "is_amavasya": false,
    "is_ekadashi": false,
    "sunrise": "06:51:38"
  },
  "planets": [
    {"planet": "Sun", "longitude": 331.17, "speed": 1.01, "retrograde": false, "sign": "Pisces", "nakshatra": "Purva Bhadra", "nakshatra_pada": 2, "combust": false},
    {"planet": "Moon", "longitude": 163.80, "speed": 12.4, "retrograde": false, "sign": "Virgo", "nakshatra": "Hastha", "nakshatra_pada": 1, "combust": false},
    {"planet": "Mars", "longitude": 87.57, "speed": 0.59, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 2, "combust": false},
    {"planet": "Mercury", "longitude": 319.60, "speed": 1.40, "retrograde": false, "sign": "Aquarius", "nakshatra": "Shatabhisha", "nakshatra_pada": 3, "combust": false},
    {"planet": "Jupiter", "longitude": 79.00, "speed": 0.11, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 1, "combust": false},
    {"planet": "Venus", "longitude": 351.33, "speed": 1.22, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false},
    {"planet": "Saturn", "longitude": 351.03, "speed": 0.05, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false},
    {"planet": "Rahu", "longitude": 349.87, "speed": -0.05, "retrograde": true, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 1, "combust": false},
    {"planet": "Ketu", "longitude": 169.87, "speed": -0.05, "retrograde": true, "sign": "Virgo", "nakshatra": "Hastha", "nakshatra_pada": 3, "combust": false}
  ],
  "aspects": [
    {"planet_1": "Venus", "planet_2": "Saturn", "aspect_type": "conjunction", "angle": 0.30, "orb": 0.30, "exact": true}
  ],
  "events": [],
  "signals": {
    "net_score": 0.0,
    "classification": "neutral",
    "fired_count": 3,
    "total_rules": 18,
    "rules": [
      {"code": "R001", "name": "Saturn Day Caution", "category": "vara", "signal": "bearish", "strength": 0.5},
      {"code": "R007", "name": "Jupiter Direct", "category": "planetary", "signal": "bullish", "strength": 1.5},
      {"code": "R012", "name": "Rahu-Ketu Axis Active", "category": "nodal", "signal": "bearish", "strength": 1.0}
    ]
  },
  "sectors": [],
  "outlook": [
    {"date": "2026-02-14", "score": 33.2, "regime": "expansion"},
    {"date": "2026-02-15", "score": 35.0, "regime": "expansion"},
    {"date": "2026-02-16", "score": 37.5, "regime": "expansion"},
    {"date": "2026-02-17", "score": 41.0, "regime": "expansion"},
    {"date": "2026-02-18", "score": 44.2, "regime": "expansion"},
    {"date": "2026-02-19", "score": 48.5, "regime": "expansion"},
    {"date": "2026-02-20", "score": 52.0, "regime": "distribution"}
  ],
  "market": {
    "trade_date": "2026-02-13",
    "close": 23510.15,
    "prev_close": 23478.60,
    "change": 31.55,
    "pct_change": 0.13,
    "open": 23470.00,
    "high": 23545.90,
    "low": 23455.20,
    "volume": 388000000,
    "w52_high": 26277.35,
    "w52_low": 21964.60
  }
}'::jsonb),

-- 2026-02-15 (Sunday / Today)
('2026-02-15', 'NIFTY', 1, '{
  "date": "2026-02-15",
  "symbol": "NIFTY",
  "version": 1,
  "generated_at": "2026-02-15T10:00:00Z",
  "risk": {
    "composite_score": 35.0,
    "regime": "expansion",
    "structural": 7.8,
    "momentum": 10.2,
    "volatility": 10.5,
    "deception": 6.5,
    "explanation": "Moderate conditions (score: 35.0). Expansion regime. Venus-Saturn separation easing tension. Next week outlook improving."
  },
  "panchang": {
    "tithi_num": 3,
    "tithi_name": "Tritiya",
    "paksha": "krishna",
    "nakshatra_name": "Chitra",
    "nakshatra_pada": 1,
    "yoga_name": "Vriddhi",
    "karana_name": "Kaulava",
    "vara": "Sunday",
    "dlnl_match": false,
    "is_sankranti": false,
    "is_purnima": false,
    "is_amavasya": false,
    "is_ekadashi": false,
    "sunrise": "06:50:55"
  },
  "planets": [
    {"planet": "Sun", "longitude": 332.18, "speed": 1.01, "retrograde": false, "sign": "Pisces", "nakshatra": "Purva Bhadra", "nakshatra_pada": 2, "combust": false},
    {"planet": "Moon", "longitude": 175.50, "speed": 13.1, "retrograde": false, "sign": "Virgo", "nakshatra": "Chitra", "nakshatra_pada": 1, "combust": false},
    {"planet": "Mars", "longitude": 87.95, "speed": 0.59, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 2, "combust": false},
    {"planet": "Mercury", "longitude": 321.05, "speed": 1.39, "retrograde": false, "sign": "Aquarius", "nakshatra": "Purva Bhadra", "nakshatra_pada": 1, "combust": false},
    {"planet": "Jupiter", "longitude": 79.02, "speed": 0.11, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 1, "combust": false},
    {"planet": "Venus", "longitude": 352.55, "speed": 1.22, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false},
    {"planet": "Saturn", "longitude": 351.08, "speed": 0.05, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false},
    {"planet": "Rahu", "longitude": 349.82, "speed": -0.05, "retrograde": true, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 1, "combust": false},
    {"planet": "Ketu", "longitude": 169.82, "speed": -0.05, "retrograde": true, "sign": "Virgo", "nakshatra": "Hastha", "nakshatra_pada": 3, "combust": false}
  ],
  "aspects": [
    {"planet_1": "Venus", "planet_2": "Saturn", "aspect_type": "conjunction", "angle": 1.47, "orb": 1.47, "exact": false},
    {"planet_1": "Mars", "planet_2": "Jupiter", "aspect_type": "conjunction", "angle": 8.93, "orb": 1.07, "exact": false}
  ],
  "events": [],
  "signals": {
    "net_score": 1.0,
    "classification": "mildly_bullish",
    "fired_count": 5,
    "total_rules": 18,
    "rules": [
      {"code": "R009", "name": "Sun Day Lord", "category": "vara", "signal": "neutral", "strength": 0.5},
      {"code": "R007", "name": "Jupiter Direct", "category": "planetary", "signal": "bullish", "strength": 1.5},
      {"code": "R010", "name": "Venus-Saturn Separating", "category": "aspect", "signal": "bearish", "strength": 0.5},
      {"code": "R017", "name": "Mars-Jupiter Influence", "category": "aspect", "signal": "bullish", "strength": 1.0}
    ]
  },
  "sectors": [
    {"sector": "Petrolium", "factor_type": "day_lord", "volatility_multiplier": 1.03, "direction": "bullish"},
    {"sector": "Power", "factor_type": "moon_nakshatra", "volatility_multiplier": 1.02, "direction": "bullish"},
    {"sector": "Iron & Steel", "factor_type": "moon_nakshatra", "volatility_multiplier": 1.01, "direction": "bearish"}
  ],
  "outlook": [
    {"date": "2026-02-15", "score": 35.0, "regime": "expansion"},
    {"date": "2026-02-16", "score": 37.5, "regime": "expansion"},
    {"date": "2026-02-17", "score": 41.0, "regime": "expansion"},
    {"date": "2026-02-18", "score": 44.2, "regime": "expansion"},
    {"date": "2026-02-19", "score": 48.5, "regime": "expansion"},
    {"date": "2026-02-20", "score": 52.0, "regime": "distribution"},
    {"date": "2026-02-21", "score": 55.3, "regime": "distribution"}
  ],
  "market": {
    "trade_date": "2026-02-13",
    "close": 23510.15,
    "prev_close": 23478.60,
    "change": 31.55,
    "pct_change": 0.13,
    "open": 23470.00,
    "high": 23545.90,
    "low": 23455.20,
    "volume": 388000000,
    "w52_high": 26277.35,
    "w52_low": 21964.60
  }
}'::jsonb),

-- 2026-02-16 (Monday)
('2026-02-16', 'NIFTY', 1, '{
  "date": "2026-02-16",
  "symbol": "NIFTY",
  "version": 1,
  "generated_at": "2026-02-16T10:00:00Z",
  "risk": {
    "composite_score": 37.5,
    "regime": "expansion",
    "structural": 8.0,
    "momentum": 10.5,
    "volatility": 12.0,
    "deception": 7.0,
    "explanation": "Moderate conditions (score: 37.5). Moon enters Libra — favorable for equilibrium-seeking trades."
  },
  "panchang": {
    "tithi_num": 4,
    "tithi_name": "Chaturthi",
    "paksha": "krishna",
    "nakshatra_name": "Swathi",
    "nakshatra_pada": 2,
    "yoga_name": "Dhruva",
    "karana_name": "Taitila",
    "vara": "Monday",
    "dlnl_match": false,
    "is_sankranti": false,
    "is_purnima": false,
    "is_amavasya": false,
    "is_ekadashi": false,
    "sunrise": "06:50:10"
  },
  "planets": [
    {"planet": "Sun", "longitude": 333.19, "speed": 1.01, "retrograde": false, "sign": "Pisces", "nakshatra": "Purva Bhadra", "nakshatra_pada": 2, "combust": false},
    {"planet": "Moon", "longitude": 190.20, "speed": 12.8, "retrograde": false, "sign": "Libra", "nakshatra": "Swathi", "nakshatra_pada": 2, "combust": false},
    {"planet": "Mars", "longitude": 88.33, "speed": 0.58, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 3, "combust": false},
    {"planet": "Mercury", "longitude": 322.50, "speed": 1.38, "retrograde": false, "sign": "Aquarius", "nakshatra": "Purva Bhadra", "nakshatra_pada": 1, "combust": false},
    {"planet": "Jupiter", "longitude": 79.04, "speed": 0.11, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 1, "combust": false},
    {"planet": "Venus", "longitude": 353.77, "speed": 1.22, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 3, "combust": false},
    {"planet": "Saturn", "longitude": 351.13, "speed": 0.05, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false},
    {"planet": "Rahu", "longitude": 349.77, "speed": -0.05, "retrograde": true, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 1, "combust": false},
    {"planet": "Ketu", "longitude": 169.77, "speed": -0.05, "retrograde": true, "sign": "Virgo", "nakshatra": "Hastha", "nakshatra_pada": 3, "combust": false}
  ],
  "aspects": [
    {"planet_1": "Mars", "planet_2": "Jupiter", "aspect_type": "conjunction", "angle": 9.29, "orb": 0.71, "exact": true}
  ],
  "events": [
    {"event_type": "exact_conjunction", "planet": "Mars", "from_value": "Punarvasu", "to_value": "conjunct Jupiter in Gemini", "severity": "high"}
  ],
  "signals": {
    "net_score": 2.5,
    "classification": "mildly_bullish",
    "fired_count": 6,
    "total_rules": 18,
    "rules": [
      {"code": "R003", "name": "Moon in Swathi", "category": "nakshatra", "signal": "bullish", "strength": 0.5},
      {"code": "R007", "name": "Jupiter Direct", "category": "planetary", "signal": "bullish", "strength": 1.5},
      {"code": "R017", "name": "Mars-Jupiter Exact Conjunction", "category": "aspect", "signal": "bullish", "strength": 1.5},
      {"code": "R012", "name": "Rahu-Ketu Axis Active", "category": "nodal", "signal": "bearish", "strength": 1.0}
    ]
  },
  "sectors": [
    {"sector": "Banking & Finance", "factor_type": "moon_nakshatra", "volatility_multiplier": 1.03, "direction": "bullish"},
    {"sector": "Iron & Steel", "factor_type": "aspect", "volatility_multiplier": 1.05, "direction": "bullish"},
    {"sector": "Defence", "factor_type": "aspect", "volatility_multiplier": 1.04, "direction": "bullish"}
  ],
  "outlook": [
    {"date": "2026-02-16", "score": 37.5, "regime": "expansion"},
    {"date": "2026-02-17", "score": 41.0, "regime": "expansion"},
    {"date": "2026-02-18", "score": 44.2, "regime": "expansion"},
    {"date": "2026-02-19", "score": 48.5, "regime": "expansion"},
    {"date": "2026-02-20", "score": 52.0, "regime": "distribution"},
    {"date": "2026-02-21", "score": 55.3, "regime": "distribution"},
    {"date": "2026-02-22", "score": 50.0, "regime": "expansion"}
  ],
  "market": {
    "trade_date": "2026-02-13",
    "close": 23510.15,
    "prev_close": 23478.60,
    "change": 31.55,
    "pct_change": 0.13,
    "open": 23470.00,
    "high": 23545.90,
    "low": 23455.20,
    "volume": 388000000,
    "w52_high": 26277.35,
    "w52_low": 21964.60
  }
}'::jsonb)

ON CONFLICT (date, symbol) DO UPDATE SET
  snapshot = EXCLUDED.snapshot,
  version = EXCLUDED.version,
  generated_at = now();


-- ── BANKNIFTY snapshots (key dates only) ──

INSERT INTO km_daily_snapshots (date, symbol, version, snapshot) VALUES

('2026-02-15', 'BANKNIFTY', 1, '{
  "date": "2026-02-15",
  "symbol": "BANKNIFTY",
  "version": 1,
  "generated_at": "2026-02-15T10:00:00Z",
  "risk": {
    "composite_score": 41.2,
    "regime": "expansion",
    "structural": 9.0,
    "momentum": 12.2,
    "volatility": 13.0,
    "deception": 7.0,
    "explanation": "Moderate conditions (score: 41.2). Banking sector supported by Jupiter direct in Gemini. Venus-Saturn conjunction creating mixed signals for financial services."
  },
  "panchang": {
    "tithi_num": 3,
    "tithi_name": "Tritiya",
    "paksha": "krishna",
    "nakshatra_name": "Chitra",
    "nakshatra_pada": 1,
    "yoga_name": "Vriddhi",
    "karana_name": "Kaulava",
    "vara": "Sunday",
    "dlnl_match": false,
    "is_sankranti": false,
    "is_purnima": false,
    "is_amavasya": false,
    "is_ekadashi": false,
    "sunrise": "06:50:55"
  },
  "planets": [
    {"planet": "Sun", "longitude": 332.18, "speed": 1.01, "retrograde": false, "sign": "Pisces", "nakshatra": "Purva Bhadra", "nakshatra_pada": 2, "combust": false},
    {"planet": "Moon", "longitude": 175.50, "speed": 13.1, "retrograde": false, "sign": "Virgo", "nakshatra": "Chitra", "nakshatra_pada": 1, "combust": false},
    {"planet": "Jupiter", "longitude": 79.02, "speed": 0.11, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 1, "combust": false},
    {"planet": "Saturn", "longitude": 351.08, "speed": 0.05, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false}
  ],
  "aspects": [
    {"planet_1": "Venus", "planet_2": "Saturn", "aspect_type": "conjunction", "angle": 1.47, "orb": 1.47, "exact": false}
  ],
  "events": [],
  "signals": {
    "net_score": 1.5,
    "classification": "mildly_bullish",
    "fired_count": 4,
    "total_rules": 18,
    "rules": [
      {"code": "R007", "name": "Jupiter Direct", "category": "planetary", "signal": "bullish", "strength": 1.5},
      {"code": "R005", "name": "Jupiter Rules Banking", "category": "sector", "signal": "bullish", "strength": 1.0},
      {"code": "R012", "name": "Rahu-Ketu Axis Active", "category": "nodal", "signal": "bearish", "strength": 1.0}
    ]
  },
  "sectors": [
    {"sector": "Banking & Finance", "factor_type": "planetary", "volatility_multiplier": 1.04, "direction": "bullish"},
    {"sector": "Private Banks", "factor_type": "planetary", "volatility_multiplier": 1.03, "direction": "bullish"},
    {"sector": "Financial Services", "factor_type": "aspect", "volatility_multiplier": 1.02, "direction": "bearish"}
  ],
  "outlook": [
    {"date": "2026-02-15", "score": 41.2, "regime": "expansion"},
    {"date": "2026-02-16", "score": 39.0, "regime": "expansion"},
    {"date": "2026-02-17", "score": 43.5, "regime": "expansion"},
    {"date": "2026-02-18", "score": 47.0, "regime": "expansion"},
    {"date": "2026-02-19", "score": 50.8, "regime": "expansion"},
    {"date": "2026-02-20", "score": 54.2, "regime": "distribution"},
    {"date": "2026-02-21", "score": 51.0, "regime": "distribution"}
  ],
  "market": {
    "trade_date": "2026-02-13",
    "close": 50125.40,
    "prev_close": 49980.75,
    "change": 144.65,
    "pct_change": 0.29,
    "open": 50010.00,
    "high": 50280.50,
    "low": 49900.30,
    "volume": 195000000,
    "w52_high": 54467.35,
    "w52_low": 44650.80
  }
}'::jsonb),

('2026-02-13', 'BANKNIFTY', 1, '{
  "date": "2026-02-13",
  "symbol": "BANKNIFTY",
  "version": 1,
  "generated_at": "2026-02-13T10:00:00Z",
  "risk": {
    "composite_score": 44.0,
    "regime": "expansion",
    "structural": 10.0,
    "momentum": 13.0,
    "volatility": 14.0,
    "deception": 7.0,
    "explanation": "Moderate conditions (score: 44.0). Venus-Saturn exact conjunction creates tension for financial assets. Jupiter direct provides support."
  },
  "panchang": {
    "tithi_num": 1,
    "tithi_name": "Pratipada",
    "paksha": "krishna",
    "nakshatra_name": "Uttara Phalguni",
    "nakshatra_pada": 2,
    "yoga_name": "Shoola",
    "karana_name": "Kimstughna",
    "vara": "Friday",
    "dlnl_match": false,
    "is_sankranti": false,
    "is_purnima": false,
    "is_amavasya": false,
    "is_ekadashi": false,
    "sunrise": "06:52:22"
  },
  "planets": [
    {"planet": "Sun", "longitude": 330.16, "speed": 1.01, "retrograde": false, "sign": "Pisces", "nakshatra": "Purva Bhadra", "nakshatra_pada": 1, "combust": false},
    {"planet": "Moon", "longitude": 155.30, "speed": 13.0, "retrograde": false, "sign": "Leo", "nakshatra": "Uttara Phalguni", "nakshatra_pada": 2, "combust": false},
    {"planet": "Jupiter", "longitude": 78.98, "speed": 0.11, "retrograde": false, "sign": "Gemini", "nakshatra": "Punarvasu", "nakshatra_pada": 1, "combust": false}
  ],
  "aspects": [
    {"planet_1": "Venus", "planet_2": "Saturn", "aspect_type": "conjunction", "angle": 0.87, "orb": 0.87, "exact": true}
  ],
  "events": [
    {"event_type": "exact_conjunction", "planet": "Venus", "from_value": "Revathi", "to_value": "conjunct Saturn in Pisces", "severity": "high"}
  ],
  "signals": {
    "net_score": -0.5,
    "classification": "neutral",
    "fired_count": 5,
    "total_rules": 18,
    "rules": [
      {"code": "R010", "name": "Venus-Saturn Conjunction Exact", "category": "aspect", "signal": "bearish", "strength": 2.0},
      {"code": "R007", "name": "Jupiter Direct", "category": "planetary", "signal": "bullish", "strength": 1.5}
    ]
  },
  "sectors": [
    {"sector": "Banking & Finance", "factor_type": "aspect", "volatility_multiplier": 1.06, "direction": "bearish"},
    {"sector": "Private Banks", "factor_type": "planetary", "volatility_multiplier": 1.03, "direction": "bullish"}
  ],
  "outlook": [
    {"date": "2026-02-13", "score": 44.0, "regime": "expansion"},
    {"date": "2026-02-14", "score": 40.5, "regime": "expansion"},
    {"date": "2026-02-15", "score": 41.2, "regime": "expansion"},
    {"date": "2026-02-16", "score": 39.0, "regime": "expansion"},
    {"date": "2026-02-17", "score": 43.5, "regime": "expansion"},
    {"date": "2026-02-18", "score": 47.0, "regime": "expansion"},
    {"date": "2026-02-19", "score": 50.8, "regime": "expansion"}
  ],
  "market": {
    "trade_date": "2026-02-12",
    "close": 49980.75,
    "prev_close": 50150.20,
    "change": -169.45,
    "pct_change": -0.34,
    "open": 50180.00,
    "high": 50220.60,
    "low": 49880.40,
    "volume": 210000000,
    "w52_high": 54467.35,
    "w52_low": 44650.80
  }
}'::jsonb)

ON CONFLICT (date, symbol) DO UPDATE SET
  snapshot = EXCLUDED.snapshot,
  version = EXCLUDED.version,
  generated_at = now();


-- ── NIFTYIT snapshots ──

INSERT INTO km_daily_snapshots (date, symbol, version, snapshot) VALUES

('2026-02-15', 'NIFTYIT', 1, '{
  "date": "2026-02-15",
  "symbol": "NIFTYIT",
  "version": 1,
  "generated_at": "2026-02-15T10:00:00Z",
  "risk": {
    "composite_score": 48.5,
    "regime": "expansion",
    "structural": 11.0,
    "momentum": 14.5,
    "volatility": 15.0,
    "deception": 8.0,
    "explanation": "Elevated moderate conditions (score: 48.5). IT sector sensitive to Rahu influences. Mercury in Aquarius supports technology but Rahu proximity adds uncertainty."
  },
  "panchang": {
    "tithi_num": 3,
    "tithi_name": "Tritiya",
    "paksha": "krishna",
    "nakshatra_name": "Chitra",
    "nakshatra_pada": 1,
    "yoga_name": "Vriddhi",
    "karana_name": "Kaulava",
    "vara": "Sunday",
    "dlnl_match": false,
    "is_sankranti": false,
    "is_purnima": false,
    "is_amavasya": false,
    "is_ekadashi": false,
    "sunrise": "06:50:55"
  },
  "planets": [
    {"planet": "Sun", "longitude": 332.18, "speed": 1.01, "retrograde": false, "sign": "Pisces", "nakshatra": "Purva Bhadra", "nakshatra_pada": 2, "combust": false},
    {"planet": "Moon", "longitude": 175.50, "speed": 13.1, "retrograde": false, "sign": "Virgo", "nakshatra": "Chitra", "nakshatra_pada": 1, "combust": false},
    {"planet": "Mercury", "longitude": 321.05, "speed": 1.39, "retrograde": false, "sign": "Aquarius", "nakshatra": "Purva Bhadra", "nakshatra_pada": 1, "combust": false},
    {"planet": "Rahu", "longitude": 349.82, "speed": -0.05, "retrograde": true, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 1, "combust": false}
  ],
  "aspects": [],
  "events": [],
  "signals": {
    "net_score": 0.5,
    "classification": "mildly_bullish",
    "fired_count": 4,
    "total_rules": 18,
    "rules": [
      {"code": "R014", "name": "Mercury in Own Sign", "category": "planetary", "signal": "bullish", "strength": 1.5},
      {"code": "R012", "name": "Rahu Active in IT Sector", "category": "nodal", "signal": "bearish", "strength": 1.0}
    ]
  },
  "sectors": [
    {"sector": "Information Technology", "factor_type": "planetary", "volatility_multiplier": 1.05, "direction": "bullish"},
    {"sector": "Digital", "factor_type": "nodal", "volatility_multiplier": 1.04, "direction": "bearish"}
  ],
  "outlook": [
    {"date": "2026-02-15", "score": 48.5, "regime": "expansion"},
    {"date": "2026-02-16", "score": 45.0, "regime": "expansion"},
    {"date": "2026-02-17", "score": 50.2, "regime": "expansion"},
    {"date": "2026-02-18", "score": 53.0, "regime": "distribution"},
    {"date": "2026-02-19", "score": 55.8, "regime": "distribution"},
    {"date": "2026-02-20", "score": 58.0, "regime": "distribution"},
    {"date": "2026-02-21", "score": 54.5, "regime": "distribution"}
  ],
  "market": {
    "trade_date": "2026-02-13",
    "close": 40250.80,
    "prev_close": 40180.45,
    "change": 70.35,
    "pct_change": 0.18,
    "open": 40200.00,
    "high": 40350.60,
    "low": 40120.30,
    "volume": 85000000,
    "w52_high": 44125.50,
    "w52_low": 33890.20
  }
}'::jsonb)

ON CONFLICT (date, symbol) DO UPDATE SET
  snapshot = EXCLUDED.snapshot,
  version = EXCLUDED.version,
  generated_at = now();


-- ── NIFTYFMCG snapshots ──

INSERT INTO km_daily_snapshots (date, symbol, version, snapshot) VALUES

('2026-02-15', 'NIFTYFMCG', 1, '{
  "date": "2026-02-15",
  "symbol": "NIFTYFMCG",
  "version": 1,
  "generated_at": "2026-02-15T10:00:00Z",
  "risk": {
    "composite_score": 29.8,
    "regime": "accumulation",
    "structural": 6.5,
    "momentum": 8.3,
    "volatility": 9.0,
    "deception": 6.0,
    "explanation": "Low risk environment (score: 29.8). Conditions support systematic accumulation. FMCG benefits from Venus day-lord influence and stable consumer demand cycle."
  },
  "panchang": {
    "tithi_num": 3,
    "tithi_name": "Tritiya",
    "paksha": "krishna",
    "nakshatra_name": "Chitra",
    "nakshatra_pada": 1,
    "yoga_name": "Vriddhi",
    "karana_name": "Kaulava",
    "vara": "Sunday",
    "dlnl_match": false,
    "is_sankranti": false,
    "is_purnima": false,
    "is_amavasya": false,
    "is_ekadashi": false,
    "sunrise": "06:50:55"
  },
  "planets": [
    {"planet": "Sun", "longitude": 332.18, "speed": 1.01, "retrograde": false, "sign": "Pisces", "nakshatra": "Purva Bhadra", "nakshatra_pada": 2, "combust": false},
    {"planet": "Moon", "longitude": 175.50, "speed": 13.1, "retrograde": false, "sign": "Virgo", "nakshatra": "Chitra", "nakshatra_pada": 1, "combust": false},
    {"planet": "Venus", "longitude": 352.55, "speed": 1.22, "retrograde": false, "sign": "Pisces", "nakshatra": "Revathi", "nakshatra_pada": 2, "combust": false}
  ],
  "aspects": [],
  "events": [],
  "signals": {
    "net_score": 2.0,
    "classification": "mildly_bullish",
    "fired_count": 3,
    "total_rules": 18,
    "rules": [
      {"code": "R013", "name": "Venus Exalted in Pisces", "category": "planetary", "signal": "bullish", "strength": 2.0},
      {"code": "R007", "name": "Jupiter Direct", "category": "planetary", "signal": "bullish", "strength": 1.5},
      {"code": "R010", "name": "Venus-Saturn Separating", "category": "aspect", "signal": "bearish", "strength": 0.5}
    ]
  },
  "sectors": [
    {"sector": "FMCG", "factor_type": "planetary", "volatility_multiplier": 1.03, "direction": "bullish"},
    {"sector": "Milk & Milk Products", "factor_type": "moon_sign", "volatility_multiplier": 1.02, "direction": "bullish"}
  ],
  "outlook": [
    {"date": "2026-02-15", "score": 29.8, "regime": "accumulation"},
    {"date": "2026-02-16", "score": 28.5, "regime": "accumulation"},
    {"date": "2026-02-17", "score": 31.0, "regime": "expansion"},
    {"date": "2026-02-18", "score": 33.5, "regime": "expansion"},
    {"date": "2026-02-19", "score": 36.0, "regime": "expansion"},
    {"date": "2026-02-20", "score": 38.2, "regime": "expansion"},
    {"date": "2026-02-21", "score": 35.0, "regime": "expansion"}
  ],
  "market": {
    "trade_date": "2026-02-13",
    "close": 56780.35,
    "prev_close": 56650.20,
    "change": 130.15,
    "pct_change": 0.23,
    "open": 56670.00,
    "high": 56850.40,
    "low": 56610.80,
    "volume": 42000000,
    "w52_high": 60125.80,
    "w52_low": 52340.50
  }
}'::jsonb)

ON CONFLICT (date, symbol) DO UPDATE SET
  snapshot = EXCLUDED.snapshot,
  version = EXCLUDED.version,
  generated_at = now();


-- ============================================================================
-- VERIFICATION: Count inserted rows
-- ============================================================================
-- Run this after the INSERT to verify:
-- SELECT symbol, count(*), min(date), max(date)
-- FROM km_daily_snapshots
-- GROUP BY symbol
-- ORDER BY symbol;
