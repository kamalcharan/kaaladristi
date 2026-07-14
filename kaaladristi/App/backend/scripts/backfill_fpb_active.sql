-- backfill_fpb_active.sql
-- Target DB: kaala_dristi_db  ·  Requires migration 156 (km_fpb_active).
--
-- Populate km_fpb_active with the last ~90 days of Flower Pot Burst (up) and
-- Flower Pot Shatter (down) releases, each with its realized outcome, so the
-- "Live Releases · Day 2+" strip shows a real track record immediately instead
-- of waiting for the next rare release to fire.
--
-- Releases are rare (bursts ~2x/month, shatters rarer), so expect a handful of
-- rows. Outcome per release, judged against the following bars:
--   CRACKED    — reversed on day 2 (>=2 of: back past midpoint, volume didn't
--                follow, couldn't hold the release close)
--   TARGET_HIT — reached the ~10% target within ~12 sessions
--   STOPPED    — closed through the stop (burst low / shatter high)
--   EXPIRED    — held day 2 but hit neither target nor stop in the window
--
-- One-shot. Heavy (window scan over ~200 days of NSE history) — expect a minute
-- or two. Idempotent (ON CONFLICT DO NOTHING). Safe to re-run.

BEGIN;

INSERT INTO km_fpb_active (
  equity_id, symbol, direction, release_date,
  release_open, release_high, release_low, release_close, release_volume,
  release_midpoint, sl_level, target_level, quality, status,
  last_eval_date, last_close)
WITH base AS (
  SELECT e.equity_id, e.trade_date, e.open, e.high, e.low, e.close, e.prev_close, e.volume,
         e.magic_rs, e.stage, e.delivery_pct, a.symbol,
         GREATEST(e.high - e.low, abs(e.high - e.prev_close), abs(e.low - e.prev_close)) AS tr,
         (e.high - e.low) AS rng
  FROM km_equity_eod e
  JOIN km_equity_symbols a ON a.id = e.equity_id AND a.exchange = 'NSE' AND a.is_active = true
  WHERE e.trade_date > CURRENT_DATE - INTERVAL '200 days'
),
w AS (
  SELECT b.*,
    avg(tr)     OVER w15 AS atr15, avg(tr) OVER w60 AS atr60,
    avg(volume) OVER w5  AS vol5,  avg(volume) OVER w22 AS vol22,
    max(high)   OVER w10 AS hi10,  min(low) OVER w10 AS lo10,
    avg(rng)    OVER w15 AS avgrng15,
    lag(magic_rs,5) OVER ford AS rs5,
    count(*)    OVER w60 AS nbars
  FROM base b
  WINDOW
    ford AS (PARTITION BY equity_id ORDER BY trade_date),
    w5  AS (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 4  PRECEDING AND CURRENT ROW),
    w10 AS (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 9  PRECEDING AND CURRENT ROW),
    w15 AS (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 14 PRECEDING AND CURRENT ROW),
    w22 AS (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 21 PRECEDING AND CURRENT ROW),
    w60 AS (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 59 PRECEDING AND CURRENT ROW)
),
flag AS (
  SELECT w.*,
    CASE WHEN atr15/NULLIF(atr60,0) < 0.8 AND (hi10-lo10)/NULLIF(close,0) < 0.08
          AND vol5/NULLIF(vol22,0) < 0.6 AND abs(magic_rs-rs5) < 2
          AND nbars >= 60 AND close > 20 AND stage NOT IN ('S3','S4') THEN 1 ELSE 0 END AS compressed
  FROM w
),
sig AS (
  SELECT f.*,
    max(compressed) OVER (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 22 PRECEDING AND 1 PRECEDING) AS setup_prior22,
    sum(compressed) OVER (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 21 PRECEDING AND CURRENT ROW) AS setup_days22,
    lag(hi10,1) OVER ford AS hi10_prior,
    lag(lo10,1) OVER ford AS lo10_prior,
    volume       / NULLIF(lag(vol22,1)    OVER ford, 0) AS vb,
    (high - low) / NULLIF(lag(avgrng15,1) OVER ford, 0) AS re,
    (close - low)/ NULLIF(high - low, 0) AS cs
  FROM flag f
  WINDOW ford AS (PARTITION BY equity_id ORDER BY trade_date)
),
releases AS (
  SELECT equity_id, symbol, trade_date, open, high, low, close, volume, delivery_pct,
    (high + low)/2.0 AS midpoint, vb, re, cs,
    CASE WHEN cs >= 0.7 AND close > hi10_prior THEN 'UP' ELSE 'DOWN' END AS direction
  FROM sig
  WHERE trade_date > CURRENT_DATE - INTERVAL '90 days'
    AND setup_prior22 = 1 AND vb >= 3 AND re >= 2 AND delivery_pct > 45
    AND ( (cs >= 0.7 AND close > hi10_prior) OR (cs <= 0.3 AND close < lo10_prior) )
)
SELECT
  r.equity_id, r.symbol, r.direction, r.trade_date,
  r.open, r.high, r.low, r.close, r.volume, r.midpoint,
  CASE WHEN r.direction = 'UP' THEN r.low ELSE r.high END,
  CASE WHEN r.direction = 'UP' THEN round(r.close * 1.10, 2) ELSE round(r.close * 0.90, 2) END,
  CASE WHEN r.direction = 'UP' THEN round(((r.vb/3.0)*(r.re/2.0)*r.cs*(r.delivery_pct/50.0))::numeric, 2)
       ELSE round(((r.vb/3.0)*(r.re/2.0)*(1-r.cs)*(r.delivery_pct/50.0))::numeric, 2) END,
  CASE
    WHEN d2.d2_close IS NULL THEN 'ACTIVE'
    WHEN r.direction = 'UP'   AND ((d2.d2_close < r.midpoint)::int + (d2.d2_vol < 0.7*r.volume)::int + (d2.d2_high < r.close)::int) >= 2 THEN 'CRACKED'
    WHEN r.direction = 'DOWN' AND ((d2.d2_close > r.midpoint)::int + (d2.d2_vol < 0.7*r.volume)::int + (d2.d2_low  > r.close)::int) >= 2 THEN 'CRACKED'
    WHEN r.direction = 'UP'   AND fwd.mx_high >= round(r.close*1.10, 2) THEN 'TARGET_HIT'
    WHEN r.direction = 'DOWN' AND fwd.mn_low  <= round(r.close*0.90, 2) THEN 'TARGET_HIT'
    WHEN r.direction = 'UP'   AND fwd.mn_close < r.low  THEN 'STOPPED'
    WHEN r.direction = 'DOWN' AND fwd.mx_close > r.high THEN 'STOPPED'
    ELSE 'EXPIRED'
  END,
  COALESCE(fwd.last_date, d2.d2_date),
  COALESCE(fwd.last_close_val, d2.d2_close)
FROM releases r
LEFT JOIN LATERAL (
  SELECT e2.trade_date AS d2_date, e2.close AS d2_close, e2.high AS d2_high, e2.low AS d2_low, e2.volume AS d2_vol
  FROM km_equity_eod e2
  WHERE e2.equity_id = r.equity_id AND e2.trade_date > r.trade_date
  ORDER BY e2.trade_date LIMIT 1
) d2 ON true
LEFT JOIN LATERAL (
  SELECT max(e3.high) AS mx_high, min(e3.low) AS mn_low, min(e3.close) AS mn_close, max(e3.close) AS mx_close,
         max(e3.trade_date) AS last_date,
         (array_agg(e3.close ORDER BY e3.trade_date DESC))[1] AS last_close_val
  FROM km_equity_eod e3
  WHERE e3.equity_id = r.equity_id
    AND e3.trade_date > r.trade_date AND e3.trade_date <= r.trade_date + INTERVAL '16 days'
) fwd ON true
ON CONFLICT (equity_id, release_date, direction) DO NOTHING;

COMMIT;

-- Verify — the release track record by direction and outcome:
--   SELECT direction, status, count(*) FROM km_fpb_active GROUP BY 1,2 ORDER BY 1,2;
--   SELECT symbol, direction, release_date, status, release_close, sl_level, target_level
--   FROM km_fpb_active ORDER BY release_date DESC;
