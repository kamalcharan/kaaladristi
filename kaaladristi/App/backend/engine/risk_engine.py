"""
Kāla-Drishti Risk Score Engine

Computes daily risk scores for each index using the 4-dimension model:
  1. Structural Risk (0-25): Saturn/Jupiter retrogrades, Saturn-Rahu/Jupiter-Saturn aspects
  2. Momentum Risk (0-25): Mars retrograde, Mars-Saturn/Mars-Rahu aspects
  3. Volatility Risk (0-25): Moon in high-risk nakshatras, gandanta, malefic clustering
  4. Deception Risk (0-25): Mercury retrograde, Mercury-Rahu aspects, Venus retrograde

Composite score = sum of 4 dimensions (0-100).
Regime classification based on composite score.
"""

from db import (
    get_positions_for_date,
    get_aspects_for_date,
    get_moon_intraday_for_date,
    get_trading_dates,
    get_return_for_date,
    get_market_returns,
    upsert_risk_scores,
)

# =========================================================================
# FACTOR DEFINITIONS (from PRD)
# Weights are initial hypotheses -- to be calibrated by correlations.py
# =========================================================================

# High-risk nakshatras for Moon (known for volatility)
HIGH_RISK_NAKSHATRAS = {'Ardra', 'Arudra', 'Moola', 'Jyeshtha', 'Jyestha', 'Ashlesha'}

# Malefic planets (their aspects cluster = higher risk)
MALEFICS = {'Mars', 'Saturn', 'Rahu', 'Ketu'}


def get_day_factors(date):
    """
    Gather all planetary factors active on a given date.
    Returns a dict with raw factor data for scoring.
    """
    factors = {
        'retrogrades': {},       # planet -> True/False
        'aspects': [],           # list of (p1, p2, type, orb)
        'moon_nakshatra': None,
        'moon_gandanta': False,
        'moon_sign': None,
    }

    # 1. Planetary positions (retrogrades, combustion)
    positions = get_positions_for_date(date)

    for row in positions:
        factors['retrogrades'][row['planet']] = bool(row['retrograde'])
        if row['planet'] == 'Moon':
            factors['moon_nakshatra'] = row['nakshatra_name']
            factors['moon_sign'] = row['sign_name']

    # 2. Aspects active on this date
    aspects = get_aspects_for_date(date)

    for row in aspects:
        factors['aspects'].append({
            'p1': row['planet_1'], 'p2': row['planet_2'],
            'type': row['aspect_type'], 'orb': row['orb'],
            'exact': bool(row['exact'])
        })

    # 3. Moon gandanta (check intraday table, market open time)
    moon_row = get_moon_intraday_for_date(date, time_ist='09:15')

    if moon_row:
        factors['moon_gandanta'] = bool(moon_row['gandanta'])
        # Prefer intraday nakshatra (more precise for market hours)
        if moon_row['nakshatra_name']:
            factors['moon_nakshatra'] = moon_row['nakshatra_name']

    return factors


def find_aspect(aspects, p1, p2, aspect_types=None):
    """Find an aspect between two planets. Returns the aspect dict or None."""
    for a in aspects:
        pair = {a['p1'], a['p2']}
        if pair == {p1, p2}:
            if aspect_types is None or a['type'] in aspect_types:
                return a
    return None


def aspect_score(aspect, max_points):
    """Score an aspect based on orb (tighter orb = higher score)."""
    if aspect is None:
        return 0
    orb = abs(aspect['orb'])
    if aspect['exact']:
        return max_points
    # Linear decay: full points at orb=0, zero at orb=10
    return round(max(0, max_points * (1 - orb / 10.0)), 1)


# =========================================================================
# SCORING FUNCTIONS (per dimension)
# =========================================================================

def score_structural(factors):
    """
    Structural Risk (0-25): Long-cycle stability, trend validity.
    - Saturn retrograde: up to 8 pts
    - Jupiter retrograde: up to 5 pts
    - Saturn-Rahu aspect: up to 7 pts
    - Jupiter-Saturn aspect: up to 5 pts
    """
    score = 0
    details = []

    if factors['retrogrades'].get('Saturn'):
        score += 8
        details.append(('Saturn Retrograde', 8))

    if factors['retrogrades'].get('Jupiter'):
        score += 5
        details.append(('Jupiter Retrograde', 5))

    sat_rahu = find_aspect(factors['aspects'], 'Saturn', 'Rahu',
                           {'conjunction', 'opposition', 'square'})
    pts = aspect_score(sat_rahu, 7)
    if pts > 0:
        score += pts
        details.append((f"Saturn-Rahu {sat_rahu['type']}", pts))

    jup_sat = find_aspect(factors['aspects'], 'Jupiter', 'Saturn',
                          {'conjunction', 'opposition', 'square'})
    pts = aspect_score(jup_sat, 5)
    if pts > 0:
        score += pts
        details.append((f"Jupiter-Saturn {jup_sat['type']}", pts))

    return min(score, 25), details


