"""
A second opinion on a filing read — km_filing_read_checks (migration 233)
=========================================================================
Owner, 2026-09-29: "qwen comparison is separate task, only for admin ...
system will run for qwen ... for selected options, we will run haiku ...
and then compare."

So the reader (lib/filing_reader.py) stays on the local backend for every
filing, and a paid Haiku read is something an admin ASKS for on rows they
pick. This module is that request, the background runner that serves it,
and the summary the admin panel reads.

Three rules, each one a line that would be easy to drop:

1. **The check is the OTHER backend.** A Qwen-read row gets a Haiku check;
   a Haiku-read row (the 883 backfilled before the reader moved local)
   gets a free local check. Asking for the same backend again is refused —
   it would measure nothing.
2. **A paid request is capped per click** (PAID_PER_REQUEST, 25 ≈ $0.14),
   and a done paid check is never re-run by a second click. Failed rows are
   reset and retried; done rows are a record.
3. **The runner is one thread in the API process, never the pipeline
   worker.** A 25-row Haiku batch is a minute; an 883-row local batch is a
   day of Qwen time, and neither may sit in front of the 18:00 daily run.
   Paid checks are claimed first (an admin is waiting), local ones fill in
   behind. A process restart leaves `running` rows, which the next start
   releases (release_stale_running) the way the reader does.

The check reads the TEXT the primary read already stored on
km_filings_raw.raw_text — no document is downloaded, and the two verdicts
are given the same words. A row whose text was never stored (a PDF-as-images
read on Anthropic, or an OCR-less scan) cannot be checked and fails with a
reason rather than fetching.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from datetime import datetime, timedelta
from typing import Callable, Optional

from lib import filing_reader as fr

log = logging.getLogger('filing_checks')

BACKENDS = ('anthropic', 'local')
PAID_PER_REQUEST = int(os.getenv('FILING_CHECK_PAID_PER_REQUEST', '25'))
LOCAL_PER_REQUEST = int(os.getenv('FILING_CHECK_LOCAL_PER_REQUEST', '2000'))
MAX_ATTEMPTS = int(os.getenv('FILING_CHECK_MAX_ATTEMPTS', '3'))
FAIL_STREAK_STOP = 5
# When the backend stops answering, the runner does not give up: it puts the
# streak's rows back, waits, and tries again — owner, 2026-09-29: "it will run
# 3-4 and then stop, needs physical run again". 24 rounds of 5 minutes is two
# hours of patience before it stops for good and says so.
BACKOFF_SEC = int(os.getenv('FILING_CHECK_BACKOFF_SEC', '300'))
BACKOFF_ROUNDS = int(os.getenv('FILING_CHECK_BACKOFF_ROUNDS', '24'))
_sleep = time.sleep          # swapped by tests
_stop = threading.Event()   # set by stop_checks(); cleared when a runner starts
STALE_RUNNING_MIN = 30


def backend_of_model(model: Optional[str]) -> str:
    """Which backend a stored `model` label came from."""
    return 'local' if (model or '').startswith('local:') else 'anthropic'


def other_backend(model: Optional[str]) -> str:
    return 'anthropic' if backend_of_model(model) == 'local' else 'local'


def backend_missing(backend: str) -> Optional[str]:
    if backend == 'anthropic':
        return None if fr.has_api_key() else 'ANTHROPIC_API_KEY not set'
    if backend == 'local':
        return None if fr.LOCAL_URL else 'FILING_READ_LOCAL_URL / LLM_BASE_URL / AI_BASE_URL not set'
    return f'unknown backend {backend!r}'


# ── requests ─────────────────────────────────────────────────────────────

def request_checks(conn, event_ids: list, backend: str, requested_by: Optional[str]) -> dict:
    """Queue a check on each event, for the backend named. Returns counts:
    queued, already (a done check exists), same_backend (the primary verdict
    came from this backend — nothing to compare), no_read (no done primary),
    capped (over the per-request cap)."""
    if backend not in BACKENDS:
        raise ValueError(f'backend must be one of {BACKENDS}')
    cap = PAID_PER_REQUEST if backend == 'anthropic' else LOCAL_PER_REQUEST
    ids = [int(i) for i in dict.fromkeys(event_ids)]          # de-duplicated, order kept
    out = {'queued': 0, 'already': 0, 'same_backend': 0, 'no_read': 0, 'capped': 0}
    if not ids:
        return out
    with conn.cursor() as cur:
        cur.execute("SELECT event_id, model FROM km_filing_reads WHERE status = 'done' AND event_id = ANY(%s)",
                    (ids,))
        primary = {r[0]: r[1] for r in cur.fetchall()}
        cur.execute("SELECT event_id, status FROM km_filing_read_checks WHERE backend = %s AND event_id = ANY(%s)",
                    (backend, ids))
        existing = {r[0]: r[1] for r in cur.fetchall()}
        for eid in ids:
            if eid not in primary:
                out['no_read'] += 1
                continue
            if backend_of_model(primary[eid]) == backend:
                out['same_backend'] += 1
                continue
            if existing.get(eid) in ('done', 'pending', 'running'):
                out['already'] += 1
                continue
            if out['queued'] >= cap:
                out['capped'] += 1
                continue
            cur.execute("""
                INSERT INTO km_filing_read_checks (event_id, backend, requested_by)
                VALUES (%s, %s, %s)
                ON CONFLICT (event_id, backend) DO UPDATE
                   SET status = 'pending', attempts = 0, last_error = NULL,
                       requested_by = EXCLUDED.requested_by, requested_at = now(),
                       started_at = NULL, finished_at = NULL
                 WHERE km_filing_read_checks.status = 'failed'
            """, (eid, backend, requested_by))
            out['queued'] += 1
    conn.commit()
    return out


def queue_local_checks_for_paid_reads(conn, requested_by: Optional[str]) -> int:
    """Every done primary verdict that Anthropic gave and no local check has
    seen yet — the free half of the comparison, 883 rows on 2026-09-29. One
    INSERT; the runner works through them at Qwen's pace behind any paid
    request."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO km_filing_read_checks (event_id, backend, requested_by)
            SELECT r.event_id, 'local', %s
              FROM km_filing_reads r
              JOIN km_filings_raw f ON f.id = (SELECT primary_raw_id FROM km_corporate_events WHERE id = r.event_id)
             WHERE r.status = 'done' AND r.model IS NOT NULL AND r.model NOT LIKE 'local:%%'
               AND f.raw_text IS NOT NULL AND length(f.raw_text) > 0
               AND NOT EXISTS (SELECT 1 FROM km_filing_read_checks c
                                WHERE c.event_id = r.event_id AND c.backend = 'local')
        """, (requested_by,))
        n = cur.rowcount
    conn.commit()
    return n


def restart_read(conn, event_id: int) -> bool:
    """Owner's point 4: a failed or unreadable primary read goes back to
    pending so the next ingest slot reads it again. Done rows are never
    reset from here — a verdict is a record."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE km_filing_reads
               SET status = 'pending', attempts = 0, last_error = NULL,
                   started_at = NULL, finished_at = NULL, queued_at = now()
             WHERE event_id = %s AND status IN ('failed', 'unreadable', 'skipped')
        """, (event_id,))
        n = cur.rowcount
    conn.commit()
    return n > 0


# ── the runner ───────────────────────────────────────────────────────────

def release_stale_running(conn, older_than_minutes: int = STALE_RUNNING_MIN) -> int:
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE km_filing_read_checks SET status = 'pending', started_at = NULL
             WHERE status = 'running' AND started_at < now() - (%s || ' minutes')::interval
        """, (str(older_than_minutes),))
        n = cur.rowcount
    conn.commit()
    return n


