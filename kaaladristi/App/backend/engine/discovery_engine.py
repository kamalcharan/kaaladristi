"""
Kāla-Drishti Discovery Engine

The second half of the two-way rule system. While the Signal Engine evaluates
GIVEN rules, the Discovery Engine finds NEW patterns in the data.

Two modes of operation:
  1. VALIDATE: Test existing given rules against historical market data
     → Produces statistical confidence scores for each rule
  2. DISCOVER: Scan for new patterns not yet captured by given rules
     → Generates candidate rules for human review

Runs weekly (or on-demand) to:
  - Scan last N weeks of market + astro data
  - Test pattern templates against market returns
  - Compute statistical significance (sample count, % correct, p-value)
  - Match discovered patterns against existing rules (validates them)
  - Generate candidate rules for novel patterns (needs admin approval)

Pattern templates scanned:
  - Tithi-return correlation (which tithis have abnormal returns?)
  - Nakshatra-return correlation (Moon nakshatra effect)
  - Yoga-return correlation (which yogas are bullish/bearish?)
  - Vara-Tithi combinations (weekday + tithi interaction)
  - Vara-Nakshatra combinations (DLNL patterns)
  - Sign co-presence effects (which planet pairs in which signs?)
  - Sankranti effect (returns around Sun sign changes)
  - Hemisphere event effects (returns around equinox/solstice)
"""

import json
import math
from datetime import datetime, timedelta

from db import (
    get_market_returns as _db_get_market_returns,
    get_panchang_range,
    get_active_rules,
    get_supabase,
    insert_candidate_rules,
)


# =============================================================================
# STATISTICAL HELPERS
# =============================================================================

def compute_stats(returns):
    """Compute basic statistics for a list of returns."""
    if not returns:
        return None
    n = len(returns)
    mean = sum(returns) / n
    down_days = sum(1 for r in returns if r < 0)
    pct_down = down_days / n * 100
    variance = sum((r - mean) ** 2 for r in returns) / n if n > 1 else 0
    std = math.sqrt(variance)
    return {
        'n': n,
        'mean_return': round(mean, 4),
        'pct_down': round(pct_down, 1),
        'std': round(std, 4),
    }


def significance_test(sample_returns, baseline_returns, min_samples=20):
    """
    Simple z-test for difference in means.
    Returns z-score and approximate p-value indicator.

    Thresholds:
      |z| >= 2.58 → p < 0.01 (highly significant)
      |z| >= 1.96 → p < 0.05 (significant)
      |z| >= 1.64 → p < 0.10 (marginally significant)
    """
    if len(sample_returns) < min_samples:
        return None, 'insufficient_data'

    s_stats = compute_stats(sample_returns)
    b_stats = compute_stats(baseline_returns)

    if b_stats is None or b_stats['std'] == 0:
        return None, 'no_baseline'

    # Z-test for difference in means
    se = b_stats['std'] / math.sqrt(s_stats['n'])
    if se == 0:
        return None, 'zero_se'

    z = (s_stats['mean_return'] - b_stats['mean_return']) / se

    if abs(z) >= 2.58:
        significance = 'highly_significant'
    elif abs(z) >= 1.96:
        significance = 'significant'
    elif abs(z) >= 1.64:
        significance = 'marginal'
    else:
        significance = 'not_significant'

    return round(z, 3), significance


# =============================================================================
# PATTERN SCANNERS
# =============================================================================

class PatternScanner:
    """Base class for pattern scanners."""

    def __init__(self, index_symbol='NIFTY'):
        self.index_symbol = index_symbol

    def get_market_returns(self, start_date, end_date):
        """Get daily returns for the index in the date range."""
        rows = _db_get_market_returns(self.index_symbol, start_date, end_date)
        return {
            row['date']: row['daily_return']
            for row in rows
            if row['daily_return'] is not None
        }

    def scan(self, start_date, end_date):
        """Override in subclasses. Returns list of discovered patterns."""
        raise NotImplementedError


