"""
The read — a material filing's impact on the company, from the document
=======================================================================
Plan of record: docs/claude/filing-intelligence-poa.md, "Sprint 3 — REVISED
2026-09-28: the read". Owner: *"read the content of the filings, check if it
will have +ve or -ve impact over the company, report."*

One row per material event in km_filing_reads (migration 229), created
`pending` the moment the event exists, so "yet to start" is a real row the
dashboard can count. `read_pending()` runs as the LAST step of every
filings_ingest pass (06:10 / 09:10 / 12:10 / 20:10 / 23:10 IST) and from
scripts/backfill_filing_reads.py for the six-month history.

Three rules that are load-bearing and not visible in any type:

1. **Newest first, capped per pass.** A live pass reads today's filings before
   anything older and stops at FILING_READ_MAX_PER_PASS, so the backlog never
   delays the 12:10 read of a mid-session order win. The backfill script
   drains the rest with its own cap.
2. **Selecting on status makes it correct across five triggers.** A row read
   at 12:10 is `done` and never re-read; one that failed is `failed` and the
   next pass retries it until FILING_READ_MAX_ATTEMPTS. No separate scheduler.
3. **The verdict is the impact on the COMPANY as the filing states it, quoted.**
   It is not a price forecast and the prompt says so. The drift the scanner
   shows beside it comes from bars, never from here.

The document is read from its text layer (pypdf) when the text layer is real
(>= CHARS_PER_PAGE_FLOOR chars/page, the Sprint 3 gate: a scanned PDF reports
success with near-nothing). A scanned document is OCR'd with Tesseract
(pypdfium2 renders the pages, pytesseract reads them — owner, 2026-09-28:
"python libraries should convert into metadata and send it to qwen, image
models will be expensive"), and only when no OCR is installed does the
Anthropic backend fall back to sending the PDF as images. Text is never
truncated; a document over FILING_READ_MAX_PAGES is read to the cap and the
row records pages_read < page_count, so a partial read never presents as a
full one. The PDF is never stored (the 279 GB rule); the text is.

Two backends, one interface (FILING_READ_BACKEND):
  anthropic — the official SDK, Haiku by default, priced per row.
  local     — any OpenAI-compatible server (the VPS's llama.cpp Qwen3 at
              LLM_BASE_URL), free, text only, the verdict shape enforced by a
              JSON-schema grammar. Its context window is finite
              (FILING_READ_LOCAL_CTX), so a long document is trimmed to whole
              pages that fit and the row records pages_read < page_count —
              the same honest partial-read rule as the page cap.
`read_one` does not know which one it has: both expose
`messages.parse(...)` returning `.parsed_output` and `.usage`.
"""

from __future__ import annotations

import base64
import io
import logging
import os
import re
import time
import zipfile
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from lib import llm_lanes

log = logging.getLogger('filing_reader')

READER_VERSION = 'v2'   # v2: touches / company_view / timeframe / watch_next (migration 238)
MATERIAL_FAMILIES = ('SPARK', 'NEGATIVE_SPARK', 'OWNERSHIP', 'CORPORATE_ACTION')

# ── which model reads ────────────────────────────────────────────────────
#
# FILING_READ_BACKEND=anthropic (default): the official SDK. The model is the
# reader's OWN setting, not AI_MODEL — AI_MODEL is the VaNi layer's and on the
# VPS it names the local Qwen server. Owner, 2026-09-28: Haiku.
#
# FILING_READ_BACKEND=local: the OpenAI-compatible server at
# FILING_READ_LOCAL_URL (else LLM_BASE_URL — the same llama.cpp Qwen3 the VaNi
# fallback uses). Free, so the per-row cost is 0. Text only: a scanned page
# reaches it through Tesseract or not at all. ⚠ The server's context window
# is a LAUNCH FLAG on that container, not a property of the model — Qwen3-4B
# takes 32k natively, and the VPS server was recorded at 4,096, which holds
# fewer than half of the documents measured (mean 3,724 tokens, max ~15k).
# FILING_READ_LOCAL_CTX must say what the server was actually started with;
# the reader trims the document to whole pages inside that budget and the
# row records pages_read < page_count, so an over-long read never presents as
# a full one. Wrong (too high) here means the server truncates SILENTLY at its
# own limit — the end of the document, where the annexure sits.
DEFAULT_MODEL = 'claude-haiku-4-5'


def _resolve_backend(value: Optional[str]) -> str:
    b = (value or 'anthropic').strip().lower()
    return 'local' if b == 'qwen' else b          # 'qwen' is the owner's word for it


BACKEND = _resolve_backend(os.getenv('FILING_READ_BACKEND'))


def _local_url() -> str:
    """Where the local server is. FILING_READ_LOCAL_URL, else LLM_BASE_URL,
    else — when the VaNi layer is already pointed at an OpenAI-compatible
    server (AI_PROVIDER=openai + AI_BASE_URL) — that same server, with the
    /v1 the reader's path needs. The owner's .env says where Qwen is ONCE;
    the reader should not make it say so twice."""
    url = (os.getenv('FILING_READ_LOCAL_URL') or os.getenv('LLM_BASE_URL') or '').strip().rstrip('/')
    if url:
        return url
    if (os.getenv('AI_PROVIDER') or '').strip().lower() == 'openai':
        base = (os.getenv('AI_BASE_URL') or '').strip().rstrip('/')
        if base:
            return base if base.endswith('/v1') else base + '/v1'
    return ''


LOCAL_URL = _local_url()


def _local_key() -> str:
    """The bearer for the local server. The Qwen server lives on the LLM VPS
    behind Traefik (Vikuna-Infrastructure-Documentation-v3, §3.2) and llama.cpp
    is started with --api-key, so a call without the header is a 401 — which
    is the likeliest reason `_fallback_complete` (no header) fails on the
    companion path. FILING_READ_LOCAL_KEY, else LLM_API_KEY, else AI_API_KEY
    when that is not an Anthropic key."""
    key = (os.getenv('FILING_READ_LOCAL_KEY') or os.getenv('LLM_API_KEY') or '').strip()
    if not key:
        alt = (os.getenv('AI_API_KEY') or '').strip()
        if alt and not alt.startswith('sk-ant'):
            key = alt
    return key


LOCAL_KEY = _local_key()
# NOT AI_MODEL: that is the VaNi layer's setting and on the VPS it names a
# Claude model, which would have stamped every Qwen verdict 'local:claude-…'.
# llama.cpp ignores the request's model string anyway; the row records the
# model the SERVER reports in its response (see read_one), this is the label
# used only until that answer arrives.
LOCAL_MODEL = (os.getenv('FILING_READ_LOCAL_MODEL') or 'qwen3-4b').strip()
LOCAL_CTX_TOKENS = int(os.getenv('FILING_READ_LOCAL_CTX', '16384'))
LOCAL_MAX_TOKENS = int(os.getenv('FILING_READ_LOCAL_MAX_TOKENS', '1200'))   # the verdict measures ~330
LOCAL_TIMEOUT_SEC = int(os.getenv('FILING_READ_LOCAL_TIMEOUT_SEC', '900'))  # CPU inference; slow is fine
LOCAL_PROMPT_RESERVE_TOKENS = 1800     # system prompt + schema + context block, measured ~1,400
CHARS_PER_TOKEN = 3.5                  # conservative for English filings (measured 3.7–4.1)