def claim_next(conn) -> Optional[dict]:
    """Paid first (someone clicked and is watching), then local, oldest first."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE km_filing_read_checks c
               SET status = 'running', started_at = now(), attempts = c.attempts + 1
             WHERE c.id = (SELECT id FROM km_filing_read_checks
                            WHERE status = 'pending' AND attempts < %s
                            ORDER BY (backend = 'anthropic') DESC, requested_at, id
                            FOR UPDATE SKIP LOCKED LIMIT 1)
         RETURNING c.id, c.event_id, c.backend, c.attempts
        """, (MAX_ATTEMPTS,))
        row = cur.fetchone()
    conn.commit()
    if not row:
        return None
    return {'check_id': row[0], 'event_id': row[1], 'backend': row[2], 'attempts': row[3]}


def _finish(conn, check_id: int, status: str, error: Optional[str] = None, **fields) -> None:
    sets = ['status = %s', 'finished_at = now()', 'last_error = %s']
    params = [status, (error or '')[:500] or None]
    for k, v in fields.items():
        sets.append(f'{k} = %s')
        params.append(v)
    params.append(check_id)
    with conn.cursor() as cur:
        cur.execute(f"UPDATE km_filing_read_checks SET {', '.join(sets)} WHERE id = %s", params)
    conn.commit()