class TithiScanner(PatternScanner):
    """Scan for tithi-return correlations."""

    def scan(self, start_date, end_date):
        returns = self.get_market_returns(start_date, end_date)
        baseline_rets = list(returns.values())

        # Group returns by tithi base name
        panchang_rows = get_panchang_range(start_date, end_date, 'date, tithi_base_name, paksha')

        tithi_returns = {}
        for row in panchang_rows:
            date = row['date']
            if date in returns:
                key = f"{row['paksha']} {row['tithi_base_name']}"
                tithi_returns.setdefault(key, []).append(returns[date])

        patterns = []
        for tithi_name, rets in tithi_returns.items():
            z, sig = significance_test(rets, baseline_rets)
            if z is not None and sig in ('significant', 'highly_significant'):
                stats = compute_stats(rets)
                signal = 'Bearish' if stats['mean_return'] < 0 else 'Bullish'
                if abs(z) >= 2.58:
                    signal = f'Super {signal}'

                patterns.append({
                    'pattern': f'tithi:{tithi_name}',
                    'description': f'{tithi_name} shows {signal.lower()} tendency '
                                   f'(avg return {stats["mean_return"]:+.4f}%, '
                                   f'{stats["pct_down"]:.0f}% down days)',
                    'conditions': json.dumps({
                        'type': 'tithi',
                        'base_name': tithi_name.split(' ', 1)[1] if ' ' in tithi_name else tithi_name,
                    }),
                    'signal': signal,
                    'z_score': z,
                    'significance': sig,
                    'sample_count': stats['n'],
                    'pct_correct': stats['pct_down'] if signal.endswith('Bearish') else 100 - stats['pct_down'],
                    'avg_return': stats['mean_return'],
                })

        return patterns


class NakshatraScanner(PatternScanner):
    """Scan for Moon nakshatra-return correlations."""

    def scan(self, start_date, end_date):
        returns = self.get_market_returns(start_date, end_date)
        baseline_rets = list(returns.values())

        panchang_rows = get_panchang_range(start_date, end_date, 'date, nakshatra_name')

        nak_returns = {}
        for row in panchang_rows:
            date = row['date']
            if date in returns:
                nak_returns.setdefault(row['nakshatra_name'], []).append(returns[date])

        patterns = []
        for nak_name, rets in nak_returns.items():
            z, sig = significance_test(rets, baseline_rets)
            if z is not None and sig in ('significant', 'highly_significant'):
                stats = compute_stats(rets)
                signal = 'Bearish' if stats['mean_return'] < 0 else 'Bullish'
                if abs(z) >= 2.58:
                    signal = f'Super {signal}'

                patterns.append({
                    'pattern': f'nakshatra:{nak_name}',
                    'description': f'Moon in {nak_name} shows {signal.lower()} tendency '
                                   f'(avg return {stats["mean_return"]:+.4f}%)',
                    'conditions': json.dumps({'type': 'nakshatra', 'name': nak_name}),
                    'signal': signal,
                    'z_score': z,
                    'significance': sig,
                    'sample_count': stats['n'],
                    'pct_correct': stats['pct_down'] if signal.endswith('Bearish') else 100 - stats['pct_down'],
                    'avg_return': stats['mean_return'],
                })

        return patterns


class VaraTithiScanner(PatternScanner):
    """Scan for weekday + tithi combination patterns."""

    def scan(self, start_date, end_date):
        returns = self.get_market_returns(start_date, end_date)
        baseline_rets = list(returns.values())

        panchang_rows = get_panchang_range(start_date, end_date, 'date, vara, tithi_base_name')

        combo_returns = {}
        for row in panchang_rows:
            date = row['date']
            if date in returns:
                key = f"{row['vara']}+{row['tithi_base_name']}"
                combo_returns.setdefault(key, []).append(returns[date])

        patterns = []
        for combo, rets in combo_returns.items():
            z, sig = significance_test(rets, baseline_rets, min_samples=10)
            if z is not None and sig in ('significant', 'highly_significant'):
                stats = compute_stats(rets)
                signal = 'Bearish' if stats['mean_return'] < 0 else 'Bullish'
                if abs(z) >= 2.58:
                    signal = f'Super {signal}'

                vara, tithi = combo.split('+', 1)
                patterns.append({
                    'pattern': f'vara_tithi:{combo}',
                    'description': f'{vara} + {tithi} shows {signal.lower()} tendency '
                                   f'(avg return {stats["mean_return"]:+.4f}%, n={stats["n"]})',
                    'conditions': json.dumps({
                        'type': 'and',
                        'conditions': [
                            {'type': 'vara', 'value': vara},
                            {'type': 'tithi', 'base_name': tithi},
                        ],
                    }),
                    'signal': signal,
                    'z_score': z,
                    'significance': sig,
                    'sample_count': stats['n'],
                    'pct_correct': stats['pct_down'] if signal.endswith('Bearish') else 100 - stats['pct_down'],
                    'avg_return': stats['mean_return'],
                })

        return patterns