def _resolve_model(backend: str = None) -> str:
    """anthropic: FILING_READ_MODEL, else CLAUDE_MODEL (the owner's .env
    convention for 'the Claude model'), else the default. Never AI_MODEL — see
    above. local: 'local:<name>', which is what the row's `model` column says
    so a free read is never mistaken for a paid one in a cost query."""
    if (BACKEND if backend is None else backend) == 'local':
        return f'local:{LOCAL_MODEL}'
    return (os.getenv('FILING_READ_MODEL') or os.getenv('CLAUDE_MODEL') or '').strip() or DEFAULT_MODEL


MODEL = _resolve_model()
MAX_PER_PASS = int(os.getenv('FILING_READ_MAX_PER_PASS', '300'))
# Wall-clock cap on one pass. The reader runs INSIDE the filings_ingest job on
# the single pipeline worker: on 2026-09-29 a 300-document pass on the local
# backend (80 s to 19 min a document behind a shared one-slot server) held
# that worker for hours, and every job behind it — the two other ingests, any
# repair the operator queued, and the 18:00 daily_run itself — sat queued.
# A pass now yields after this many seconds; what it did not reach stays
# pending for the next slot, which is the honest state, not a failure.
MAX_SECONDS = int(os.getenv('FILING_READ_MAX_SECONDS', '900'))
MAX_ATTEMPTS = int(os.getenv('FILING_READ_MAX_ATTEMPTS', '5'))
MAX_PAGES = int(os.getenv('FILING_READ_MAX_PAGES', '40'))
CHARS_PER_PAGE_FLOOR = 250          # below this the "text layer" is a scanned image
MAX_TOKENS = 4000
REQUEST_DELAY_SEC = float(os.getenv('FILING_READ_DELAY_SEC', '0.5'))

# USD per million tokens (input, output) — for the per-row cost column and the
# backfill budget cap. Update when the price list moves.
PRICES = {
    'claude-haiku-4-5':  (1.00, 5.00),
    'claude-sonnet-5':   (2.00, 10.00),
    'claude-sonnet-4-6': (3.00, 15.00),
    'claude-opus-5':     (5.00, 25.00),
}

# ── gate 1 — the extracted text, after pypdf and before the model ───────
# (triage(); owner, 2026-09-28: "hitting everything for LLM is just waste of
# money"). Gate 0 — which filings are read at all — is now the TIER below.
#   * MGMT_CHANGE / MGMT_EXIT are routine unless a KEY person is the subject:
#     an independent director retiring by rotation is not a read, a CFO
#     resigning is. The exchange summary names the role on only ~14% of them,
#     the document always does. MGMT_EXIT is the best negative signal in the
#     table (8 notable negatives in the first 11 reads).
#   * AUDITOR_CHANGE — a term completing is routine, a resignation or a
#     casual vacancy is the read.
# ── tiers (migration 238; owner, 2026-10-09: "all filings needs inference —
# definitely some are low priority") ──────────────────────────────────────
#
# Gate 0 used to EXCLUDE everything outside four families, so board outcomes
# (results), press releases and credit ratings were never read — 5,689 open
# since July. Now every filing gets a row and a tier from the exchange label:
#
#   routine  the label settles it. No model call: the row is written
#            done/neutral, read_source 'rule', with ROUTINE_REASONS' line for
#            that label — "routine by type", never presented as a reading.
#            RECORD_DATE/ESOP/ALLOTMENT/AUTHORISED_CAPITAL were the old
#            never-list (measured 2026-09-28: every one neutral+minor).
#   high     material families + HIGH_DESCS, on an active NSE listing at or
#            above MIN_MCAP_CR. Read first, newest first.
#   low      the rest: General Updates, analyst-meet notes, exchange-query
#            replies, a small or inactive listing, and MGMT_CHANGE (30 of the
#            first 31 appointments read came back neutral+minor — it left the
#            never-list for the low tier, not for the high one). Read only
#            when no high-tier row waits, on the LOW lane.
#
# Filings before READ_FROM that were never read are recorded `skipped`,
# 'not analysed: …' (owner, 2026-10-09: "mark Aug for not to analyse") —
# except routine ones, whose verdict is free and is written like any other.
ROUTINE_TYPES = tuple(t.strip().upper() for t in os.getenv('FILING_READ_ROUTINE_TYPES', '').split(',')
                      if t.strip()) or (
    'RECORD_DATE', 'ESOP', 'ALLOTMENT', 'AUTHORISED_CAPITAL', 'AGM_EGM', 'TRADING_WINDOW',
    'NEWSPAPER', 'COMMITTEE', 'CORRIGENDUM')
ROUTINE_DESCS = (
    'Certificate under SEBI (Depositories and Participants) Regulations, 2018',
    'Structural Digital Database', 'Addendum', 'Change in Company Secretary/Compliance Officer',
    'Extension of Annual General Meeting')
HIGH_DESCS = (
    'Outcome of Board Meeting', 'Press Release', 'Investor Presentation', 'Monthly Business Updates',
    'Credit Rating', 'Credit Rating- Revision', 'Credit Rating- New', 'Credit Rating- Others',
    'Reply to Clarification- Financial results', 'Disclosure of material issue', 'Agreements',
    'Commencement of commercial production/operations', 'Awarding of order(s)/contract(s)',
    'Sale or disposal', 'Product launch', 'Capacity addition',
    'Granting/withdrawal/surrender/cancellation/suspension of key licenses/ regulatory approvals',
    'Dividend', 'Scheme of Arrangement', 'Rumour Verification - Regulation 30(11)',
    'Giving guarantees/indemnity/ becoming a surety for third party')
LOW_TYPES = ('MGMT_CHANGE',)
TIERS = ('high', 'low', 'routine')
READ_FROM = (os.getenv('FILING_READ_FROM') or '2026-09-01').strip()

# One line per routine label: why the label alone settles it. Keyed by
# event_type, else by the exchange's desc. ROUTINE_FALLBACK covers an
# override type with no line of its own.
ROUTINE_REASONS = {
    'RECORD_DATE': 'Sets the record date for an action announced separately. The substance is in that announcement.',
    'ESOP': 'Grant or allotment of employee stock options. A routine compensation step.',
    'ALLOTMENT': 'Allotment of securities already approved. The decision to raise was filed separately.',
    'AUTHORISED_CAPITAL': 'Raises the ceiling on shares the company may issue. Enabling headroom, not an issue.',
    'AGM_EGM': 'Notice or proceedings of a shareholders\' meeting. Resolutions that change the business are filed separately.',
    'TRADING_WINDOW': 'Insiders barred from trading ahead of results. A compliance notice that says nothing about the business.',
    'NEWSPAPER': 'Copy of a newspaper advertisement of an earlier filing. The substance is in that filing.',
    'COMMITTEE': 'Update from a board committee meeting. Procedural.',
    'CORRIGENDUM': 'Correction to an earlier filing. Read the corrected filing.',
    'Certificate under SEBI (Depositories and Participants) Regulations, 2018':
        'Quarterly confirmation from the share registrar that demat requests were processed. Compliance only.',
    'Structural Digital Database': 'Confirms the insider-information database is maintained. Compliance only.',
    'Addendum': 'Addition to an earlier filing. Read the filing it amends.',
    'Change in Company Secretary/Compliance Officer': 'Change of the compliance officer. An administrative role.',
    'Extension of Annual General Meeting': 'Permission to hold the AGM later. Procedural.',
}
ROUTINE_FALLBACK = 'A procedural filing by its exchange label. Nothing about the business.'
MIN_MCAP_CR = float(os.getenv('FILING_READ_MIN_MCAP_CR', '100'))
KEY_PERSON_TYPES = ('MGMT_CHANGE', 'MGMT_EXIT')

