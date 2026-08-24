"""
Data-integrity sweep — the monitoring loop the platform never had.
==================================================================
Runs every check in lib/integrity_checks.py, persists findings to
km_integrity_findings (migration 178), and pushes an alert when anything
critical or new shows up.

Health checks that already exist measure PRESENCE (fill rate, row count,
exceptions). These measure CORRECTNESS — the class of bug that reads
green for months:
  reconciliation · invariant · staleness · step_failure

Usage:
    cd App/backend
    python scripts/run_integrity_checks.py                # check, persist, alert
    python scripts/run_integrity_checks.py --dry-run      # check + print only
    python scripts/run_integrity_checks.py --no-alert     # check + persist, no push
    python scripts/run_integrity_checks.py --test-alert   # verify the transport works

Wired into pipeline2 as the `integrity_checks` dimension (runs last).
The step reports 'failed' when a CRITICAL finding exists, so a silent
data bug turns the Pipeline Dashboard red instead of staying invisible.
"""

import argparse
import os
import sys
from datetime import date

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.config import DATABASE_URL
from lib import alerting
from lib.integrity_checks import run_all


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


UPSERT = """
INSERT INTO km_integrity_findings
    (run_date, check_key, check_class, severity, subject, summary, metric, expected, detail)
VALUES (%(run_date)s, %(check_key)s, %(check_class)s, %(severity)s, %(subject)s,
        %(summary)s, %(metric)s, %(expected)s, %(detail)s::jsonb)
ON CONFLICT (run_date, check_key) DO UPDATE SET
    check_class = EXCLUDED.check_class,
    severity    = EXCLUDED.severity,
    subject     = EXCLUDED.subject,
    summary     = EXCLUDED.summary,
    metric      = EXCLUDED.metric,
    expected    = EXCLUDED.expected,
    detail      = EXCLUDED.detail,
    created_at  = now()
"""


def persist(conn, run_date: date, findings) -> int:
    import json
    if not findings:
        return 0
    rows = [{
        'run_date': run_date, 'check_key': f.check_key, 'check_class': f.check_class,
        'severity': f.severity, 'subject': f.subject, 'summary': f.summary,
        'metric': f.metric, 'expected': f.expected, 'detail': json.dumps(f.detail or {}),
    } for f in findings]
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, UPSERT, rows, page_size=200)
    conn.commit()
    return len(rows)


def _seen_yesterday(conn, run_date: date, keys: list[str]) -> set[str]:
    """Keys already reported on a previous day — used so a standing,
    already-known finding does not re-alert every single night (alert
    fatigue is how a real alert gets ignored)."""
    if not keys:
        return set()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT check_key FROM km_integrity_findings
            WHERE check_key = ANY(%s) AND run_date < %s
        """, (keys, run_date))
        return {r[0] for r in cur.fetchall()}


def run(dry_run: bool = False, alert: bool = True, verbose: bool = True) -> tuple[int, int]:
    """Returns (critical_count, total_findings)."""
    conn = get_conn()
    run_date = date.today()
    if verbose:
        print('Data-integrity sweep')
        print('=' * 50)

    findings = run_all(conn, run_date)
    crit = [f for f in findings if f.severity == 'critical']
    warn = [f for f in findings if f.severity == 'warning']

    if verbose:
        if not findings:
            print('  ✓ all checks clean')
        for f in crit + warn:
            mark = '✗' if f.severity == 'critical' else '!'
            print(f'  {mark} [{f.check_class}] {f.summary}')

    if not dry_run:
        n = persist(conn, run_date, findings)
        if verbose:
            print(f'  persisted {n} finding(s) to km_integrity_findings')

        if alert and findings:
            # Push criticals always; push warnings only when newly seen.
            known = _seen_yesterday(conn, run_date, [f.check_key for f in warn])
            pushable = crit + [f for f in warn if f.check_key not in known]
            if pushable:
                subject, body = alerting.format_findings(pushable)
                sent = alerting.dispatch(subject, body,
                                         {'findings': [f.summary for f in pushable]},
                                         verbose=verbose)
                if verbose and sent:
                    print(f'  alert pushed via {", ".join(sent)}')
            elif verbose:
                print('  no new findings to push (standing warnings suppressed)')
    elif verbose:
        print('  (dry run — nothing persisted, nothing pushed)')

    conn.close()
    return len(crit), len(findings)


# ── pipeline2 entry point ────────────────────────────────────────────────

def integrity_for_pipeline(conn_unused, trade_date: date, force: bool = False) -> tuple[int, str]:
    """A CRITICAL finding fails the step on purpose — that is the whole
    point: it turns a silent data bug into a red dimension on the
    Pipeline Dashboard."""
    crit, total = run(dry_run=False, alert=True, verbose=False)
    return total, ('failed' if crit else 'completed')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Run the data-integrity sweep.')
    ap.add_argument('--dry-run', action='store_true', help='Check and print; no writes, no alerts.')
    ap.add_argument('--no-alert', action='store_true', help='Persist findings but do not push.')
    ap.add_argument('--test-alert', action='store_true', help='Send a test alert and exit.')
    args = ap.parse_args()

    if args.test_alert:
        cfg = alerting.transports_configured()
        print(f'Configured transports: {cfg or "none"}')
        sent = alerting.dispatch('[KaalaDristi] test alert',
                                 'If you are reading this, the alert channel works.')
        print(f'Sent via: {sent or "nothing"}')
        sys.exit(0 if sent or not cfg else 1)

    crit, total = run(dry_run=args.dry_run, alert=not args.no_alert)
    print(f'\n  Summary: {total} finding(s), {crit} critical')
    sys.exit(0)