class DLNLScanner(PatternScanner):
    """Validate the DLNL (Day Lord = Nakshatra Lord) pattern."""

    def scan(self, start_date, end_date):
        returns = self.get_market_returns(start_date, end_date)
        baseline_rets = list(returns.values())

        dlnl_rows = get_panchang_range(start_date, end_date, 'date, dlnl_match')
        dlnl_rows = [row for row in dlnl_rows if row.get('dlnl_match')]

        dlnl_rets = [returns[row['date']] for row in dlnl_rows if row['date'] in returns]

        patterns = []
        if dlnl_rets:
            z, sig = significance_test(dlnl_rets, baseline_rets)
            stats = compute_stats(dlnl_rets)
            if stats:
                patterns.append({
                    'pattern': 'dlnl:match',
                    'description': f'DLNL match days: avg return {stats["mean_return"]:+.4f}%, '
                                   f'{stats["pct_down"]:.0f}% down days (n={stats["n"]})',
                    'conditions': json.dumps({'type': 'dlnl_match'}),
                    'signal': 'Bullish' if stats['mean_return'] > 0 else 'Bearish',
                    'z_score': z,
                    'significance': sig or 'untested',
                    'sample_count': stats['n'],
                    'pct_correct': 100 - stats['pct_down'] if stats['mean_return'] > 0 else stats['pct_down'],
                    'avg_return': stats['mean_return'],
                })

        return patterns


class SankrantiScanner(PatternScanner):
    """Scan for returns around sankranti (Sun sign change) days."""

    def scan(self, start_date, end_date):
        returns = self.get_market_returns(start_date, end_date)
        baseline_rets = list(returns.values())

        sankranti_rows = get_panchang_range(start_date, end_date, 'date, sankranti_to, is_sankranti')
        sankranti_rows = [row for row in sankranti_rows if row.get('is_sankranti')]

        # Overall sankranti effect
        sankranti_rets = [returns[row['date']] for row in sankranti_rows if row['date'] in returns]

        patterns = []
        if sankranti_rets:
            z, sig = significance_test(sankranti_rets, baseline_rets, min_samples=10)
            stats = compute_stats(sankranti_rets)
            if stats and z is not None and sig != 'not_significant':
                signal = 'Bearish' if stats['mean_return'] < 0 else 'Bullish'
                patterns.append({
                    'pattern': 'sankranti:any',
                    'description': f'Sankranti days: avg return {stats["mean_return"]:+.4f}%, '
                                   f'{stats["pct_down"]:.0f}% down (n={stats["n"]})',
                    'conditions': json.dumps({'type': 'is_sankranti'}),
                    'signal': signal,
                    'z_score': z,
                    'significance': sig,
                    'sample_count': stats['n'],
                    'pct_correct': stats['pct_down'] if signal == 'Bearish' else 100 - stats['pct_down'],
                    'avg_return': stats['mean_return'],
                })

        # Per-sign sankranti effect
        sign_rets = {}
        for row in sankranti_rows:
            date = row['date']
            if date in returns and row['sankranti_to']:
                sign_rets.setdefault(row['sankranti_to'], []).append(returns[date])

        for sign, rets in sign_rets.items():
            z, sig = significance_test(rets, baseline_rets, min_samples=5)
            if z is not None and sig in ('significant', 'highly_significant'):
                stats = compute_stats(rets)
                signal = 'Bearish' if stats['mean_return'] < 0 else 'Bullish'
                patterns.append({
                    'pattern': f'sankranti:{sign}',
                    'description': f'Sankranti to {sign}: avg return {stats["mean_return"]:+.4f}%',
                    'conditions': json.dumps({'type': 'sankranti_sign', 'sign': sign}),
                    'signal': signal,
                    'z_score': z,
                    'significance': sig,
                    'sample_count': stats['n'],
                    'pct_correct': stats['pct_down'] if signal == 'Bearish' else 100 - stats['pct_down'],
                    'avg_return': stats['mean_return'],
                })

        return patterns