_KEY_ROLE = (r'(?:chief\s+(?:executive|financial|operating)\s+officer|\bCEO\b|\bCFO\b|\bCOO\b|'
             r'managing\s+director|\bMD\b|whole[-\s]time\s+director|'
             r'(?<!non-)(?<!non\s)executive\s+director|chairman|chairperson|promoter)')
_MGMT_ACTION = (r'(?:resign\w*|appoint\w*|cessation|ceas\w*|retire\w*|step\w*\s+down|elevat\w*|'
                r're-?designat\w*|promot\w*|demise|pass\w*\s+away|vacat\w*)')
# A key role and a management action in the SAME sentence ([^.] — never
# across a full stop), in either order:
#   "Mr Y, Whole-time Director, has resigned"        role … action
#   "resignation of Mr X, Chief Financial Officer"   action of/as/to … role
# Same-sentence is what keeps a signature block ("For ABC Ltd, Managing
# Director.") and "resignation of Mr X, Independent Director" from passing.
# Honorific full stops (Mr./Dr./Shri.) are stripped first so they do not end
# the sentence early.
KEY_PERSON_RE = re.compile(
    rf'{_KEY_ROLE}[^.]{{0,80}}?\b{_MGMT_ACTION}'
    rf'|{_MGMT_ACTION}\s+(?:of|as|to)\s+[^.]{{0,80}}?{_KEY_ROLE}',
    re.IGNORECASE | re.DOTALL)
_HONORIFIC_DOT = re.compile(r'\b(Mr|Mrs|Ms|Dr|Shri|Smt|Prof|Sri|Sh)\.', re.IGNORECASE)
AUDITOR_EVENT_RE = re.compile(r'resign|casual\s+vacancy|withdr\w*|ceas\w*\s+to|remov\w*|qualif\w*\s+opinion|disclaim',
                              re.IGNORECASE)

_TIER_SQL = """
        CASE
          WHEN coalesce(e.event_type, '') = ANY(%(routine_types)s)
            OR coalesce(e.desc_raw, '') = ANY(%(routine_descs)s) THEN 'routine'
          WHEN NOT EXISTS (SELECT 1 FROM km_equity_symbols s
                            WHERE s.isin = e.isin AND s.exchange = 'NSE' AND s.is_active
                              AND s.mcap_cr >= %(min_mcap)s) THEN 'low'
          WHEN (e.family = ANY(%(families)s) AND e.event_type IS NOT NULL
                AND NOT (e.event_type = ANY(%(low_types)s)))
            OR coalesce(e.desc_raw, '') = ANY(%(high_descs)s) THEN 'high'
          ELSE 'low'
        END
"""


def _tier_params() -> dict:
    return {'families': list(MATERIAL_FAMILIES), 'routine_types': list(ROUTINE_TYPES),
            'routine_descs': list(ROUTINE_DESCS), 'high_descs': list(HIGH_DESCS),
            'low_types': list(LOW_TYPES), 'min_mcap': MIN_MCAP_CR}


def routine_reason(event_type: Optional[str], desc_raw: Optional[str]) -> str:
    return ROUTINE_REASONS.get(event_type or '') or ROUTINE_REASONS.get(desc_raw or '') or ROUTINE_FALLBACK


def triage(row: dict, doc: 'DocumentText') -> Optional[str]:
    """Gate 1. The reason NOT to pay for a read of this document, or None.
    Pure: no I/O, so it is testable on a dict and a DocumentText."""
    et = row.get('event_type') or ''
    if et in KEY_PERSON_TYPES:
        if doc.needs_pdf:
            return 'scanned document on a routine-by-default type'
        if not KEY_PERSON_RE.search(_HONORIFIC_DOT.sub(r'\1', doc.text or '')):
            return 'management change with no key person named'
    elif et == 'AUDITOR_CHANGE':
        if doc.needs_pdf:
            return 'scanned document on a routine-by-default type'
        if not AUDITOR_EVENT_RE.search(doc.text or ''):
            return 'auditor change is a term completion or appointment, not a resignation'
    return None


# ── the verdict ──────────────────────────────────────────────────────────

class FilingVerdict(BaseModel):
    """What the model returns. Validated before it reaches the DB.

    Owner, 2026-10-01: the model gives the DIRECTION and an explanation —
    nothing it would have to calculate. A Groq read turned "USD 1.2 billion"
    into "INR 100,000 crore" (ten times too much) and then called the order
    "over twice the market cap". So there is no magnitude, no amount field, no
    ratio: numbers appear only as the filing wrote them, in the quote."""
    impact: str = Field(description="positive | negative | neutral | unclear — impact on the COMPANY as the filing states it")
    headline: str = Field(description="One line: what happened, in plain words. Numbers exactly as written in the filing")
    reasoning: str = Field(description="Two or three sentences: why this impact. Numbers exactly as written; no conversions, no percentages, no comparisons")
    evidence_quote: str = Field(description="The sentence or sentences from the document, verbatim, that the verdict rests on")
    confidence: float = Field(description="0 to 1")
    role: Optional[str] = Field(default=None, description="acquirer | target | promoter | non_promoter | new_client | repeat_client")
    # Reader v2 (migration 238; owner, 2026-10-09: "can we also know why they
    # are +ve or -ve … how will it help the users take decision"). All four
    # come FROM the filing — a word or the filing's own phrase, never a number
    # the model worked out. Defaults so an older or smaller model that omits
    # one still yields a valid verdict; the default says "not stated".
    touches: str = Field(default='other', description=(
        "Which part of the business this touches, ONE of: orders | earnings | costs_margins | capacity | "
        "funding_debt | ownership_control | management | legal_regulatory | shareholder_payout | other | none"))
    company_view: str = Field(default='Not stated', description=(
        "What the COMPANY itself says about the impact, in its own words (e.g. 'no material impact on operations'). "
        "'Not stated' if it says nothing"))
    timeframe: str = Field(default='Not stated', description=(
        "When the filing says the effect lands, in its own words (e.g. 'executed over 24 months', "
        "'effective 31 December 2026'). 'Not stated' if it says nothing"))
    watch_next: str = Field(default='Nothing stated', description=(
        "The next step the filing itself names — a date, a hearing, an approval, a signing. "
        "'Nothing stated' if it names none. Never your own suggestion"))

    @field_validator('touches', 'company_view', 'timeframe', 'watch_next', mode='before')
    @classmethod
    def _null_is_not_stated(cls, v, info):
        # A model that answers null (hosted lanes do) means "not stated", not
        # an invalid verdict — the rest of the read is still good.
        if v is None or (isinstance(v, str) and not v.strip()):
            return cls.model_fields[info.field_name].default
        return v


IMPACTS = ('positive', 'negative', 'neutral', 'unclear')
TOUCHES = ('orders', 'earnings', 'costs_margins', 'capacity', 'funding_debt', 'ownership_control',
           'management', 'legal_regulatory', 'shareholder_payout', 'other', 'none')