def make_client(backend: str):
    if backend == 'local':
        # History checks are LOW priority: LLM_ROUTE_LOW, Qwen when unset.
        return fr.lane_client('low')
    import anthropic
    return anthropic.Anthropic(api_key=fr._api_key())


def run_one(conn, check: dict, client) -> str:
    """Read the stored text through the check's backend and store the verdict."""
    backend = check['backend']
    row = fr.load_event_row(conn, check['event_id'])
    text = (row.get('raw_text') or '').strip()
    if not text:
        _finish(conn, check['check_id'], 'failed', 'no stored text for this filing — the primary read used the PDF')
        return 'failed'
    # The stored text joins pages with a blank line (extract_text wrote it so);
    # splitting there gives fit_to_chars whole pages to keep or drop.
    parts = text.split('\n\n') if '\n\n' in text else [text]
    doc = fr._from_pages(parts, row.get('raw_page_count') or len(parts), 'text')
    doc.needs_pdf = False
    if backend == 'local':
        doc = fr.fit_to_chars(doc, fr.local_doc_char_budget(getattr(client, 'ctx_tokens', None)))
        doc.needs_pdf = False
    model = fr._resolve_model(backend)
    try:
        resp = client.messages.parse(
            model=model, max_tokens=fr.MAX_TOKENS, system=fr.SYSTEM_PROMPT,
            messages=fr.build_messages(row, doc, None), output_format=fr.FilingVerdict,
        )
        verdict = resp.parsed_output
        usage = getattr(resp, 'usage', None)
        inp = int(getattr(usage, 'input_tokens', 0) or 0)
        out = int(getattr(usage, 'output_tokens', 0) or 0)
    except Exception as e:
        _finish(conn, check['check_id'], 'failed', f'model: {e}')
        return 'model_error'          # the server, not the document — counts toward the streak
    if getattr(resp, 'label', None):
        model = resp.label
    elif backend == 'local':
        served = getattr(resp, 'model', None)
        if served:
            model = 'local:' + os.path.basename(str(served))[:80]
    impact = verdict.impact if verdict.impact in fr.IMPACTS else 'unclear'
    magnitude = verdict.magnitude if verdict.magnitude in fr.MAGNITUDES else 'unknown'
    relative_to = verdict.relative_to if verdict.relative_to in ('mcap', 'revenue') else None
    _finish(
        conn, check['check_id'], 'done', None,
        impact=impact, magnitude=magnitude,
        headline=(verdict.headline or '')[:300], reasoning=verdict.reasoning,
        evidence_quote=verdict.evidence_quote,
        confidence=max(0.0, min(1.0, float(verdict.confidence or 0))),
        amount_value=verdict.amount_value, amount_unit=verdict.amount_unit,
        amount_basis=verdict.amount_basis, relative_to=relative_to,
        relative_pct=verdict.relative_pct, role=verdict.role,
        model=model, reader_version=fr.READER_VERSION,
        page_count=doc.page_count, pages_read=doc.pages_read,
        input_tokens=inp, output_tokens=out, cost_usd=fr._cost(model, inp, out),
    )
    return 'done'


