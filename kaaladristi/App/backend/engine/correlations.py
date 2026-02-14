"""
Kala-Drishti Factor Correlation Analysis

For each planetary factor, empirically measure its historical impact on NIFTY:
  - % down days when factor is active vs baseline
  - Average return when active vs baseline
  - Average daily range (volatility) when active vs baseline
  - Sample count and statistical significance

This is the intelligence layer -- it proves (or disproves) each factor's market impact.

Data source: Supabase (km_ tables)
"""

from db import (
    get_market_returns, get_retrograde_dates, get_aspect_dates,
    get_moon_nakshatra_dates, get_gandanta_dates, get_nakshatra_change_dates,
    upsert_correlation_stats,
)


def get_baseline_stats(market_data):
    """Compute baseline market stats from pre-fetched market data."""
    rows = [r for r in market_data if r['daily_return'] is not None]
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


def analyze_factor_dates(factor_name, active_dates, market_data_by_date, symbol, baseline):
    """
    Given a set of dates when a factor is active, compute correlation stats.
    """
    if not active_dates:
        return None

    # Get market data for active dates
    rows = [market_data_by_date[d] for d in active_dates
            if d in market_data_by_date and market_data_by_date[d]['daily_return'] is not None]

    if len(rows) < 5:
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
# MAIN ANALYSIS
# =========================================================================