MAGNITUDES = ('major', 'notable', 'minor', 'unknown')

SYSTEM_PROMPT = """You read ONE filing made by a company listed on the National Stock Exchange of India and report what it means for that company.

Your verdict is the impact on the COMPANY — its business, finances, ownership or governance — AS THE DOCUMENT STATES IT. It is NOT a forecast of the share price, NOT a view on whether the stock is attractive, and NEVER advice to buy, sell, hold or trade. Do not use the words bullish or bearish.

Rules:
1. Read the whole document before deciding. Filings are often formal letters; the substance may sit in an annexure or a table.
2. impact: positive if the filing states something that strengthens the company (an order won, an acquisition that adds capacity or revenue, a credit-rating upgrade, a promoter buying); negative if it weakens it (an order cancelled, a regulatory action, a rating downgrade, insolvency, an auditor resigning over concerns, a key person leaving under a cloud); neutral for routine and procedural filings (ESOP allotments, record dates, scheduled appointments, formal compliance); unclear when the document genuinely does not say.
3. NO ARITHMETIC. Write every number exactly as the filing writes it, in its own currency and unit ("USD 1.2 billion" stays "USD 1.2 billion", "Rs 45.6 crore" stays "Rs 45.6 crore"). Never convert currencies or units, never compute a percentage, a ratio or a total, and never compare an amount with the company's size, revenue or market value.
4. role: say which side the company is on. "Acquisition" can mean the company is buying or being bought. An order can be from a new client or a repeat client. A stake change can be by a promoter or an outsider.
5. evidence_quote must be VERBATIM from the document — the sentence(s) the verdict rests on. Never paraphrase inside the quote.
6. Do not judge how big the impact is. Say whether it is positive or negative and why, in the filing's own terms.
7. If the document is unreadable, empty, or is not the filing the context describes, say impact unclear, confidence 0, and explain in reasoning.
8. Be specific and short. The headline is one line a reader scans.
9. touches: pick the ONE part of the business the filing is about from the list. company_view, timeframe and watch_next are what the FILING says, in its own words — if it does not say, write exactly 'Not stated' (or 'Nothing stated' for watch_next). Never fill them with your own expectation or advice.
10. For financial results: state what the filing reports for the period and the comparison period, numbers exactly as written. If the filing gives a growth figure, quote it; if it does not, do not work one out."""


def _api_key() -> str:
    """ANTHROPIC_API_KEY, else AI_API_KEY when it is an Anthropic key — the
    same pair lib/ai_client.py accepts, so one .env line serves both."""
    key = os.getenv('ANTHROPIC_API_KEY') or ''
    if not key:
        alt = os.getenv('AI_API_KEY') or ''
        if alt.startswith('sk-ant'):
            key = alt
    return key


def _client():
    """The client for the configured backend. anthropic: the official SDK,
    honouring ANTHROPIC_BASE_URL from the environment (the SDK reads it
    itself). local: LocalClient over the OpenAI-compatible server."""
    if BACKEND == 'local':
        return LocalClient(LOCAL_URL, LOCAL_MODEL, LOCAL_CTX_TOKENS, LOCAL_MAX_TOKENS, LOCAL_TIMEOUT_SEC,
                           api_key=LOCAL_KEY)
    import anthropic
    return anthropic.Anthropic(api_key=_api_key())


# ── priority lanes (lib/llm_lanes.py) ────────────────────────────────────
# On the local backend a filing disseminated in the last FILING_READ_HIGH_DAYS
# days is HIGH priority and goes down LLM_ROUTE_HIGH (a free hosted model
# first, when one is declared); older ones are MEDIUM and stay on Qwen. With
# no LLM_* settings every route is Qwen — the behaviour before lanes.
HIGH_DAYS = float(os.getenv('FILING_READ_HIGH_DAYS') or '2')   # compose passes '' when unset
_lane_clients: dict = {}


def priority_of(row: dict) -> str:
    """The lane: a low-tier row always goes LOW (Qwen by default), so the
    free hosted quotas are spent on high-tier filings."""
    if row.get('tier') == 'low':
        return 'low'
    when = row.get('disseminated_at')
    if when is None:
        return 'medium'
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    age_days = (datetime.now(timezone.utc) - when).total_seconds() / 86400
    return 'high' if age_days <= HIGH_DAYS else 'medium'


def local_client() -> 'LocalClient':
    return LocalClient(LOCAL_URL, LOCAL_MODEL, LOCAL_CTX_TOKENS, LOCAL_MAX_TOKENS, LOCAL_TIMEOUT_SEC,
                       api_key=LOCAL_KEY)


def lane_client(priority: str):
    names = tuple(llm_lanes.route(priority))
    if names not in _lane_clients:
        _lane_clients[names] = llm_lanes.RoutedClient(list(names), local_client, LOCAL_MAX_TOKENS,
                                                      LOCAL_CTX_TOKENS)
    return _lane_clients[names]


def client_for(row: dict):
    """The client this row should be read with: its priority lane on the
    local backend, the configured client otherwise."""
    if BACKEND == 'local':
        return lane_client(priority_of(row))
    return _client()


def has_api_key() -> bool:
    return bool(_api_key())


def backend_missing() -> Optional[str]:
    """Why the configured backend cannot run, or None. The reader never
    claims a row it cannot read: rows stay pending, the pass completes."""
    if BACKEND == 'anthropic':
        return None if _api_key() else 'ANTHROPIC_API_KEY not set'
    if BACKEND == 'local':
        return None if LOCAL_URL else 'FILING_READ_LOCAL_URL / LLM_BASE_URL / AI_BASE_URL not set'
    return f'FILING_READ_BACKEND={BACKEND!r} is not anthropic or local'


def _cost(model: str, inp: int, out: int) -> Optional[float]:
    if model.startswith('local:'):
        return 0.0
    if ':' in model and model.split(':', 1)[0] in llm_lanes.provider_names():
        return 0.0                       # a free hosted lane (groq:…, openrouter:…)
    p = PRICES.get(model)
    if not p:
        return None
    return round(inp * p[0] / 1e6 + out * p[1] / 1e6, 5)


# ── the local backend ────────────────────────────────────────────────────

class LocalUnsupported(Exception):
    """The local backend was handed something it cannot read (a PDF as images)."""


_THINK_RE = re.compile(r'<think>.*?</think>\s*', re.DOTALL)


def _schema_instruction(schema: dict) -> str:
    """The verdict's fields, as a small model needs to see them: the grammar
    enforces the SHAPE, this tells it what each field MEANS."""
    props = schema.get('properties', {})
    lines = ['Return ONLY a JSON object with these fields, no prose before or after it:']
    for name, spec in props.items():
        desc = spec.get('description') or ''
        lines.append(f'  {name}: {desc}' if desc else f'  {name}')
    return '\n'.join(lines)


class _LocalResp:
    __slots__ = ('parsed_output', 'usage', 'model')

    def __init__(self, parsed, inp, out, model):
        self.parsed_output = parsed
        self.usage = _Usage(inp, out)
        self.model = model


class _Usage:
    __slots__ = ('input_tokens', 'output_tokens')

    def __init__(self, inp, out):
        self.input_tokens, self.output_tokens = inp, out