def requeue(conn, check_ids: list) -> int:
    """Rows that failed because the SERVER was away go back to pending, and
    the attempt is not held against them — the document was never read."""
    if not check_ids:
        return 0
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE km_filing_read_checks
               SET status = 'pending', attempts = GREATEST(attempts - 1, 0),
                   started_at = NULL, finished_at = NULL
             WHERE id = ANY(%s) AND status = 'failed'
        """, (list(check_ids),))
        n = cur.rowcount
    conn.commit()
    return n


def current_reader(conn):
    """A callable that reads ONE pending filing (newest first) and returns its
    status, or None when nothing is waiting. None when the reader cannot run.

    Owner, 2026-10-01: "because history is getting done, current is not
    analysed". The checks and the reader share one Qwen slot, and an 800-row
    check backlog is two days of it. So the runner reads today's filings
    first and fills the gaps with checks."""
    if fr.backend_missing() or fr.schema_missing(conn):
        return None
    released = fr.release_stale_reading(conn)      # reads cut off by a restart
    if released:
        log.info('filing reads: released %s interrupted reads', released)
    with conn.cursor() as cur:
        cur.execute('SELECT now()')
        started = cur.fetchone()[0]
    conn.rollback()
    ctx = {}

    def _read(c):
        # CURRENT filings only. The old backlog stays with the worker's
        # ingest passes; owner, 2026-10-01: Qwen was "in a loop" on it here.
        row = fr._claim_next(c, retry_failed=True, pass_started=started, newer_than_days=fr.HIGH_DAYS)
        if row is None:
            return None
        if 'session' not in ctx:
            from pipeline.utils.nse_session import NseSession
            ctx['session'] = NseSession()
        _doing('read', row.get('read_id'), row.get('company_name'), fr.priority_of(row))
        try:
            return fr.read_one(c, row, fr.client_for(row), ctx['session'])
        except Exception as e:
            c.rollback()
            log.exception('filing read %s crashed', row['read_id'])
            fr._finish(c, row['read_id'], 'failed', f'reader: {e}')
            return 'failed'
        finally:
            _state['doing'] = None
    return _read


def run_pending(conn, clients: Optional[dict] = None, max_seconds: float = 0,
                read_current=None) -> dict:
    """Work the queue until it is empty (or the time budget is spent).
    With `read_current`, every turn first reads one pending FILING (the
    current stream) and only takes a check when no filing is waiting.
    `clients` maps backend → client, built lazily. A backend that cannot run
    (no key, no URL) fails its rows with that reason instead of retrying
    forever. A backend that stops ANSWERING mid-run (5 model errors in a
    row) is waited for: the streak's rows are requeued, the runner sleeps
    BACKOFF_SEC and carries on, up to BACKOFF_ROUNDS times."""
    stats = {'done': 0, 'failed': 0, 'skipped_backend': 0, 'backoffs': 0, 'reads': 0}
    clients = clients if clients is not None else {}
    release_stale_running(conn)
    t0 = time.monotonic()
    streak, streak_ids = 0, []   # consecutive MODEL failures — a dead server answers 404 to everything after
    while True:
        if _stop.is_set():
            stats['stopped'] = 'stopped by admin'
            break
        if streak >= FAIL_STREAK_STOP:
            requeue(conn, streak_ids)
            streak, streak_ids = 0, []
            stats['backoffs'] += 1
            if stats['backoffs'] > BACKOFF_ROUNDS:
                stats['stopped'] = (f'the backend did not answer for {BACKOFF_ROUNDS} rounds of '
                                    f'{BACKOFF_SEC}s — stopped; rows stay pending')
                break
            log.warning('filing checks: backend not answering, waiting %ss (round %s of %s)',
                        BACKOFF_SEC, stats['backoffs'], BACKOFF_ROUNDS)
            _state['waiting_until'] = (datetime.utcnow() + timedelta(seconds=BACKOFF_SEC)).isoformat() + 'Z'
            if _sleep is time.sleep:
                _stop.wait(BACKOFF_SEC)            # a Stop ends the wait at once
            else:
                _sleep(BACKOFF_SEC)
            _state['waiting_until'] = None
            continue
        if max_seconds and time.monotonic() - t0 >= max_seconds:
            stats['stopped'] = f'time budget {int(max_seconds)}s reached'
            break
        if read_current is not None:
            r = read_current(conn)
            if r is not None:
                stats['reads'] += 1
                if r == 'failed':                    # a dead server fails reads too
                    streak += 1
                elif r == 'done':
                    streak, streak_ids = 0, []
                if fr.REQUEST_DELAY_SEC:
                    time.sleep(fr.REQUEST_DELAY_SEC)
                continue
        check = claim_next(conn)
        if not check:
            break
        b = check['backend']
        if b not in clients:
            # A client handed in is a backend that can run; only build one
            # when the environment says it can.
            missing = backend_missing(b)
            if missing:
                _finish(conn, check['check_id'], 'failed', missing)
                stats['skipped_backend'] += 1
                continue
            clients[b] = make_client(b)
        _doing('check', check['check_id'], None, 'low' if b == 'local' else 'paid')
        try:
            r = run_one(conn, check, clients[b])
        except Exception as e:                       # a crash on one row never stops the queue
            log.exception('filing check %s crashed', check['check_id'])
            _finish(conn, check['check_id'], 'failed', f'crash: {e}')
            r = 'failed'
        finally:
            _state['doing'] = None
        stats['done' if r == 'done' else 'failed'] += 1
        if r == 'model_error':
            streak += 1
            streak_ids.append(check['check_id'])
        elif r == 'done':
            streak, streak_ids = 0, []
        if fr.REQUEST_DELAY_SEC:
            time.sleep(fr.REQUEST_DELAY_SEC)
    return stats


# ── one thread in the API process ────────────────────────────────────────

_lock = threading.Lock()
_state = {'running': False, 'started_at': None, 'finished_at': None, 'last': None, 'error': None,
          'waiting_until': None, 'doing': None, 'stopping': False}
RUNNER_THREAD = 'filing-checks'


def _doing(kind: str, row_id, company, priority) -> None:
    """What the runner is on right now — the panel's 'Running now' line."""
    _state['doing'] = {'kind': kind, 'id': row_id, 'company': company, 'priority': priority,
                       'since': datetime.utcnow().isoformat() + 'Z'}


