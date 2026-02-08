"""
Kāla-Drishti Factor Correlation Analysis

For each planetary factor, empirically measure its historical impact on NIFTY:
  - % down days when factor is active vs baseline
  - Average return when active vs baseline
  - Average daily range (volatility) when active vs baseline
  - Sample count and statistical significance

This is the intelligence layer -- it proves (or disproves) each factor's market impact.
"""

import sys
import os
import math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'db'))

from schema import get_connection


def get_baseline_stats(conn, symbol, start_date, end_date):
    """Compute baseline market stats for comparison."""
    rows = conn.execute("""
        SELECT daily_return, daily_range_pct
        FROM market_daily
        WHERE symbol = ? AND date >= ? AND date <= ?
          AND daily_return IS NOT NULL
    """, (symbol, start_date, end_date)).fetchall()

    if not rows:
        return {}

    returns = [r['daily_return'] for r in rows]
    ranges = [r['daily_range_pct'] for r in rows if r['daily_range_pct'] is not None]

    return {
        'total_days': len(returns),
        'down_pct': len([r for r in returns if r < 0]) / len(returns) * 100,
        'avg_return': sum(returns) / len(returns),
        'avg_range': sum(ranges) / len(ranges) if ranges else 0,
    }


def analyze_factor_dates(conn, factor_name, active_dates, symbol, start_date, end_date, baseline):
    """
    Given a set of dates when a factor is active, compute correlation stats.
    """
    if not active_dates:
        return None

    # Get market data for active dates that fall within our trading range
    placeholders = ','.join(['?'] * len(active_dates))
    rows = conn.execute(f"""
        SELECT date, daily_return, daily_range_pct
        FROM market_daily
        WHERE symbol = ? AND date IN ({placeholders})
          AND daily_return IS NOT NULL
    """, [symbol] + list(active_dates)).fetchall()

    if len(rows) < 5:  # Need minimum sample size
        return None

    returns = [r['daily_return'] for r in rows]
    ranges = [r['daily_range_pct'] for r in rows if r['daily_range_pct'] is not None]

    down_days = len([r for r in returns if r < 0])
    down_pct = down_days / len(returns) * 100
    avg_return = sum(returns) / len(returns)
    avg_range = sum(ranges) / len(ranges) if ranges else 0
    vol_multiplier = avg_range / baseline['avg_range'] if baseline['avg_range'] > 0 else 1.0

    return {
        'factor_type': factor_name,
        'index_symbol': symbol,
        'sample_count': len(returns),
        'pct_down_days': round(down_pct, 2),
        'avg_return': round(avg_return, 4),
        'avg_range_pct': round(avg_range, 4),
        'volatility_multiplier': round(vol_multiplier, 2),
        'baseline_down_pct': round(baseline['down_pct'], 2),
        'baseline_avg_return': round(baseline['avg_return'], 4),
    }


# =========================================================================
# FACTOR EXTRACTORS
# Each returns a set of dates when the factor is active.
# =========================================================================

def get_retrograde_dates(conn, planet, start_date, end_date):
    """Dates when a planet is retrograde."""
    rows = conn.execute("""
        SELECT DISTINCT date FROM planetary_positions
        WHERE planet = ? AND retrograde = 1
          AND date >= ? AND date <= ?
    """, (planet, start_date, end_date)).fetchall()
    return {r['date'] for r in rows}


def get_aspect_dates(conn, planet_1, planet_2, aspect_types, start_date, end_date):
    """Dates when two planets are in specific aspects."""
    placeholders = ','.join(['?'] * len(aspect_types))
    rows = conn.execute(f"""
        SELECT DISTINCT date FROM planetary_aspects
        WHERE ((planet_1 = ? AND planet_2 = ?) OR (planet_1 = ? AND planet_2 = ?))
          AND aspect_type IN ({placeholders})
          AND date >= ? AND date <= ?
    """, [planet_1, planet_2, planet_2, planet_1] + list(aspect_types) +
       [start_date, end_date]).fetchall()
    return {r['date'] for r in rows}


def get_moon_nakshatra_dates(conn, nakshatras, start_date, end_date):
    """Dates when Moon is in specified nakshatras."""
    placeholders = ','.join(['?'] * len(nakshatras))
    # Use intraday (market open) for precision
    rows = conn.execute(f"""
        SELECT DISTINCT date FROM moon_intraday
        WHERE nakshatra_name IN ({placeholders})
          AND time_ist = '09:15'
          AND date >= ? AND date <= ?
    """, list(nakshatras) + [start_date, end_date]).fetchall()
    return {r['date'] for r in rows}


def get_gandanta_dates(conn, start_date, end_date):
    """Dates when Moon is in gandanta zone."""
    rows = conn.execute("""
        SELECT DISTINCT date FROM moon_intraday
        WHERE gandanta = 1
          AND date >= ? AND date <= ?
    """, (start_date, end_date)).fetchall()
    return {r['date'] for r in rows}