class _LocalMessages:
    def __init__(self, base_url, model, ctx_tokens, max_tokens, timeout_sec, post=None, api_key=''):
        self.base_url, self.model, self.api_key = base_url, model, api_key or ''
        self.ctx_tokens, self.max_tokens, self.timeout_sec = ctx_tokens, max_tokens, timeout_sec
        if post is None:
            import requests
            post = requests.post
        self._post = post

    def parse(self, *, model=None, max_tokens=None, system, messages, output_format):
        blocks = messages[0]['content']
        if any(b.get('type') == 'document' for b in blocks):
            raise LocalUnsupported('the local backend reads text only; a scanned document needs OCR')
        user = '\n'.join(b['text'] for b in blocks if b.get('type') == 'text')
        schema = output_format.model_json_schema()
        body = {
            'model': self.model,
            'messages': [
                # /no_think + enable_thinking=false: both conventions, so the
                # 4B model spends its tokens on the verdict, not a monologue.
                {'role': 'system', 'content': '/no_think\n' + system + '\n\n' + _schema_instruction(schema)},
                {'role': 'user', 'content': user},
            ],
            'max_tokens': self.max_tokens,
            'temperature': 0,
            'response_format': {'type': 'json_schema',
                                'json_schema': {'name': output_format.__name__, 'schema': schema, 'strict': True}},
            'chat_template_kwargs': {'enable_thinking': False},
        }
        headers = {'Content-Type': 'application/json'}
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        resp = self._post(f'{self.base_url}/chat/completions', json=body, headers=headers, timeout=self.timeout_sec)
        resp.raise_for_status()
        data = resp.json()
        content = (data.get('choices') or [{}])[0].get('message', {}).get('content') or ''
        content = _THINK_RE.sub('', content).strip()
        if content.startswith('```'):
            content = content.strip('`').split('\n', 1)[-1].rsplit('```', 1)[0]
        parsed = output_format.model_validate_json(content)
        usage = data.get('usage') or {}
        return _LocalResp(parsed, int(usage.get('prompt_tokens') or 0),
                          int(usage.get('completion_tokens') or 0), data.get('model') or self.model)


class LocalClient:
    """Same surface as the SDK client for what read_one uses: `.messages.parse`."""

    def __init__(self, base_url, model, ctx_tokens=LOCAL_CTX_TOKENS, max_tokens=LOCAL_MAX_TOKENS,
                 timeout_sec=LOCAL_TIMEOUT_SEC, post=None, api_key=''):
        self.messages = _LocalMessages(base_url, model, ctx_tokens, max_tokens, timeout_sec,
                                       post=post, api_key=api_key)


def local_doc_char_budget(ctx_tokens: int = None, max_tokens: int = None) -> int:
    """How many document characters fit beside the prompt and the reply."""
    ctx = LOCAL_CTX_TOKENS if ctx_tokens is None else ctx_tokens
    reply = LOCAL_MAX_TOKENS if max_tokens is None else max_tokens
    return max(int((ctx - reply - LOCAL_PROMPT_RESERVE_TOKENS) * CHARS_PER_TOKEN), 2000)


# ── the document ─────────────────────────────────────────────────────────

class DocumentText:
    __slots__ = ('text', 'page_count', 'pages_read', 'chars_per_page', 'needs_pdf', 'pages', 'source')

    def __init__(self, text, page_count, pages_read, chars_per_page, needs_pdf, pages=None, source='text'):
        self.text, self.page_count, self.pages_read = text, page_count, pages_read
        self.chars_per_page, self.needs_pdf = chars_per_page, needs_pdf
        self.pages = list(pages) if pages is not None else ([text] if text else [])
        self.source = source            # 'text' (pypdf layer) | 'ocr' (Tesseract)


def _from_pages(parts: list, page_count: int, source: str) -> DocumentText:
    # A NUL byte in a PDF's text layer is legal in the PDF and illegal in a
    # PostgreSQL text column: storing it crashed the read (2 rows, Oct 2026).
    parts = [(p or '').replace('\x00', '') for p in parts]
    pages_read = len(parts)
    text = '\n\n'.join(p.strip() for p in parts).strip()
    cpp = (len(text) / pages_read) if pages_read else 0.0
    return DocumentText(text, page_count, pages_read, cpp, cpp < CHARS_PER_PAGE_FLOOR, pages=parts, source=source)


def fit_to_chars(doc: DocumentText, max_chars: int) -> DocumentText:
    """The document trimmed to WHOLE pages that fit a character budget (the
    local backend's context window). Never fewer than one page; a first page
    alone over the budget is cut hard. pages_read records the trim, so a
    partial read is visible on the row the same way the page cap is."""
    if len(doc.text or '') <= max_chars:
        return doc
    kept, total = [], 0
    for p in doc.pages:
        if kept and total + len(p) + 2 > max_chars:
            break
        kept.append(p)
        total += len(p) + 2
    if not kept:
        return doc
    if len(kept) == 1 and len(kept[0]) > max_chars:
        kept = [kept[0][:max_chars]]
        log.warning('local backend: first page alone exceeds the context budget; cut hard')
    out = _from_pages(kept, doc.page_count, doc.source)
    out.needs_pdf = doc.needs_pdf
    return out


def unwrap_document(data: bytes) -> bytes:
    """NSE ships some filings (KMP resignations, SAST) as a .zip holding the
    PDF beside its XBRL — 30 of the first 31 "unreadable" rows, and 279 of
    the pending MGMT_EXIT queue. Open it and take the PDF; anything else
    passes through untouched for the %PDF check."""
    if data[:4] != b'PK\x03\x04':
        return data
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        pdfs = [i for i in z.infolist()
                if i.filename.lower().endswith('.pdf') and not i.filename.startswith('__MACOSX')]
        if not pdfs:
            raise ValueError('zip with no PDF inside')
        pdfs.sort(key=lambda i: -i.file_size)          # the document, not a cover letter
        return z.read(pdfs[0])


def extract_text(pdf_bytes: bytes, max_pages: Optional[int] = None) -> DocumentText:
    """Text layer via pypdf. `needs_pdf` when the layer is too thin to be
    real — the Sprint 3 chars-per-page gate."""
    from pypdf import PdfReader
    if max_pages is None:
        max_pages = MAX_PAGES
    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_count = len(reader.pages)
    pages_read = min(page_count, max_pages)
    parts = []
    for i in range(pages_read):
        try:
            parts.append(reader.pages[i].extract_text() or '')
        except Exception as e:                       # one bad page is not a bad document
            log.warning(f'page {i + 1}: extract failed: {e}')
            parts.append('')
    return _from_pages(parts, page_count, 'text')


def pdfium_text(pdf_bytes: bytes, max_pages: Optional[int] = None) -> DocumentText:
    """The text layer through pdfium, for a file pypdf cannot parse. Same
    shape and the same chars-per-page gate as extract_text."""
    import pypdfium2 as pdfium
    if max_pages is None:
        max_pages = MAX_PAGES
    pdf = pdfium.PdfDocument(pdf_bytes)
    page_count = len(pdf)
    parts = []
    for i in range(min(page_count, max_pages)):
        try:
            parts.append(pdf[i].get_textpage().get_text_range() or '')
        except Exception as e:
            log.warning(f'pdfium page {i + 1}: {e}')
            parts.append('')
    return _from_pages(parts, page_count, 'text')