def runner_state() -> dict:
    return dict(_state)


def ensure_runner(conn_factory: Callable[[], object]) -> bool:
    """Start the background thread if it is not already running. Returns True
    when a thread was started. Single-flight: a second click while a batch is
    running just adds rows to the queue the live thread is draining."""
    with _lock:
        if _state['running']:
            return False
        _stop.clear()
        _state.update(stopping=False, doing=None)
        _state.update(running=True, started_at=datetime.utcnow().isoformat() + 'Z',
                      finished_at=None, error=None)

    def _work():
        conn = None
        try:
            conn = conn_factory()
            try:
                reader = current_reader(conn)
            except Exception as e:                   # the checks still run without it
                log.warning('filing checks: current reads not available: %s', e)
                reader = None
            _state['last'] = run_pending(conn, read_current=reader)
        except Exception as e:
            log.exception('filing check runner died')
            _state['error'] = str(e)[:300]
        finally:
            try:
                if conn is not None:
                    conn.close()
            except Exception:
                pass
            with _lock:
                _state.update(running=False, waiting_until=None, doing=None, stopping=False,
                              finished_at=datetime.utcnow().isoformat() + 'Z')

    threading.Thread(target=_work, name=RUNNER_THREAD, daemon=True).start()
    return True


def stop_checks(conn) -> int:
    """Stop the runner and park every waiting check as failed('stopped by
    admin'). The row in flight finishes; nothing is deleted. A parked check
    runs again only when someone asks for it again (request_checks resets
    failed rows), never on its own — not even at API start."""
    _stop.set()
    if _state['running']:
        _state['stopping'] = True          # the item in flight finishes first
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE km_filing_read_checks
               SET status = 'failed', last_error = 'stopped by admin', finished_at = now()
             WHERE status = 'pending'
        """)
        n = cur.rowcount
    conn.commit()
    return n


def pending_count(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM km_filing_read_checks WHERE status = 'pending'")
        return int(cur.fetchone()[0])


def pending_reads(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM km_filing_reads WHERE status = 'pending'")
        n = int(cur.fetchone()[0])
    conn.rollback()
    return n


# ── the admin panel ──────────────────────────────────────────────────────

def summary(conn) -> dict:
    """Queue counts by backend, cost, and agreement per event type."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT backend, status, count(*), coalesce(sum(cost_usd), 0)
              FROM km_filing_read_checks GROUP BY 1, 2
        """)
        queue = {}
        cost = 0.0
        for backend, status, n, usd in cur.fetchall():
            queue.setdefault(backend, {})[status] = int(n)
            cost += float(usd or 0)
        cur.execute("""
            SELECT event_type, count(*),
                   sum(agree_impact::int), sum(agree_magnitude::int)
              FROM v_filing_read_agreement
             GROUP BY 1 ORDER BY 2 DESC, 1
        """)
        by_type = [{'event_type': et or '?', 'n': int(n), 'impact': int(ai or 0), 'magnitude': int(am or 0)}
                   for et, n, ai, am in cur.fetchall()]
        cur.execute("""
            SELECT count(*), sum(agree_impact::int), sum(agree_magnitude::int)
              FROM v_filing_read_agreement
        """)
        n, ai, am = cur.fetchone()
        cur.execute("""
            SELECT count(*) FROM km_filing_reads r
             WHERE r.status = 'done' AND r.model IS NOT NULL AND r.model NOT LIKE 'local:%%'
               AND NOT EXISTS (SELECT 1 FROM km_filing_read_checks c
                                WHERE c.event_id = r.event_id AND c.backend = 'local')
        """)
        paid_unchecked = int(cur.fetchone()[0])
        current = current_reads(cur)
        running_now = _running_now(cur)
    conn.rollback()
    return {
        'compared': int(n or 0), 'agree_impact': int(ai or 0), 'agree_magnitude': int(am or 0),
        'by_type': by_type, 'queue': queue, 'cost_usd': round(cost, 4),
        'paid_reads_without_local_check': paid_unchecked,
        'paid_per_request': PAID_PER_REQUEST,
        'runner': runner_state(),
        'current': current,
        'running_now': running_now,
    }


def _running_now(cur) -> list:
    """Every read and check in flight, and WHERE it runs. The API runner is
    this process (we know its row and the provider it is waiting on); a read
    in `reading` that is not the runner's belongs to the pipeline worker's
    ingest pass, a separate process this one cannot see inside."""
    doing = _state.get('doing') or {}
    lane = fr.llm_lanes.inflight().get(RUNNER_THREAD) or {}
    out = []
    # The worker reads ONE filing at a time, and only inside a running
    # filings_ingest job — so at most one non-runner row, started after that
    # job did, is the worker's. Any other `reading` row was cut off (a
    # container restart mid-read) and is released after 30 minutes.
    cur.execute("""
        SELECT max(started_at) FROM km_jobs
         WHERE status = 'running' AND dimension = 'filings_ingest'
    """)
    job_started = cur.fetchone()[0]
    cur.execute("""
        SELECT r.id, e.company_name, e.disseminated_at, r.started_at
          FROM km_filing_reads r JOIN km_corporate_events e ON e.id = r.event_id
         WHERE r.status = 'reading' ORDER BY r.started_at DESC
    """)
    worker_seen = False
    rows = []
    for rid, company, filed, started in cur.fetchall():
        mine = doing.get('kind') == 'read' and doing.get('id') == rid
        if mine:
            where = 'API runner'
        elif job_started and not worker_seen and started and started >= job_started:
            where, worker_seen = 'Pipeline worker', True
        else:
            where = 'Interrupted — released automatically after 30 min'
        rows.append((rid, company, filed, started, mine, where))
    for rid, company, filed, started, mine, where in reversed(rows):
        out.append({'where': where, 'kind': 'read',
                    'company': company, 'filed_at': filed.isoformat() if filed else None,
                    'since': started.isoformat() if started else None,
                    'provider': lane.get('provider') if mine else None})
    cur.execute("""
        SELECT c.id, e.company_name, c.backend, c.started_at
          FROM km_filing_read_checks c JOIN km_corporate_events e ON e.id = c.event_id
         WHERE c.status = 'running' ORDER BY c.started_at
    """)
    for cid, company, backend, started in cur.fetchall():
        mine = doing.get('kind') == 'check' and doing.get('id') == cid
        out.append({'where': 'API runner' if mine else 'API runner (stale — released on next start)',
                    'kind': 'check', 'company': company, 'filed_at': None,
                    'since': started.isoformat() if started else None,
                    'provider': (lane.get('provider') if mine else None) or ('haiku' if backend == 'anthropic' else 'qwen')})
    return out


def current_reads(cur) -> dict:
    """The CURRENT stream — filings disseminated within FILING_READ_HIGH_DAYS —
    and who read them. The panel above it measures history; this says whether
    today's filings are being read at all, and by which lane."""
    days = fr.HIGH_DAYS
    cur.execute("""
        SELECT r.status, count(*)
          FROM km_filing_reads r JOIN km_corporate_events e ON e.id = r.event_id
         WHERE e.disseminated_at >= now() - make_interval(secs => %s)
         GROUP BY 1
    """, (days * 86400,))
    status = {k: int(n) for k, n in cur.fetchall()}
    cur.execute("""
        SELECT CASE WHEN r.model LIKE '%%:%%' THEN split_part(r.model, ':', 1) ELSE 'haiku' END,
               count(*), max(r.finished_at)
          FROM km_filing_reads r JOIN km_corporate_events e ON e.id = r.event_id
         WHERE e.disseminated_at >= now() - make_interval(secs => %s) AND r.status = 'done'
         GROUP BY 1 ORDER BY 2 DESC
    """, (days * 86400,))
    by_reader, last_read = [], None
    for reader, n, last in cur.fetchall():
        by_reader.append({'reader': 'qwen' if reader == 'local' else reader, 'n': int(n)})
        if last and (last_read is None or last > last_read):
            last_read = last
    cur.execute("""
        SELECT min(e.disseminated_at)
          FROM km_filing_reads r JOIN km_corporate_events e ON e.id = r.event_id
         WHERE e.disseminated_at >= now() - make_interval(secs => %s) AND r.status = 'pending'
    """, (days * 86400,))
    oldest = cur.fetchone()[0]
    return {
        'days': days, 'status': status, 'by_reader': by_reader,
        'last_read_at': last_read.isoformat() if last_read else None,
        'oldest_waiting_at': oldest.isoformat() if oldest else None,
        'route': fr.llm_lanes.route('high'),
    }