class YogaScanner(PatternScanner):
    """Scan for yoga-return correlations."""

    def scan(self, start_date, end_date):
        returns = self.get_market_returns(start_date, end_date)
        baseline_rets = list(returns.values())

        panchang_rows = get_panchang_range(start_date, end_date, 'date, yoga_name')

        yoga_returns = {}
        for row in panchang_rows:
            date = row['date']
            if date in returns:
                yoga_returns.setdefault(row['yoga_name'], []).append(returns[date])

        patterns = []
        for yoga_name, rets in yoga_returns.items():
            z, sig = significance_test(rets, baseline_rets)
            if z is not None and sig in ('significant', 'highly_significant'):
                stats = compute_stats(rets)
                signal = 'Bearish' if stats['mean_return'] < 0 else 'Bullish'
                if abs(z) >= 2.58:
                    signal = f'Super {signal}'

                patterns.append({
                    'pattern': f'yoga:{yoga_name}',
                    'description': f'Yoga {yoga_name} shows {signal.lower()} tendency '
                                   f'(avg return {stats["mean_return"]:+.4f}%)',
                    'conditions': json.dumps({'type': 'yoga', 'name': yoga_name}),
                    'signal': signal,
                    'z_score': z,
                    'significance': sig,
                    'sample_count': stats['n'],
                    'pct_correct': stats['pct_down'] if signal.endswith('Bearish') else 100 - stats['pct_down'],
                    'avg_return': stats['mean_return'],
                })

        return patterns


# =============================================================================
# DISCOVERY ENGINE
# =============================================================================

