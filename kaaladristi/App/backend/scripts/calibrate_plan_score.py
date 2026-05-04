"""
calibrate_plan_score.py
=======================
Computes the NORMALIZER for the Intraday Page Plan Score (per spec §6).

Plan Score raw = SUM(strength * signed_direction) over planetary rules
  active on a date in km_rule_signals.

Normalizer = 95th percentile of |plan_raw| across all historical dates
that had at least one planetary rule signal. Stored in
km_score_calibration with score_name = 'intraday_plan_score'.

The frontend formula:
    plan_score = clamp(plan_raw / NORMALIZER * 2, -2, 2)

so a date at the 95th percentile reaches ±2.0 (the design ceiling).

Usage (from App/backend):
    python scripts/calibrate_plan_score.py
    python scripts/calibrate_plan_score.py --percentile 90
    python scripts/calibrate_plan_score.py --dry-run
"""

import os
import sys
import argparse
import psycopg2
import psycopg2.extras

script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(script_dir, '..'))
sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '..', '.env'))

from lib.config import DATABASE_URL


# Same SQL is consumed by the /api/intraday/plan-score endpoint —
# kept in one place so they can't drift.
PLAN_SCORE_RAW_SQL = """
    SELECT
      COALESCE(SUM(
        CASE
          WHEN s.signal IN ('strong_bullish','bullish')   THEN  s.strength
          WHEN s.signal =  'mild_bullish'                 THEN  s.strength * 0.5
          WHEN s.signal =  'mild_bearish'                 THEN -s.strength * 0.5
          WHEN s.signal IN ('strong_bearish','bearish')   THEN -s.strength
          ELSE 0
        END
      ), 0)::NUMERIC AS plan_raw,
      COUNT(*)        AS contributing_rules
    FROM km_rule_signals      s
    JOIN km_astro_rule_master r ON r.id = s.rule_id
    WHERE s.date = %(date)s
      AND r.is_active   = TRUE
      AND r.is_deleted  = FALSE
      AND r.rule_type IN ('planet_state','planet_transit',
                          'planet_conjunction','vedh','eclipse')
"""


_PERCENTILE_SQL = """
    WITH plan_per_date AS (
      SELECT
        s.date,
        SUM(
          CASE
            WHEN s.signal IN ('strong_bullish','bullish')   THEN  s.strength
            WHEN s.signal =  'mild_bullish'                 THEN  s.strength * 0.5
            WHEN s.signal =  'mild_bearish'                 THEN -s.strength * 0.5
            WHEN s.signal IN ('strong_bearish','bearish')   THEN -s.strength
            ELSE 0
          END
        )::NUMERIC AS plan_raw
      FROM km_rule_signals      s
      JOIN km_astro_rule_master r ON r.id = s.rule_id
      WHERE r.is_active   = TRUE
        AND r.is_deleted  = FALSE
        AND r.rule_type IN ('planet_state','planet_transit',
                            'planet_conjunction','vedh','eclipse')
      GROUP BY s.date
    )
    SELECT
      PERCENTILE_CONT(%(p)s) WITHIN GROUP (ORDER BY ABS(plan_raw)) AS normalizer,
      COUNT(*) AS sample_count
    FROM plan_per_date
    WHERE plan_raw <> 0
"""


_UPSERT_SQL = """
    INSERT INTO km_score_calibration
      (score_name, normalizer, sample_count, percentile, notes)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT (score_name) DO UPDATE
      SET normalizer   = EXCLUDED.normalizer,
          sample_count = EXCLUDED.sample_count,
          percentile   = EXCLUDED.percentile,
          computed_at  = now(),
          notes        = EXCLUDED.notes
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--percentile', type=float, default=0.95,
                        help='Percentile of |plan_raw| to use (default 0.95)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Compute and print but do not write')
    args = parser.parse_args()

    if not (0 < args.percentile < 1):
        print(f'ERROR: --percentile must be in (0, 1), got {args.percentile}')
        sys.exit(1)

    if not DATABASE_URL:
        print('ERROR: DATABASE_URL not set — check App/.env')
        sys.exit(1)

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(_PERCENTILE_SQL, {'p': args.percentile})
            row = cur.fetchone()
            if not row or row['normalizer'] is None:
                print('No planetary rule signals found — nothing to calibrate.')
                sys.exit(2)
            normalizer   = float(row['normalizer'])
            sample_count = int(row['sample_count'])

        notes = (
            f'p={args.percentile} of |plan_raw| over {sample_count} non-zero '
            f'historical dates. plan_score = clamp(plan_raw / normalizer * 2, -2, 2).'
        )

        print(f'normalizer    = {normalizer:.4f}')
        print(f'percentile    = {args.percentile}')
        print(f'sample_count  = {sample_count}')
        print(f'notes         = {notes}')

        if args.dry_run:
            print('\n[DRY RUN] not written.')
            return

        with conn.cursor() as cur:
            cur.execute(_UPSERT_SQL, (
                'intraday_plan_score',
                normalizer,
                sample_count,
                args.percentile,
                notes,
            ))
        conn.commit()
        print('\nWritten to km_score_calibration.score_name=intraday_plan_score')

    except Exception as e:
        conn.rollback()
        print(f'FATAL: {e}')
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
