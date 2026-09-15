"""Per-dimension watermarks — when each dimension was last computed for a date.

Phase 0 gave `fix` jobs a dependency cascade, so repairing one dimension
re-runs everything derived from it. What it could not give was PROOF. Nothing
recorded which version of its inputs a row was derived from, so a row computed
from superseded data looked exactly like a current one — and every existing
health check measures PRESENCE (is the column filled), which cannot see the
difference. That is the same blind spot that let `value_cr` run 1e5x wrong and
`dot_svd` sit all-FALSE for months, green the whole time.

The gap was wider than "no watermark". `run_daily` produces a StepOutcome per
dimension and the worker stores NONE of them individually — they are folded
into one aggregate km_jobs row (dimension NULL) plus a progress_text string. So
until this module, nothing in the database could answer "when was nse_magic_rs
last computed for 2026-09-11".

    stamp()              record a dimension as computed for a date
    parents_of()         invert DIMENSION_DEPENDENTS
    stale_derivations()  dimensions whose PARENT was computed later

Three properties are load-bearing. Do not "simplify" them away:

1. **Absent is UNKNOWN, never stale.** The table starts empty and fills
   forward. A missing watermark means nobody has stamped that dimension-date
   yet, which is not evidence of anything — and a check that reported it as a
   finding would emit thousands on its first night and be muted by the second.
   The `stale_derivations` query therefore requires BOTH rows to exist.

2. **'partial' stamps.** A partial run computed against the inputs as they
   stood; it simply did not reach its fill threshold, which is a different
   question that DIMENSION_HEALTH already answers. There are 2,184 partial fix
   jobs on record — refusing to stamp them would make most dimensions read as
   permanently stale. 'failed' never stamps, so a failure cannot make a
   dimension look current.

3. **Strictly greater.** A parent equal to its child is fresh. Parents run
   before children inside one `run_daily`, often within the same second, and
   `>=` would report every clean nightly run as stale.
"""

from __future__ import annotations

from datetime import date
from typing import Iterable

from .orchestrator import DIMENSION_DEPENDENTS, DAILY_STEPS

# Sources accepted by the migration-210 CHECK. Kept here so a typo is a Python
# error at the call site rather than a constraint violation at 2 a.m.
SOURCES = ('daily_run', 'fix', 'backfill', 'cascade', 'manual')

# Only a compute that actually ran advances a watermark.
STAMPABLE = ('completed', 'partial')


def parents_of() -> dict[str, list[str]]:
    """Invert DIMENSION_DEPENDENTS: dimension → the dimensions it derives FROM.

    One declaration, two directions. The cascade walks it downward to decide
    what to recompute; the staleness check walks it upward to decide what
    should have been recomputed and was not.
    """
    out: dict[str, list[str]] = {}
    for parent, children in DIMENSION_DEPENDENTS.items():
        for child in children:
            out.setdefault(child, []).append(parent)
    return {k: sorted(v) for k, v in out.items()}


def stamp(conn, dimension: str, trade_date: date | str, status: str,
          source: str, job_id: int | None = None,
          rows_affected: int | None = None) -> bool:
    """Record `dimension` as computed for `trade_date`. Returns True if written.

    Best-effort by design: a watermark is instrumentation, and a failure to
    record one must never fail the compute that succeeded. It swallows its own
    errors and reports False — including the case where migration 210 has not
    been applied yet, so a backend deployed ahead of the migration keeps running
    (the same deploy-ordering guard `bm_event` needed on the frontend).
    """
    if status not in STAMPABLE:
        return False
    if source not in SOURCES:
        raise ValueError(f'unknown watermark source {source!r}; expected one of {SOURCES}')

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO km_dimension_watermarks
                       (dimension, trade_date, computed_at, status, source, job_id, rows_affected)
                VALUES (%s, %s, now(), %s, %s, %s, %s)
                ON CONFLICT (dimension, trade_date) DO UPDATE SET
                       computed_at   = now(),
                       status        = EXCLUDED.status,
                       source        = EXCLUDED.source,
                       job_id        = EXCLUDED.job_id,
                       rows_affected = EXCLUDED.rows_affected
                """,
                [dimension, str(trade_date), status, source, job_id, rows_affected],
            )
        conn.commit()
        return True
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        return False


def stale_derivations(conn, since: date | str, until: date | str | None = None
                      ) -> list[dict]:
    """Dimensions whose PARENT carries a later computed_at for the same date.

    Each row is one (dimension, trade_date) derived from superseded inputs,
    naming the parent and the lag. Both watermarks must exist — see property 1
    in the module docstring: absent is unknown, not stale.

    Returns [] rather than raising when migration 210 has not been applied.
    """
    parents = parents_of()
    if not parents:
        return []

    # A VALUES list of the real edges keeps the graph in Python (one
    # declaration) while letting PostgreSQL do the join.
    edges = [(child, parent) for child, ps in parents.items() for parent in ps]
    values = ','.join(['(%s,%s)'] * len(edges))
    params: list = []
    for child, parent in edges:
        params.extend([child, parent])
    params.extend([str(since), str(until or since)])

    sql = f"""
        WITH edge(child, parent) AS (VALUES {values})
        SELECT e.child        AS dimension,
               c.trade_date,
               e.parent,
               c.computed_at  AS child_computed_at,
               p.computed_at  AS parent_computed_at,
               EXTRACT(EPOCH FROM (p.computed_at - c.computed_at))::bigint AS lag_seconds,
               c.status       AS child_status,
               p.source       AS parent_source
        FROM edge e
        JOIN km_dimension_watermarks c
          ON c.dimension = e.child
        JOIN km_dimension_watermarks p
          ON p.dimension = e.parent AND p.trade_date = c.trade_date
        WHERE c.trade_date BETWEEN %s AND %s
          AND p.computed_at > c.computed_at
        ORDER BY c.trade_date DESC, lag_seconds DESC
    """
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, r)) for r in cur.fetchall()]
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        return []


def validate_parents(dimensions: Iterable[str] | None = None) -> None:
    """Every parent edge must name a dimension that DAILY_STEPS actually runs.

    Runs at import, like orchestrator.validate_dependents — a graph that names a
    dimension nobody computes produces a watermark that is never stamped, and
    therefore a check that is silently blind on that edge. A startup error is
    far cheaper than that.
    """
    known = set(dimensions) if dimensions is not None else {d for d, _ in DAILY_STEPS}
    for child, ps in parents_of().items():
        if child not in known:
            raise ValueError(
                f'watermark graph: {child!r} is a dependent of '
                f'{", ".join(ps)} but is not a DAILY_STEPS dimension'
            )
        for p in ps:
            if p not in known:
                raise ValueError(
                    f'watermark graph: {child!r} derives from {p!r}, '
                    'which is not a DAILY_STEPS dimension'
                )


validate_parents()