class DiscoveryEngine:
    """
    Orchestrates pattern scanning and candidate rule generation.

    Two modes:
      - validate(): Test existing rules against market data
      - discover(): Find new patterns
    """

    def __init__(self, index_symbol='NIFTY'):
        self.index_symbol = index_symbol
        self.scanners = [
            TithiScanner(index_symbol),
            NakshatraScanner(index_symbol),
            VaraTithiScanner(index_symbol),
            DLNLScanner(index_symbol),
            SankrantiScanner(index_symbol),
            YogaScanner(index_symbol),
        ]

    def discover(self, start_date, end_date):
        """
        Run all scanners and collect discovered patterns.
        Compares against existing rules to separate validations from new discoveries.
        """
        print(f"Running discovery scan: {start_date} to {end_date}")
        print(f"  Index: {self.index_symbol}")
        print(f"  Scanners: {len(self.scanners)}")

        all_patterns = []
        for scanner in self.scanners:
            scanner_name = type(scanner).__name__
            try:
                patterns = scanner.scan(start_date, end_date)
                all_patterns.extend(patterns)
                print(f"  {scanner_name}: {len(patterns)} significant patterns found")
            except Exception as e:
                print(f"  {scanner_name}: ERROR - {e}")

        # Load existing rules to check for matches
        existing_rules = get_active_rules()
        existing_conditions = set()
        for rule in existing_rules:
            existing_conditions.add(rule['conditions'])

        # Classify: validation vs new discovery
        validations = []
        new_discoveries = []
        for pattern in all_patterns:
            if pattern['conditions'] in existing_conditions:
                validations.append(pattern)
            else:
                new_discoveries.append(pattern)

        print(f"\n  Total significant patterns: {len(all_patterns)}")
        print(f"  Validates existing rules: {len(validations)}")
        print(f"  New discoveries: {len(new_discoveries)}")

        return {
            'validations': validations,
            'new_discoveries': new_discoveries,
            'all_patterns': all_patterns,
        }

    def save_candidates(self, discoveries, discovered_date=None):
        """Save new discoveries as candidate rules for human review."""
        if discovered_date is None:
            discovered_date = datetime.now().strftime('%Y-%m-%d')

        candidates = []
        for pattern in discoveries:
            candidates.append({
                'pattern_description': pattern['description'],
                'conditions': pattern['conditions'],
                'signal': pattern['signal'],
                'statistical_confidence': pattern.get('z_score'),
                'sample_count': pattern.get('sample_count'),
                'pct_correct': pattern.get('pct_correct'),
                'avg_return': pattern.get('avg_return'),
                'discovered_date': discovered_date,
            })

        if candidates:
            insert_candidate_rules(candidates)

        print(f"  Saved {len(candidates)} candidate rules for review.")
        return len(candidates)

    def validate_rules(self, start_date, end_date):
        """
        Validate all existing given rules against market data.
        Returns validation report for each rule.
        """
        from signal_engine import build_day_context, evaluate_condition

        active_rules = get_active_rules()
        rules = []
        for rule in active_rules:
            try:
                conditions = json.loads(rule['conditions'])
            except (json.JSONDecodeError, TypeError):
                print(f"  WARNING: Invalid conditions JSON for rule {rule['code']}, skipping")
                continue
            rules.append({
                'code': rule['code'],
                'conditions': conditions,
                'signal': rule['signal'],
            })

        returns = self.scanners[0].get_market_returns(start_date, end_date)
        baseline_rets = list(returns.values())
        baseline_stats = compute_stats(baseline_rets)

        print(f"\nValidating {len(rules)} rules against {len(returns)} trading days...")
        print(f"  Baseline: avg return {baseline_stats['mean_return']:+.4f}%, "
              f"{baseline_stats['pct_down']:.0f}% down days")

        report = []
        panchang_dates = get_panchang_range(start_date, end_date, 'date')

        for rule in rules:
            # Find all dates where this rule fires
            fired_dates = []

            for row in panchang_dates:
                date_str = row['date']
                if date_str not in returns:
                    continue
                context = build_day_context(date_str)
                try:
                    if evaluate_condition(rule['conditions'], context):
                        fired_dates.append(date_str)
                except Exception:
                    continue

            fired_returns = [returns[d] for d in fired_dates]
            stats = compute_stats(fired_returns)

            z_score = None
            sig = 'insufficient_data'
            if stats and stats['n'] >= 5:
                z_score, sig = significance_test(fired_returns, baseline_rets, min_samples=5)

            report.append({
                'rule_code': rule['code'],
                'rule_signal': rule['signal'],
                'fired_count': len(fired_dates),
                'stats': stats,
                'z_score': z_score,
                'significance': sig,
                'validates': sig in ('significant', 'highly_significant'),
            })

        return report


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("=" * 60)
    print("KĀLA-DRISHTI DISCOVERY ENGINE")
    print("=" * 60)

    engine = DiscoveryEngine('NIFTY')

    # Run discovery on available data range
    # Check what data we have
    market_rows = _db_get_market_returns('NIFTY', '1990-01-01', '2030-12-31')
    market_rows_with_return = [r for r in market_rows if r['daily_return'] is not None]

    if not market_rows_with_return:
        print("\n  No market data available. Load market data first.")
        return

    dates = [r['date'] for r in market_rows_with_return]
    start = min(dates)
    end = max(dates)
    print(f"\n  Market data available: {start} to {end}")

    # Check if panchang data exists
    sb = get_supabase()
    panchang_resp = sb.table('km_daily_panchang').select('date', count='exact').execute()
    panchang_count = panchang_resp.count if panchang_resp.count is not None else len(panchang_resp.data)
    if panchang_count == 0:
        print("  No panchang data. Run generate_panchang.py + seed_panchang.py first.")
        return

    print(f"  Panchang records: {panchang_count}")

    # Run discovery
    results = engine.discover(start, end)

    # Print detailed results
    print("\n" + "=" * 60)
    print("DISCOVERY RESULTS")
    print("=" * 60)

    if results['validations']:
        print("\n--- Validates Existing Rules ---")
        for p in sorted(results['validations'], key=lambda x: abs(x.get('z_score', 0)), reverse=True):
            print(f"  [{p['pattern']:30s}] z={p['z_score']:+.3f} ({p['significance']})")
            print(f"    {p['description']}")

    if results['new_discoveries']:
        print("\n--- New Discoveries (Candidate Rules) ---")
        for p in sorted(results['new_discoveries'], key=lambda x: abs(x.get('z_score', 0)), reverse=True):
            print(f"  [{p['pattern']:30s}] {p['signal']:15s} z={p['z_score']:+.3f} ({p['significance']})")
            print(f"    {p['description']}")

        # Save candidates
        engine.save_candidates(results['new_discoveries'])

    if not results['all_patterns']:
        print("\n  No statistically significant patterns found in this date range.")

    print("\nDiscovery engine complete.")


if __name__ == '__main__':
    main()