def run_all_correlations(symbol='NIFTY', start_date='2000-01-01', end_date='2020-12-31'):
    """Run correlation analysis for all defined factors."""

    # Fetch all market data once
    market_data = get_market_returns(symbol, start_date, end_date)
    market_data_by_date = {r['date']: r for r in market_data}

    baseline = get_baseline_stats(market_data)
    if not baseline:
        print("No baseline data found!")
        print(f"  get_market_returns('{symbol}', '{start_date}', '{end_date}') returned {len(market_data)} rows")
        if not market_data:
            print("  Possible causes:")
            print("    1. km_index_eod has no data for this date range")
            print("    2. yfinance_historical.py hasn't been run yet")
            print("    3. Index symbol not found in km_index_symbols")
        return [], {}

    print(f"Baseline ({symbol}, {start_date} to {end_date}):")
    print(f"  {baseline['total_days']} trading days")
    print(f"  {baseline['down_pct']:.1f}% down days")
    print(f"  Avg return: {baseline['avg_return']:+.4f}%")
    print(f"  Avg daily range: {baseline['avg_range']:.4f}%")
    print()

    # Define all factors to analyze
    FACTORS = [
        # Retrogrades
        ('Mercury Retrograde', lambda: get_retrograde_dates('Mercury', start_date, end_date)),
        ('Mars Retrograde', lambda: get_retrograde_dates('Mars', start_date, end_date)),
        ('Saturn Retrograde', lambda: get_retrograde_dates('Saturn', start_date, end_date)),
        ('Jupiter Retrograde', lambda: get_retrograde_dates('Jupiter', start_date, end_date)),
        ('Venus Retrograde', lambda: get_retrograde_dates('Venus', start_date, end_date)),

        # Key aspect pairs (hard aspects)
        ('Mars-Saturn Hard Aspect',
         lambda: get_aspect_dates('Mars', 'Saturn',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),
        ('Mars-Rahu Hard Aspect',
         lambda: get_aspect_dates('Mars', 'Rahu',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),
        ('Mercury-Rahu Hard Aspect',
         lambda: get_aspect_dates('Mercury', 'Rahu',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),
        ('Saturn-Rahu Hard Aspect',
         lambda: get_aspect_dates('Saturn', 'Rahu',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),
        ('Jupiter-Saturn Hard Aspect',
         lambda: get_aspect_dates('Jupiter', 'Saturn',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),
        ('Sun-Saturn Hard Aspect',
         lambda: get_aspect_dates('Sun', 'Saturn',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),
        ('Sun-Mercury Hard Aspect',
         lambda: get_aspect_dates('Sun', 'Mercury',
                                  ['conjunction', 'opposition', 'square'], start_date, end_date)),

        # Moon factors
        ('Moon in Ardra/Arudra',
         lambda: get_moon_nakshatra_dates(['Ardra', 'Arudra'], start_date, end_date)),
        ('Moon in Moola',
         lambda: get_moon_nakshatra_dates(['Moola'], start_date, end_date)),
        ('Moon in Jyeshtha/Jyestha',
         lambda: get_moon_nakshatra_dates(['Jyeshtha', 'Jyestha'], start_date, end_date)),
        ('Moon in Ashlesha',
         lambda: get_moon_nakshatra_dates(['Ashlesha'], start_date, end_date)),
        ('Moon Gandanta',
         lambda: get_gandanta_dates(start_date, end_date)),

        # All 27 nakshatras (individual analysis)
        ('Moon in Ashvini', lambda: get_moon_nakshatra_dates(['Ashvini'], start_date, end_date)),
        ('Moon in Bharani', lambda: get_moon_nakshatra_dates(['Bharani'], start_date, end_date)),
        ('Moon in Krithika', lambda: get_moon_nakshatra_dates(['Krithika'], start_date, end_date)),
        ('Moon in Rohini', lambda: get_moon_nakshatra_dates(['Rohini'], start_date, end_date)),
        ('Moon in Mrigasira', lambda: get_moon_nakshatra_dates(['Mrigasira'], start_date, end_date)),
        ('Moon in Punarvasu', lambda: get_moon_nakshatra_dates(['Punarvasu'], start_date, end_date)),
        ('Moon in Pushya', lambda: get_moon_nakshatra_dates(['Pushya'], start_date, end_date)),
        ('Moon in Magha', lambda: get_moon_nakshatra_dates(['Magha'], start_date, end_date)),
        ('Moon in Purva Phalguni', lambda: get_moon_nakshatra_dates(['Purva Phalguni'], start_date, end_date)),
        ('Moon in Uttara Phalguni', lambda: get_moon_nakshatra_dates(['Uttara Phalguni'], start_date, end_date)),
        ('Moon in Hastha', lambda: get_moon_nakshatra_dates(['Hastha'], start_date, end_date)),
        ('Moon in Chitra', lambda: get_moon_nakshatra_dates(['Chitra'], start_date, end_date)),
        ('Moon in Swathi', lambda: get_moon_nakshatra_dates(['Swathi'], start_date, end_date)),
        ('Moon in Vishakha', lambda: get_moon_nakshatra_dates(['Vishakha'], start_date, end_date)),
        ('Moon in Anuradha', lambda: get_moon_nakshatra_dates(['Anuradha'], start_date, end_date)),
        ('Moon in Purva Ashada', lambda: get_moon_nakshatra_dates(['Purva Ashada'], start_date, end_date)),
        ('Moon in Uttara Ashada', lambda: get_moon_nakshatra_dates(['Uttara Ashada'], start_date, end_date)),
        ('Moon in Shravana', lambda: get_moon_nakshatra_dates(['Shravana'], start_date, end_date)),
        ('Moon in Dhanistha', lambda: get_moon_nakshatra_dates(['Dhanistha'], start_date, end_date)),
        ('Moon in Shatabhisha', lambda: get_moon_nakshatra_dates(['Shatabhisha'], start_date, end_date)),
        ('Moon in Purva Bhadra', lambda: get_moon_nakshatra_dates(['Purva Bhadra'], start_date, end_date)),
        ('Moon in Uttara Bhadra', lambda: get_moon_nakshatra_dates(['Uttara Bhadra'], start_date, end_date)),
        ('Moon in Revathi', lambda: get_moon_nakshatra_dates(['Revathi'], start_date, end_date)),
    ]

    results = []
    for factor_name, get_dates_fn in FACTORS:
        active_dates = get_dates_fn()
        stats = analyze_factor_dates(factor_name, active_dates,
                                     market_data_by_date, symbol, baseline)
        if stats:
            results.append(stats)

    return results, baseline


def save_correlations(results):
    """Save correlation results to Supabase."""
    upsert_correlation_stats(results)


def print_results(results, baseline):
    """Pretty-print correlation results."""
    sorted_results = sorted(results, key=lambda r: r['pct_down_days'], reverse=True)

    print(f"\n{'Factor':<32} {'N':>5} {'Down%':>6} {'AvgRet':>8} {'VolMul':>7} {'Signal':>8}")
    print("-" * 75)

    for r in sorted_results:
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
    print("KALA-DRISHTI FACTOR CORRELATION ANALYSIS")
    print("=" * 60)

    results, baseline = run_all_correlations('NIFTY', '2000-01-01', '2020-12-31')

    if not results:
        print("\nNo factor results computed. Check the diagnostic messages above.")
        return

    if results:
        save_correlations(results)
        print_results(results, baseline)

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

    print("\nCorrelation analysis complete.")


if __name__ == '__main__':
    main()
