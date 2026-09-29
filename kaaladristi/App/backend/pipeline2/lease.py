"""
Single-executor leases for the pipeline2 worker and scheduler.

Why this exists (2026-09-27): the deadlocks that turned `integrity_checks`
red most nights came from TWO pipeline2 instances running against one
database — the VPS container and a dev machine whose `uvicorn pipeline2_api`
had, as every instance does, spawned its own worker and scheduler. The job
table's `FOR UPDATE SKIP LOCKED` stops two workers claiming the same ROW; it
says nothing about two forced fixes updating the same `km_equity_eod` rows in
opposite orders. `handlers._step_lock` serialises one dimension across
processes but not two different dimensions on one table.

A session-level advisory lock, taken once at startup and held for the life of
the process, makes a second worker or scheduler REFUSE to start instead of
silently splitting the queue. Held on the executor's own long-lived
connection, so it is released the moment that connection ends — a crashed
worker never leaves a stale lease behind.

Keys live in their own namespace (`classid`), distinct from
`handlers._STEP_LOCK_NAMESPACE` (4726), so a lease can never collide with a
step lock. `holders()` reads `pg_locks`, which any role can see, so the API
process can report both leases on /internal/health without owning either.
"""

from __future__ import annotations

import logging

log = logging.getLogger('pipeline2.lease')

LEASE_NAMESPACE = 4727          # distinct from the step-lock namespace (4726)
WORKER_LEASE = 1
SCHEDULER_LEASE = 2

_NAMES = {WORKER_LEASE: 'worker', SCHEDULER_LEASE: 'scheduler'}

# The lease is a SESSION lock, so it dies with the connection — and a
# connection whose container was recreated does not die on the server until
# TCP notices, which with the kernel defaults is over two hours. On
# 2026-09-28 the scheduler fired nothing between 12:10 and 21:30 IST (no
# 18:00 daily_run, no 19:30 sweep, no 20:10 filings slot) across a day of
# redeploys: the new process found the lease held by its predecessor's
# lingering idle session and stood down, as designed. Keepalives on the
# lease connections make the server reap that session in about a minute.
KEEPALIVES = {
    'keepalives': 1,
    'keepalives_idle': 30,
    'keepalives_interval': 10,
    'keepalives_count': 3,
}


def try_acquire(conn, key: int) -> bool:
    """Take the session lease for `key` on `conn`. Returns False when another
    session holds it. Never blocks. The lease lives as long as `conn`."""
    with conn.cursor() as cur:
        cur.execute('SELECT pg_try_advisory_lock(%s, %s)', (LEASE_NAMESPACE, key))
        got = bool(cur.fetchone()[0])
    conn.commit()
    if got:
        log.info(f'{_NAMES.get(key, key)} lease acquired')
    else:
        log.warning(f'{_NAMES.get(key, key)} lease is held by another session — '
                    f'this instance will not run it (PIPELINE2_ROLE=api-only silences this)'
                    f'{holder_note(conn, key)}')
    return got


def holder_note(conn, key: int) -> str:
    """' — held by pid N (state, since T, from ADDR)' for the log, or '' when
    pg_stat_activity hides the session (another database user). Best effort:
    a failure here must never turn a refused lease into a crash."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT a.pid, a.state, a.backend_start, a.client_addr "
                "  FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid "
                " WHERE l.locktype = 'advisory' AND l.granted "
                "   AND l.classid = %s AND l.objid = %s LIMIT 1",
                (LEASE_NAMESPACE, key))
            row = cur.fetchone()
        conn.rollback()
        if not row:
            return ''
        pid, state, since, addr = row
        return f' — held by pid {pid} ({state or "?"}, since {since}, from {addr})'
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        return ''


def holders(conn) -> dict[str, bool]:
    """Which leases are currently held by ANY session — read from pg_locks, so
    it works from a connection that owns neither."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT objid FROM pg_locks "
            " WHERE locktype = 'advisory' AND granted AND classid = %s "
            "   AND objid IN (%s, %s)",
            (LEASE_NAMESPACE, WORKER_LEASE, SCHEDULER_LEASE),
        )
        held = {int(r[0]) for r in cur.fetchall()}
    conn.rollback()
    return {'worker': WORKER_LEASE in held, 'scheduler': SCHEDULER_LEASE in held}
