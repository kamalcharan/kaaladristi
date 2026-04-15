"""
Pipeline Step Definitions + Coverage Rules
============================================
Defines every pipeline step with its expected coverage thresholds.
Used by StepTracker to compute coverage_pct and classify status.

Coverage classification:
  healthy  → coverage_pct >= healthy_threshold
  warning  → coverage_pct >= warning_threshold
  partial  → coverage_pct >= failure_threshold
  failed   → coverage_pct < failure_threshold OR rows_count = 0

is_sparse=True means low coverage is expected (e.g. accum_distrib
only fires for 1-5% of stocks). Don't flag as warning/failure.
"""

PIPELINE_STEPS = [
    {
        'name': 'index_download',
        'order': 1,
        'label': 'Index Download',
        'per_exchange': False,
        'expected_rule': 'active_indices',
        'healthy_threshold': 90,
        'warning_threshold': 70,
        'failure_threshold': 0,
    },
    {
        'name': 'tri_download',
        'order': 2,
        'label': 'TRI Download',
        'per_exchange': False,
        'expected_rule': 'tri_indices',
        'healthy_threshold': 80,
        'warning_threshold': 50,
        'failure_threshold': 0,
    },
    {
        'name': 'fii_dii',
        'order': 3,
        'label': 'FII/DII Activity',
        'per_exchange': False,
        'expected_rule': 'fixed_4',
        'healthy_threshold': 100,
        'warning_threshold': 50,
        'failure_threshold': 0,
    },
    {
        'name': 'index_indicators',
        'order': 4,
        'label': 'Index Indicators',
        'per_exchange': False,
        'expected_rule': 'active_indices',
        'healthy_threshold': 95,
        'warning_threshold': 80,
        'failure_threshold': 50,
    },
    {
        'name': 'download',
        'order': 5,
        'label': 'Equity Download',
        'per_exchange': True,
        'expected_rule': 'all_active_symbols',
        'healthy_threshold': 95,
        'warning_threshold': 80,
        'failure_threshold': 0,
    },
    {
        'name': 'parse',
        'order': 6,
        'label': 'Parse Bhav Copy',
        'per_exchange': True,
        'expected_rule': 'all_active_symbols',
        'healthy_threshold': 95,
        'warning_threshold': 80,
        'failure_threshold': 0,
    },
    {
        'name': 'insert',
        'order': 7,
        'label': 'Insert EOD',
        'per_exchange': True,
        'expected_rule': 'all_active_symbols',
        'healthy_threshold': 95,
        'warning_threshold': 80,
        'failure_threshold': 0,
    },
    {
        'name': 'delivery',
        'order': 8,
        'label': 'Delivery Data',
        'per_exchange': True,
        'expected_rule': 'all_ingested_rows',
        'healthy_threshold': 80,
        'warning_threshold': 50,
        'failure_threshold': 0,
    },
    {
        'name': 'indicators',
        'order': 9,
        'label': 'Indicators (RSI/MFI/SMA)',
        'per_exchange': True,
        'expected_rule': 'all_ingested_rows',
        'healthy_threshold': 95,
        'warning_threshold': 80,
        'failure_threshold': 50,
    },
    {
        'name': 'magic_rs',
        'order': 10,
        'label': 'Magic RS',
        'per_exchange': True,
        'expected_rule': 'all_with_history',
        'healthy_threshold': 90,
        'warning_threshold': 75,
        'failure_threshold': 50,
    },
    {
        'name': 'flow_intelligence',
        'order': 11,
        'label': 'Flow Intelligence',
        'per_exchange': True,
        'expected_rule': 'all_with_history',
        'healthy_threshold': 90,
        'warning_threshold': 70,
        'failure_threshold': 40,
        'sub_steps': [
            {'name': 'flow_type', 'label': 'flow_type', 'healthy_threshold': 90, 'is_sparse': False},
            {'name': 'accum_distrib', 'label': 'accum_distrib', 'healthy_threshold': 0, 'is_sparse': True,
             'sparse_note': 'Wyckoff accumulation/distribution is naturally sparse (1-5% of stocks)'},
            {'name': 'volume_divergence_flag', 'label': 'volume_divergence', 'healthy_threshold': 30, 'is_sparse': False},
        ],
    },
    {
        'name': 'industry_composites',
        'order': 12,
        'label': 'Industry Composites',
        'per_exchange': False,
        'expected_rule': 'industries_with_5plus',
        'healthy_threshold': 80,
        'warning_threshold': 50,
        'failure_threshold': 20,
    },
    {
        'name': 'views',
        'order': 13,
        'label': 'Refresh Views',
        'per_exchange': False,
        'expected_rule': None,
        'healthy_threshold': 100,
        'warning_threshold': 0,
        'failure_threshold': 0,
    },
]

# Lookup by name
STEP_BY_NAME = {s['name']: s for s in PIPELINE_STEPS}


def get_step_order(step_name: str) -> int:
    """Return step_order for a given step name."""
    s = STEP_BY_NAME.get(step_name)
    return s['order'] if s else 99


def classify_coverage(step_name: str, coverage_pct: float) -> str:
    """Classify a coverage percentage into healthy/warning/partial/failed."""
    s = STEP_BY_NAME.get(step_name)
    if not s:
        return 'unknown'
    if coverage_pct >= s['healthy_threshold']:
        return 'healthy'
    if coverage_pct >= s['warning_threshold']:
        return 'warning'
    if coverage_pct >= s['failure_threshold']:
        return 'partial'
    return 'failed'
