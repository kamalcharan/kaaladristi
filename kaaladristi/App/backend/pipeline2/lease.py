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
                    f'this instance will not run it (PIPELINE2_ROLE=api-only silences this)')
    return got


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