def score_momentum(factors):
    """
    Momentum Risk (0-25): Intraday aggression, leverage risk.
    - Mars retrograde: up to 10 pts
    - Mars-Saturn aspect: up to 10 pts
    - Mars-Rahu aspect: up to 8 pts
    """
    score = 0
    details = []

    if factors['retrogrades'].get('Mars'):
        score += 10
        details.append(('Mars Retrograde', 10))

    mars_sat = find_aspect(factors['aspects'], 'Mars', 'Saturn',
                           {'conjunction', 'opposition', 'square'})
    pts = aspect_score(mars_sat, 10)
    if pts > 0:
        score += pts
        details.append((f"Mars-Saturn {mars_sat['type']}", pts))

    mars_rahu = find_aspect(factors['aspects'], 'Mars', 'Rahu',
                            {'conjunction', 'opposition', 'square'})
    pts = aspect_score(mars_rahu, 8)
    if pts > 0:
        score += pts
        details.append((f"Mars-Rahu {mars_rahu['type']}", pts))

    return min(score, 25), details


def score_volatility(factors):
    """
    Volatility Risk (0-25): Range expansion, option risk.
    - Moon in high-risk nakshatra: up to 10 pts
    - Moon gandanta: up to 8 pts
    - Multiple malefic aspects on same day: up to 7 pts
    """
    score = 0
    details = []

    if factors['moon_nakshatra'] in HIGH_RISK_NAKSHATRAS:
        score += 10
        details.append((f"Moon in {factors['moon_nakshatra']}", 10))

    if factors['moon_gandanta']:
        score += 8
        details.append(('Moon Gandanta', 8))

    # Count malefic-malefic aspects (Mars, Saturn, Rahu, Ketu involved on both sides)
    malefic_aspects = 0
    for a in factors['aspects']:
        if a['p1'] in MALEFICS and a['p2'] in MALEFICS:
            if a['type'] in {'conjunction', 'opposition', 'square'}:
                malefic_aspects += 1
    if malefic_aspects >= 3:
        score += 7
        details.append((f'{malefic_aspects} malefic aspects clustering', 7))
    elif malefic_aspects >= 2:
        score += 4
        details.append((f'{malefic_aspects} malefic aspects', 4))

    return min(score, 25), details


def score_deception(factors):
    """
    Deception Risk (0-25): False breakouts, trap probability.
    - Mercury retrograde: up to 12 pts
    - Mercury-Rahu aspect: up to 10 pts
    - Venus retrograde: up to 3 pts
    """
    score = 0
    details = []

    if factors['retrogrades'].get('Mercury'):
        score += 12
        details.append(('Mercury Retrograde', 12))

    merc_rahu = find_aspect(factors['aspects'], 'Mercury', 'Rahu',
                            {'conjunction', 'opposition', 'square'})
    pts = aspect_score(merc_rahu, 10)
    if pts > 0:
        score += pts
        details.append((f"Mercury-Rahu {merc_rahu['type']}", pts))

    if factors['retrogrades'].get('Venus'):
        score += 3
        details.append(('Venus Retrograde', 3))

    return min(score, 25), details


def classify_regime(composite):
    """Classify market regime from composite score."""
    if composite <= 30:
        return 'Accumulation'
    elif composite <= 50:
        return 'Expansion'
    elif composite <= 70:
        return 'Distribution'
    else:
        return 'Capital Protection'


def compute_risk_score(date, symbol='NIFTY'):
    """
    Compute full risk score for a given date and symbol.
    Returns (score_dict, all_factor_details).
    """
    factors = get_day_factors(date)

    structural, struct_details = score_structural(factors)
    momentum, mom_details = score_momentum(factors)
    volatility, vol_details = score_volatility(factors)
    deception, dec_details = score_deception(factors)

    composite = structural + momentum + volatility + deception
    regime = classify_regime(composite)

    # Build explanation
    active_factors = struct_details + mom_details + vol_details + dec_details
    if active_factors:
        top_factors = sorted(active_factors, key=lambda x: x[1], reverse=True)[:3]
        explanation = f"Risk {composite}/100 ({regime}). "
        explanation += "Key factors: " + ", ".join(
            f"{f[0]} (+{f[1]})" for f in top_factors
        )
    else:
        explanation = f"Risk {composite}/100 ({regime}). No significant risk factors active."

    score = {
        'date': date,
        'symbol': symbol,
        'composite_score': composite,
        'structural': structural,
        'momentum': momentum,
        'volatility': volatility,
        'deception': deception,
        'regime': regime,
        'explanation': explanation,
    }

    return score, active_factors