# ── OCR — a Python library, not a vision model ───────────────────────────

_OCR_STATE: Optional[bool] = None


def ocr_available() -> bool:
    """Tesseract + pypdfium2 present. Checked once; the answer does not change
    inside a process. Tests patch this."""
    global _OCR_STATE
    if _OCR_STATE is None:
        try:
            import pypdfium2
            import pytesseract
            if not hasattr(pypdfium2, 'PdfDocument'):
                raise ImportError('pypdfium2 without PdfDocument')
            pytesseract.get_tesseract_version()
            _OCR_STATE = True
        except Exception as e:
            log.info(f'OCR unavailable ({e}); scanned documents go to the model as PDF or are unreadable')
            _OCR_STATE = False
    return _OCR_STATE


OCR_DPI = int(os.getenv('FILING_READ_OCR_DPI', '200'))


def ocr_text(pdf_bytes: bytes, max_pages: Optional[int] = None) -> DocumentText:
    """The scanned pages rendered by pypdfium2 and read by Tesseract. Same
    shape and the same chars-per-page gate as the text layer, so a blank
    scan still reports needs_pdf."""
    import pypdfium2 as pdfium
    import pytesseract
    if max_pages is None:
        max_pages = MAX_PAGES
    pdf = pdfium.PdfDocument(pdf_bytes)
    page_count = len(pdf)
    parts = []
    for i in range(min(page_count, max_pages)):
        try:
            img = pdf[i].render(scale=OCR_DPI / 72).to_pil()
            parts.append(pytesseract.image_to_string(img) or '')
        except Exception as e:
            log.warning(f'ocr page {i + 1}: {e}')
            parts.append('')
    return _from_pages(parts, page_count, 'ocr')


def _pdf_first_pages(pdf_bytes: bytes, max_pages: int) -> bytes:
    """The PDF trimmed to its first `max_pages` pages, for the scanned path."""
    from pypdf import PdfReader, PdfWriter
    reader = PdfReader(io.BytesIO(pdf_bytes))
    if len(reader.pages) <= max_pages:
        return pdf_bytes
    writer = PdfWriter()
    for i in range(max_pages):
        writer.add_page(reader.pages[i])
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def fetch_document(session, url: str) -> bytes:
    """The filing PDF, through the shared NSE session (cookies, retries)."""
    resp = session.get(url, referer='https://www.nseindia.com/companies-listing/corporate-filings-announcements')
    return resp.content


# ── the prompt ───────────────────────────────────────────────────────────

def build_context(row: dict) -> str:
    lines = [
        f"Company: {row.get('company_name') or '?'} (NSE symbol {row.get('symbol') or '?'})",
        f"NSE filing category: {row.get('desc_raw') or '?'}",
        f"Our category: {row.get('family')} / {row.get('event_type') or '?'}",
        f"Disseminated: {row.get('disseminated_at')}",
    ]
    if row.get('industry'):
        lines.append(f"Industry: {row['industry']}")
    if row.get('is_result_announcement'):
        lines.append("This is a financial results announcement.")
    if row.get('summary_text'):
        lines.append(f"Exchange summary: {row['summary_text']}")
    return '\n'.join(lines)


def build_messages(row: dict, doc: DocumentText, pdf_bytes: Optional[bytes]) -> list:
    context = build_context(row)
    ask = ("Read the filing below and return the verdict.\n\n"
           f"CONTEXT\n{context}\n\n")
    if doc.needs_pdf and pdf_bytes is not None:
        content = [
            {'type': 'text', 'text': ask + "The document is attached (scanned pages; read them as images)."},
            {'type': 'document',
             'source': {'type': 'base64', 'media_type': 'application/pdf',
                        'data': base64.standard_b64encode(pdf_bytes).decode('ascii')}},
        ]
    else:
        content = [{'type': 'text', 'text': ask + "DOCUMENT\n" + doc.text}]
    return [{'role': 'user', 'content': content}]


# ── the queue ────────────────────────────────────────────────────────────

def enqueue_pending(conn, since=None) -> int:
    """A row for every filing with none yet, carrying its tier. Idempotent.
    Before READ_FROM a non-routine filing is recorded `skipped`, 'not
    analysed' — never read, and countable as such."""
    params = dict(_tier_params(), since=since, read_from=READ_FROM)
    with conn.cursor() as cur:
        cur.execute(f"""
            INSERT INTO km_filing_reads (event_id, tier, status, triage_reason, finished_at)
            SELECT x.id, x.tier,
                   CASE WHEN x.old THEN 'skipped' ELSE 'pending' END,
                   CASE WHEN x.old THEN 'not analysed: filed before ' || %(read_from)s END,
                   CASE WHEN x.old THEN now() END
              FROM (SELECT e.id, t.tier,
                           (t.tier <> 'routine' AND e.disseminated_at < %(read_from)s::date) AS old
                      FROM km_corporate_events e
                      CROSS JOIN LATERAL (SELECT {_TIER_SQL} AS tier) t
                     WHERE (%(since)s::timestamptz IS NULL OR e.disseminated_at >= %(since)s::timestamptz)
                   ) x
            ON CONFLICT (event_id) DO NOTHING
        """, params)
        n = cur.rowcount
    conn.commit()
    return n


def retier_pending(conn) -> int:
    """A PENDING row whose tier changed since it was queued (a taxonomy
    re-classification, a listing crossing the mcap floor) moves to its
    current tier. Only `pending`: a verdict already written is a record."""
    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE km_filing_reads r
               SET tier = t.tier
              FROM km_corporate_events e
              CROSS JOIN LATERAL (SELECT {_TIER_SQL} AS tier) t
             WHERE e.id = r.event_id AND r.status = 'pending' AND r.tier <> t.tier
        """, _tier_params())
        n = cur.rowcount
    conn.commit()
    return n


def settle_routine(conn) -> int:
    """Write the verdict of every pending ROUTINE row: no model call. The
    label settles it, the reasoning says why for that label, read_source
    'rule' and model 'rule' say how — so it is never mistaken for a read."""
    keys = list(ROUTINE_REASONS)
    case = ' '.join("WHEN coalesce(e.event_type, '') = %s OR coalesce(e.desc_raw, '') = %s THEN %s"
                    for _ in keys)
    params = []
    for k in keys:
        params += [k, k, ROUTINE_REASONS[k]]
    params += [ROUTINE_FALLBACK, READER_VERSION]
    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE km_filing_reads r
               SET status = 'done', finished_at = now(), impact = 'neutral',
                   headline = e.desc_raw,
                   reasoning = CASE {case} ELSE %s END,
                   touches = 'none', company_view = 'Not stated', timeframe = 'Not stated',
                   watch_next = 'Nothing stated',
                   model = 'rule', reader_version = %s, read_source = 'rule',
                   cost_usd = 0, input_tokens = 0, output_tokens = 0
              FROM km_corporate_events e
             WHERE e.id = r.event_id AND r.tier = 'routine' AND r.status = 'pending'
        """, params)
        n = cur.rowcount
    conn.commit()
    return n


def prepare_queue(conn, since=None) -> dict:
    """The queue step of every pass: enqueue new filings, move pending rows
    to their current tier, settle the routine ones. Does nothing before
    migration 238 is applied (the columns it writes would not exist)."""
    missing = schema_missing(conn)
    if missing:
        log.error(f'[filing_reader] {missing} — queue not prepared')
        return {'queued': 0, 'retiered': 0, 'routine': 0, 'skipped': missing}
    return {'queued': enqueue_pending(conn, since=since), 'retiered': retier_pending(conn),
            'routine': settle_routine(conn), 'skipped': None}