def get_nakshatra_change_dates(conn, start_date, end_date):
    """Dates when Moon changes nakshatra (transition days)."""
    rows = conn.execute("""
        SELECT DISTINCT event_date FROM astro_events
        WHERE event_type = 'nakshatra_change' AND planet = 'Moon'
          AND event_date >= ? AND event_date <= ?
    """, (start_date, end_date)).fetchall()
    return {r['event_date'] for r in rows}


# =========================================================================
# MAIN ANALYSIS
# =========================================================================

def run_all_correlations(conn, symbol='NIFTY', start_date='2000-01-01', end_date='2020-12-31'):
    """Run correlation analysis for all defined factors."""

    baseline = get_baseline_stats(conn, symbol, start_date, end_date)
    if not baseline:
        print("No baseline data found!")
        return []

    print(f"Baseline ({symbol}, {start_date} to {end_date}):")
    print(f"  {baseline['total_days']} trading days")
    print(f"  {baseline['down_pct']:.1f}% down days")
    print(f"  Avg return: {baseline['avg_return']:+.4f}%")
    print(f"  Avg daily range: {baseline['avg_range']:.4f}%")
    print()

    # Define all factors to analyze
    FACTORS = [
        # Retrogrades
        ('Mercury Retrograde', lambda: get_retrograde_dates(conn, 'Mercury', start_date, end_date)),
        ('Mars Retrograde', lambda: get_retrograde_dates(conn, 'Mars', start_date, end_date)),
        ('Saturn Retrograde', lambda: get_retrograde_dates(conn, 'Saturn', start_date, end_date)),
        ('Jupiter Retrograde', lambda: get_retrograde_dates(conn, 'Jupiter', start_date, end_date)),
        ('Venus Retrograde', lambda: get_retrograde_dates(conn, 'Venus', start_date, end_date)),

        # Key aspect pairs (hard aspects: conjunction, opposition, square)
        ('Mars-Saturn Hard Aspect',
         lambda: get_aspect_dates(conn, 'Mars', 'Saturn',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),
        ('Mars-Rahu Hard Aspect',
         lambda: get_aspect_dates(conn, 'Mars', 'Rahu',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),
        ('Mercury-Rahu Hard Aspect',
         lambda: get_aspect_dates(conn, 'Mercury', 'Rahu',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),
        ('Saturn-Rahu Hard Aspect',
         lambda: get_aspect_dates(conn, 'Saturn', 'Rahu',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),
        ('Jupiter-Saturn Hard Aspect',
         lambda: get_aspect_dates(conn, 'Jupiter', 'Saturn',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),
        ('Sun-Saturn Hard Aspect',
         lambda: get_aspect_dates(conn, 'Sun', 'Saturn',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),
        ('Sun-Mercury Hard Aspect',
         lambda: get_aspect_dates(conn, 'Sun', 'Mercury',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),

        # Moon factors
        ('Moon in Ardra/Arudra',
         lambda: get_moon_nakshatra_dates(conn, ['Ardra', 'Arudra'], start_date, end_date)),
        ('Moon in Moola',
         lambda: get_moon_nakshatra_dates(conn, ['Moola'], start_date, end_date)),
        ('Moon in Jyeshtha/Jyestha',
         lambda: get_moon_nakshatra_dates(conn, ['Jyeshtha', 'Jyestha'], start_date, end_date)),
        ('Moon in Ashlesha',
         lambda: get_moon_nakshatra_dates(conn, ['Ashlesha'], start_date, end_date)),
        ('Moon Gandanta',
         lambda: get_gandanta_dates(conn, start_date, end_date)),

        # All 27 nakshatras (individual analysis)
        ('Moon in Ashvini', lambda: get_moon_nakshatra_dates(conn, ['Ashvini'], start_date, end_date)),
        ('Moon in Bharani', lambda: get_moon_nakshatra_dates(conn, ['Bharani'], start_date, end_date)),
        ('Moon in Krithika', lambda: get_moon_nakshatra_dates(conn, ['Krithika'], start_date, end_date)),
        ('Moon in Rohini', lambda: get_moon_nakshatra_dates(conn, ['Rohini'], start_date, end_date)),
        ('Moon in Mrigasira', lambda: get_moon_nakshatra_dates(conn, ['Mrigasira'], start_date, end_date)),
        ('Moon in Punarvasu', lambda: get_moon_nakshatra_dates(conn, ['Punarvasu'], start_date, end_date)),
        ('Moon in Pushya', lambda: get_moon_nakshatra_dates(conn, ['Pushya'], start_date, end_date)),
        ('Moon in Magha', lambda: get_moon_nakshatra_dates(conn, ['Magha'], start_date, end_date)),
        ('Moon in Purva Phalguni', lambda: get_moon_nakshatra_dates(conn, ['Purva Phalguni'], start_date, end_date)),
        ('Moon in Uttara Phalguni', lambda: get_moon_nakshatra_dates(conn, ['Uttara Phalguni'], start_date, end_date)),
        ('Moon in Hastha', lambda: get_moon_nakshatra_dates(conn, ['Hastha'], start_date, end_date)),
        ('Moon in Chitra', lambda: get_moon_nakshatra_dates(conn, ['Chitra'], start_date, end_date)),
        ('Moon in Swathi', lambda: get_moon_nakshatra_dates(conn, ['Swathi'], start_date, end_date)),
        ('Moon in Vishakha', lambda: get_moon_nakshatra_dates(conn, ['Vishakha'], start_date, end_date)),
        ('Moon in Anuradha', lambda: get_moon_nakshatra_dates(conn, ['Anuradha'], start_date, end_date)),
        ('Moon in Purva Ashada', lambda: get_moon_nakshatra_dates(conn, ['Purva Ashada'], start_date, end_date)),
        ('Moon in Uttara Ashada', lambda: get_moon_nakshatra_dates(conn, ['Uttara Ashada'], start_date, end_date)),
        ('Moon in Shravana', lambda: get_moon_nakshatra_dates(conn, ['Shravana'], start_date, end_date)),
        ('Moon in Dhanistha', lambda: get_moon_nakshatra_dates(conn, ['Dhanistha'], start_date, end_date)),
        ('Moon in Shatabhisha', lambda: get_moon_nakshatra_dates(conn, ['Shatabhisha'], start_date, end_date)),
        ('Moon in Purva Bhadra', lambda: get_moon_nakshatra_dates(conn, ['Purva Bhadra'], start_date, end_date)),
        ('Moon in Uttara Bhadra', lambda: get_moon_nakshatra_dates(conn, ['Uttara Bhadra'], start_date, end_date)),
        ('Moon in Revathi', lambda: get_moon_nakshatra_dates(conn, ['Revathi'], start_date, end_date)),
    ]

    results = []
    for factor_name, get_dates_fn in FACTORS:
        active_dates = get_dates_fn()
        stats = analyze_factor_dates(conn, factor_name, active_dates,
                                     symbol, start_date, end_date, baseline)
        if stats:
            results.append(stats)

    return results, baseline


def save_correlations(conn, results):
    """Save correlation results to database."""
    conn.executemany(
        """INSERT OR REPLACE INTO factor_correlation_stats
           (factor_type, index_symbol, pct_down_days, avg_return, avg_range_pct,
            volatility_multiplier, sample_count, baseline_down_pct, baseline_avg_return)
           VALUES (:factor_type, :index_symbol, :pct_down_days, :avg_return,
                   :avg_range_pct, :volatility_multiplier, :sample_count,
                   :baseline_down_pct, :baseline_avg_return)""",
        results
    )
    conn.commit()


def print_results(results, baseline):
    """Pretty-print correlation results."""

    # Sort by bearish signal strength (highest % down days first)
    sorted_results = sorted(results, key=lambda r: r['pct_down_days'], reverse=True)

    print(f"\n{'Factor':<32} {'N':>5} {'Down%':>6} {'AvgRet':>8} {'VolMul':>7} {'Signal':>8}")
    print("-" * 75)

    for r in sorted_results:
        # Signal strength: how much worse than baseline
        delta_down = r['pct_down_days'] - baseline['down_pct']
        if delta_down > 3:
            signal = 'BEARISH'
        elif delta_down < -3:
            signal = 'BULLISH'
        else:
            signal = 'neutral'

        print(f"  {r['factor_type']:<30} {r['sample_count']:>5} "
              f"{r['pct_down_days']:>5.1f}% {r['avg_return']:>+7.3f}% "
              f"{r['volatility_multiplier']:>6.2f}x  {signal:>8}")

    print(f"\n  {'BASELINE':<30} {baseline['total_days']:>5} "
          f"{baseline['down_pct']:>5.1f}% {baseline['avg_return']:>+7.3f}%  1.00x")


def main():
    print("=" * 60)
    print("KĀLA-DRISHTI FACTOR CORRELATION ANALYSIS")
    print("=" * 60)

    conn = get_connection()

    results, baseline = run_all_correlations(conn, 'NIFTY', '2000-01-01', '2020-12-31')

    if results:
        save_correlations(conn, results)
        print_results(results, baseline)

        # Highlight top bearish and bullish factors
        bearish = [r for r in results if r['pct_down_days'] - baseline['down_pct'] > 3]
        bullish = [r for r in results if r['pct_down_days'] - baseline['down_pct'] < -3]

        if bearish:
            print(f"\n  BEARISH FACTORS (>{baseline['down_pct']:.0f}%+3 down days):")
            for r in sorted(bearish, key=lambda x: x['pct_down_days'], reverse=True):
                print(f"    {r['factor_type']}: {r['pct_down_days']:.1f}% down "
                      f"(+{r['pct_down_days']-baseline['down_pct']:.1f}pp vs baseline), "
                      f"N={r['sample_count']}")

        if bullish:
            print(f"\n  BULLISH FACTORS (<{baseline['down_pct']:.0f}%-3 down days):")
            for r in sorted(bullish, key=lambda x: x['pct_down_days']):
                print(f"    {r['factor_type']}: {r['pct_down_days']:.1f}% down "
                      f"({r['pct_down_days']-baseline['down_pct']:.1f}pp vs baseline), "
                      f"N={r['sample_count']}")

    conn.close()
    print("\nCorrelation analysis complete.")


if __name__ == '__main__':
    main()