# =========================================================================
# BATCH COMPUTATION
# =========================================================================

def compute_all_scores(symbol='NIFTY', start_date='2000-01-01', end_date='2020-12-31'):
    """
    Compute risk scores for all trading days in the given range.
    Only computes for dates that have market data.
    """
    # Get all trading dates for this symbol
    dates = get_trading_dates(symbol, start_date, end_date)

    print(f"Computing risk scores for {len(dates)} trading days ({symbol})...")

    scores = []
    for i, date in enumerate(dates):
        score, _ = compute_risk_score(date, symbol)
        scores.append(score)

        if (i + 1) % 500 == 0:
            print(f"  {i+1}/{len(dates)} dates processed...")

    # Batch upsert to Supabase
    upsert_risk_scores(scores)
    print(f"  {len(scores)} risk scores saved.")
    return scores


# =========================================================================
# MAIN
# =========================================================================

def main():
    print("=" * 60)
    print("KĀLA-DRISHTI RISK ENGINE")
    print("=" * 60)

    # Compute for NIFTY (2000-2020 overlap period)
    scores = compute_all_scores('NIFTY', '2000-01-01', '2020-12-31')

    # Verification
    print("\n" + "=" * 60)
    print("VERIFICATION")
    print("=" * 60)

    total = len(scores)
    composites = [s['composite_score'] for s in scores]
    avg = sum(composites) / total
    print(f"\n  Total scores computed: {total}")
    print(f"  Average composite: {avg:.1f}")
    print(f"  Min: {min(composites)}, Max: {max(composites)}")

    # Regime distribution
    print("\n  Regime distribution:")
    from collections import Counter
    regimes = Counter(s['regime'] for s in scores)
    for regime in ['Accumulation', 'Expansion', 'Distribution', 'Capital Protection']:
        count = regimes.get(regime, 0)
        pct = count / total * 100
        print(f"    {regime:25s} {count:>5} days ({pct:.1f}%)")

    # Score distribution
    print("\n  Score distribution:")
    buckets = [(0, 10), (11, 20), (21, 30), (31, 40), (41, 50),
               (51, 60), (61, 70), (71, 80), (81, 90), (91, 100)]
    for lo, hi in buckets:
        count = len([c for c in composites if lo <= c <= hi])
        bar = '#' * (count // 20)
        print(f"    {lo:>3}-{hi:>3}: {count:>5} {bar}")

    # Sample high-risk days
    print("\n  Top 10 highest-risk days:")
    high_risk = sorted(scores, key=lambda s: s['composite_score'], reverse=True)[:10]
    for s in high_risk:
        # Get actual market return for that day
        ret = get_return_for_date(s['symbol'], s['date'])
        ret_str = f"{ret:+.2f}%" if ret is not None else "N/A"
        print(f"    {s['date']}  Score: {s['composite_score']:>3}  "
              f"Regime: {s['regime']:20s}  NIFTY: {ret_str}")

    # Quick correlation check: high risk vs actual returns
    print("\n  Quick correlation check:")
    all_market = get_market_returns('NIFTY', '2000-01-01', '2020-12-31')
    returns_by_date = {r['date']: r['daily_return'] for r in all_market
                       if r['daily_return'] is not None}

    for threshold in [50, 60, 70]:
        high_dates = [s['date'] for s in scores if s['composite_score'] >= threshold]
        if not high_dates:
            continue
        rets = [returns_by_date[d] for d in high_dates if d in returns_by_date]
        if rets:
            down_days = len([r for r in rets if r < 0])
            avg_ret = sum(rets) / len(rets)
            print(f"    Score >= {threshold}: {len(rets)} days, "
                  f"{down_days/len(rets)*100:.1f}% down, avg return {avg_ret:+.3f}%")

    # Baseline for comparison
    if returns_by_date:
        all_rets = list(returns_by_date.values())
        baseline_down = len([r for r in all_rets if r < 0]) / len(all_rets) * 100
        baseline_avg = sum(all_rets) / len(all_rets)
        print(f"    Baseline:    {len(all_rets)} days, "
              f"{baseline_down:.1f}% down, avg return {baseline_avg:+.3f}%")

    print("\nRisk engine complete.")


if __name__ == '__main__':
    main()