STATUSES = ('pending', 'reading', 'done', 'failed', 'unreadable', 'skipped')

# Columns a pass WRITES that a later migration added. Checked before a row is
# claimed: on 2026-09-28 the backend shipped ahead of migration 230 and the
# first gate-1 skip crashed the whole backfill mid-row (the row stuck in
# `reading`). A missing column is the same honest state as a missing API key
# — nothing claimed, rows stay pending, the pass completes and says why.
REQUIRED_COLUMNS = {'triage_reason': 'migration 230', 'tier': 'migration 238', 'watch_next': 'migration 238'}


def schema_missing(conn) -> Optional[str]:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
             WHERE table_name = 'km_filing_reads' AND column_name = ANY(%s)
        """, (list(REQUIRED_COLUMNS),))
        have = {r[0] for r in cur.fetchall()}
    conn.rollback()
    missing = [f'{c} ({m})' for c, m in REQUIRED_COLUMNS.items() if c not in have]
    return f'km_filing_reads lacks {", ".join(missing)} — apply it first' if missing else None


def status_counts(conn) -> dict:
    with conn.cursor() as cur:
        cur.execute('SELECT status, count(*) FROM km_filing_reads GROUP BY status')
        rows = dict(cur.fetchall())
    conn.rollback()
    return {k: int(rows.get(k, 0)) for k in STATUSES}


def _claim_next(conn, retry_failed: bool = True, pass_started=None,
                newer_than_days: Optional[float] = None, tier: Optional[str] = None,
                since=None) -> Optional[dict]:
    """The next filing to read, moved to `reading` atomically: high tier
    before low, newest first within a tier. Pending, or failed under the
    attempt cap BEFORE this pass began — a row that fails inside a pass is
    the NEXT pass's retry, never an in-pass loop. One at a time, on purpose.
    `tier` restricts to one tier, `since` to filings on or after a date;
    routine rows are never claimed (settle_routine writes them)."""
    with conn.cursor() as cur:
        cur.execute("""
            WITH cand AS (
                SELECT r.id FROM km_filing_reads r
                  JOIN km_corporate_events e ON e.id = r.event_id
                 WHERE (r.status = 'pending'
                    OR (%s AND r.status = 'failed' AND r.attempts < %s
                        AND (%s::timestamptz IS NULL OR r.finished_at < %s::timestamptz)))
                   AND r.tier <> 'routine'
                   AND (%s::text IS NULL OR r.tier = %s::text)
                   AND (%s::timestamptz IS NULL OR e.disseminated_at >= %s::timestamptz)
                   AND (%s::float8 IS NULL
                        OR e.disseminated_at >= now() - make_interval(secs => %s::float8 * 86400))
                 ORDER BY (r.tier = 'high') DESC, e.disseminated_at DESC, r.id DESC
                 LIMIT 1
                 FOR UPDATE OF r SKIP LOCKED
            )
            UPDATE km_filing_reads r
               SET status = 'reading', started_at = now(), attempts = r.attempts + 1
              FROM cand
             WHERE r.id = cand.id
            RETURNING r.id, r.event_id, r.attempts, r.tier
        """, (retry_failed, MAX_ATTEMPTS, pass_started, pass_started, tier, tier, since, since,
              newer_than_days, newer_than_days))
        row = cur.fetchone()
    conn.commit()
    if not row:
        return None
    read_id, event_id, attempts, row_tier = row
    d = load_event_row(conn, event_id)
    d['read_id'], d['attempts'], d['tier'] = read_id, attempts, row_tier
    return d


def load_event_row(conn, event_id: int) -> dict:
    """The context a read is built from: the event, its primary raw filing
    (url, exchange summary, stored text) and the NSE listing."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT e.id AS event_id, e.company_name, e.desc_raw, e.family, e.event_type,
                   e.disseminated_at, e.isin, e.is_result_announcement,
                   r.id AS raw_id, r.doc_url, r.summary_text, r.raw_text, r.extract_status,
                   r.page_count AS raw_page_count,
                   s.symbol, s.industry, s.mcap_cr
              FROM km_corporate_events e
              JOIN km_filings_raw r ON r.id = e.primary_raw_id
              LEFT JOIN LATERAL (
                    SELECT symbol, industry, mcap_cr FROM km_equity_symbols
                     WHERE isin = e.isin AND exchange = 'NSE' AND is_active
                     ORDER BY id LIMIT 1) s ON TRUE
             WHERE e.id = %s
        """, (event_id,))
        cols = [d[0] for d in cur.description]
        vals = cur.fetchone()
    conn.rollback()
    return dict(zip(cols, vals))


def _finish(conn, read_id: int, status: str, error: Optional[str] = None, **fields) -> None:
    sets = ['status = %s', 'finished_at = now()', 'last_error = %s']
    params = [status, (error or '')[:500] or None]
    for k, v in fields.items():
        sets.append(f'{k} = %s')
        params.append(v)
    params.append(read_id)
    with conn.cursor() as cur:
        cur.execute(f"UPDATE km_filing_reads SET {', '.join(sets)} WHERE id = %s", params)
    conn.commit()


def _store_text(conn, raw_id: int, doc: DocumentText) -> None:
    """The extracted text on km_filings_raw (212's columns), never the PDF."""
    status = 'needs_ocr' if doc.needs_pdf else 'ok'
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE km_filings_raw
               SET raw_text = %s, page_count = %s, char_count = %s,
                   extract_status = %s, extracted_at = now()
             WHERE id = %s
        """, (doc.text or None, doc.page_count, len(doc.text or ''), status, raw_id))
    conn.commit()


def read_one(conn, row: dict, client, session, model: str = MODEL, backend: str = None) -> str:
    """Fetch, extract, read, write. Returns the final status."""
    if backend is None:
        backend = 'local' if isinstance(client, (LocalClient, llm_lanes.RoutedClient)) else BACKEND
    read_id = row['read_id']
    url = (row.get('doc_url') or '').strip()
    if not url:
        _finish(conn, read_id, 'unreadable', 'no document url')
        return 'unreadable'

    try:
        pdf_bytes = fetch_document(session, url)
    except Exception as e:
        # A dead exchange link is terminal once the retries are spent;
        # anything else is the next pass's problem.
        terminal = row['attempts'] >= MAX_ATTEMPTS
        _finish(conn, read_id, 'unreadable' if terminal else 'failed', f'fetch: {e}')
        return 'unreadable' if terminal else 'failed'

    try:
        pdf_bytes = unwrap_document(pdf_bytes)
    except Exception as e:
        _finish(conn, read_id, 'unreadable', f'document is a zip: {e}')
        return 'unreadable'
    if not pdf_bytes[:5].startswith(b'%PDF'):
        _finish(conn, read_id, 'unreadable', 'document is not a PDF')
        return 'unreadable'

    try:
        doc = extract_text(pdf_bytes)
    except Exception as e:
        # pypdf refuses some slightly broken files ("Invalid object in
        # /Pages", 6 rows) that pdfium — the renderer the OCR path already
        # uses — opens fine. Retrying pypdf five times never helped.
        try:
            doc = pdfium_text(pdf_bytes)
        except Exception as e2:
            _finish(conn, read_id, 'failed', f'extract: {e}; pdfium: {e2}')
            return 'failed'
    if doc.needs_pdf and ocr_available():
        try:
            ocr = ocr_text(pdf_bytes)
        except Exception as e:
            log.warning(f'ocr failed on read {read_id}: {e}')
        else:
            if not ocr.needs_pdf:           # a blank scan stays a scan
                doc = ocr
    _store_text(conn, row['raw_id'], doc)

    # Gate 1: the text is free, the model is not.
    reason = triage(row, doc)
    read_source = 'pdf' if doc.needs_pdf else doc.source
    if reason:
        _finish(conn, read_id, 'skipped', None, triage_reason=reason, read_source=read_source,
                page_count=doc.page_count, pages_read=doc.pages_read)
        return 'skipped'

    if doc.needs_pdf and backend != 'anthropic':
        # Text only. A scan with no OCR text is not a read this backend can
        # make, and saying so beats a verdict on an empty page.
        _finish(conn, read_id, 'unreadable', 'scanned document: no OCR text (install tesseract-ocr) '
                'and the local backend reads text only', read_source=read_source,
                page_count=doc.page_count, pages_read=doc.pages_read)
        return 'unreadable'
    if backend == 'local':
        doc = fit_to_chars(doc, local_doc_char_budget(getattr(client, 'ctx_tokens', None)))

    pdf_for_model = _pdf_first_pages(pdf_bytes, MAX_PAGES) if doc.needs_pdf else None
    messages = build_messages(row, doc, pdf_for_model)
    try:
        resp = client.messages.parse(
            model=model,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            messages=messages,
            output_format=FilingVerdict,
        )
        verdict: FilingVerdict = resp.parsed_output
        usage = getattr(resp, 'usage', None)
        inp = int(getattr(usage, 'input_tokens', 0) or 0)
        out = int(getattr(usage, 'output_tokens', 0) or 0)
    except Exception as e:
        _finish(conn, read_id, 'failed', f'model: {e}')
        return 'failed'
    if getattr(resp, 'label', None):
        model = resp.label               # a lane says which provider answered: 'groq:…', 'local:…'
    elif backend == 'local':
        # What the server says it ran (llama.cpp answers with the gguf name),
        # never the configured label — a free read must be auditable too.
        served = getattr(resp, 'model', None)
        if served:
            model = 'local:' + os.path.basename(str(served))[:80]

    impact = verdict.impact if verdict.impact in IMPACTS else 'unclear'
    _finish(
        conn, read_id, 'done', None,
        impact=impact, magnitude=None,          # no size judgement: owner, 2026-10-01
        headline=(verdict.headline or '')[:300],
        reasoning=verdict.reasoning,
        evidence_quote=verdict.evidence_quote,
        confidence=max(0.0, min(1.0, float(verdict.confidence or 0))),
        amount_value=None, amount_unit=None, amount_basis=None,
        relative_to=None, relative_pct=None,
        role=verdict.role,
        touches=verdict.touches if verdict.touches in TOUCHES else 'other',
        company_view=(verdict.company_view or 'Not stated')[:500],
        timeframe=(verdict.timeframe or 'Not stated')[:300],
        watch_next=(verdict.watch_next or 'Nothing stated')[:500],
        model=model, reader_version=READER_VERSION,
        read_source=read_source,
        page_count=doc.page_count, pages_read=doc.pages_read,
        input_tokens=inp, output_tokens=out, cost_usd=_cost(model, inp, out),
    )
    return 'done'


def read_pending(conn, session=None, client=None, limit: int = MAX_PER_PASS,
                 budget_usd: Optional[float] = None, model: str = MODEL,
                 retry_failed: bool = True, on_progress=None,
                 max_seconds: Optional[float] = None, tier: Optional[str] = None,
                 since=None, backend: Optional[str] = None) -> dict:
    """Read up to `limit` rows, newest first, one request in flight. Returns
    counts. With no API key (or no local server configured) nothing is
    claimed — rows stay `pending`, which is the honest state, and the ingest
    pass still completes."""
    # `skipped` (str) is why the PASS stopped early; `triaged` (int) counts
    # rows gate 1 refused to pay for — different things, kept apart on purpose.
    stats = {'read': 0, 'done': 0, 'failed': 0, 'unreadable': 0, 'triaged': 0,
             'cost_usd': 0.0, 'skipped': None}
    if client is None:
        missing = backend_missing()
        if missing:
            stats['skipped'] = missing
            log.warning(f'[filing_reader] {missing} — rows stay pending')
            return stats
        client = None                    # chosen per row: its priority lane (client_for)
    missing = schema_missing(conn)
    if missing:
        stats['skipped'] = missing
        log.error(f'[filing_reader] {missing} — nothing claimed, rows stay pending')
        return stats
    if session is None:
        from pipeline.utils.nse_session import NseSession
        session = NseSession()

    with conn.cursor() as cur:
        cur.execute('SELECT now()')
        pass_started = cur.fetchone()[0]
    conn.rollback()

    if max_seconds is None:
        max_seconds = MAX_SECONDS
    t0 = time.monotonic()
    while stats['read'] < limit:
        if budget_usd is not None and stats['cost_usd'] >= budget_usd:
            stats['skipped'] = f'budget {budget_usd} USD reached'
            break
        if max_seconds and time.monotonic() - t0 >= max_seconds:
            stats['skipped'] = f'time budget {int(max_seconds)}s reached — the rest stay pending'
            log.info(f'[filing_reader] {stats["skipped"]}')
            break
        row = _claim_next(conn, retry_failed=retry_failed, pass_started=pass_started, tier=tier, since=since)
        if row is None:
            break
        try:
            status = read_one(conn, row, client if client is not None else client_for(row), session,
                              model=model, backend=backend)
        except Exception as e:
            # A bug in the reader is this row's failure, not the pass's: mark
            # it (the next pass retries under the attempt cap) and go on. If
            # even the mark fails the fault is the table, and that propagates.
            conn.rollback()
            log.exception(f'[filing_reader] read {row["read_id"]} crashed')
            _finish(conn, row['read_id'], 'failed', f'reader: {e}')
            status = 'failed'
        stats['read'] += 1
        key = 'triaged' if status == 'skipped' else status
        stats[key] = stats.get(key, 0) + 1
        if status == 'done':
            with conn.cursor() as cur:
                cur.execute('SELECT cost_usd FROM km_filing_reads WHERE id = %s', (row['read_id'],))
                c = cur.fetchone()
            conn.rollback()
            stats['cost_usd'] += float(c[0] or 0) if c else 0.0
        if on_progress:
            on_progress(stats)
        if REQUEST_DELAY_SEC:
            time.sleep(REQUEST_DELAY_SEC)
    return stats


def release_stale_reading(conn, older_than_minutes: int = 30) -> int:
    """A row left `reading` by a killed process goes back to `failed` (so the
    next pass retries it) — the same orphan rule the job table uses."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE km_filing_reads
               SET status = 'failed', last_error = 'reader interrupted', finished_at = now()
             WHERE status = 'reading' AND started_at < now() - (%s || ' minutes')::interval
        """, (str(older_than_minutes),))
        n = cur.rowcount
    conn.commit()
    return n


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
