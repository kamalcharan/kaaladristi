"""
Filing taxonomy — NSE `desc` → family, the deterministic first pass
===================================================================
NSE categorises every announcement itself, in the `desc` field. Measured on the
live API 2026-09-15 (probe v2, 14,776 announcements over 30 days): **107 distinct
values, top 40 covering 96.8%**. Mapped here, it classifies **63.5% of the stream
with no model at all** — which is what makes a 12-month backfill 5.1 days of
serial Qwen instead of 14.

Two properties of the distribution matter more than that number:

  * ALMOST HALF THE STREAM IS NOISE `desc` DISCARDS FOR FREE. Newspaper
    publications (17.2%) and shareholder meetings (15.7%) alone are a third.
  * THE MATERIAL STREAM IS SMALL. Order wins + acquisitions + mergers are 264
    rows in 30 days — roughly 3,200 a year. Size the review queue against that,
    not against 201,000.

⚠ `GENERAL` and `UNCLASSIFIED` ARE DIFFERENT VALUES.
    GENERAL       = confidently routine. Discard.
    UNCLASSIFIED  = the map does not know. Goes to the LLM.
  Conflating them fills the review queue with noise in week one and gets it
  ignored by week two — the same distinction the scanner work had to make
  between "flag is false" and "no flag".

⚠ EVERY KEY HERE IS A STABLE ADDRESS. `family` and `event_type` are never
  renamed; the Eagles/Spark display vocabulary lives in the frontend constants
  file and changes freely. Same split as signalScale.ts.

Counts in the comments are the measured 30-day sample, kept so the next person
can see what was rare rather than re-deriving it.
"""

# Families — mirror the CHECK constraint in migration 212.
SPARK, CORPORATE_ACTION, OWNERSHIP = 'SPARK', 'CORPORATE_ACTION', 'OWNERSHIP'
NEGATIVE_SPARK, GENERAL, UNCLASSIFIED = 'NEGATIVE_SPARK', 'GENERAL', 'UNCLASSIFIED'

POSITIVE, NEGATIVE, NEUTRAL = 'positive', 'negative', 'neutral'

# Stamped on every event this pass writes, and bumped whenever DESC_MAP gains or
# changes an entry — so a row's label can be traced to the map that produced it.
# v2 (2026-09-24): the fund-raising cluster and the proceeds-report trio.
TAXONOMY_VERSION = 'v2'

# desc -> (family, event_type, polarity)
DESC_MAP: dict[str, tuple[str, str, str]] = {
    # ── SPARK: changes the business trajectory ──────────────────────────────
    'Bagging/Receiving of orders/contracts': (SPARK, 'LARGE_ORDER', POSITIVE),   # 137
    'Acquisition':                           (SPARK, 'ACQUISITION', POSITIVE),   # 101
    'Amalgamation/Merger':                   (SPARK, 'ACQUISITION', POSITIVE),   # 26

    # ── CORPORATE ACTION: mechanical, feeds km_corporate_actions + adj_factor
    # This arm fixes a measured, year-old defect (D44): km_corporate_actions has
    # 0 rows, so closes are unadjusted and stocks read below their 150-EMA for
    # months after a split. Highest-certainty payoff in the whole plan.
    'Record Date':                           (CORPORATE_ACTION, 'RECORD_DATE', NEUTRAL),  # 421

    # ── OWNERSHIP / STRUCTURAL: dilution + smart money ──────────────────────
    'ESOP/ESOS/ESPS':                        (OWNERSHIP, 'ESOP', NEUTRAL),            # 160
    'Allotment of Securities':               (OWNERSHIP, 'ALLOTMENT', NEUTRAL),       # 102
    'Disclosure under SEBI Takeover Regulations': (OWNERSHIP, 'SAST', NEUTRAL),       # 56
    'Options to purchase securities':        (OWNERSHIP, 'ESOP', NEUTRAL),            # 26

    # ── FUND RAISING (2026-09-24) ───────────────────────────────────────────
    # These were UNCLASSIFIED with a NULL event_type until now, which meant a
    # QIP — among the most consequential things a smallcap files: who is
    # buying, at what price, how much dilution — could not be read by any
    # scanner, VaNi fact or drift study. They are exact NSE strings with
    # unambiguous meanings, so this is a lookup, not a model's job.
    #
    # ⚠ POLARITY IS NEUTRAL, AND THAT IS MEASURED, not just the house default.
    # Pooled over the six raise subjects, median 5-session excess return vs the
    # same-date universe median is **-0.85 pts (n=62)** — the dilution side
    # winning, mildly. Against 'Allotment of Securities' at +0.48 (n=169). So
    # 'capital in' would be the wrong sign and 'dilution' overstates a 62-row
    # sample: the price reaction carries direction (see the +15% rule in
    # docs/claude/pead-filing-integration.md), the label does not. Same
    # reasoning the resignation entries above already state.
    'Qualified Institutional Placement':     (OWNERSHIP, 'QIP', NEUTRAL),                 # 13
    'Preferential issue':                    (OWNERSHIP, 'PREFERENTIAL_ISSUE', NEUTRAL),  # 13
    'Rights Issue':                          (OWNERSHIP, 'RIGHTS_ISSUE', NEUTRAL),        # 9
    'Issue of Securities':                   (OWNERSHIP, 'ISSUE_OF_SECURITIES', NEUTRAL), # 53
    'FCCBs':                                 (OWNERSHIP, 'FCCB', NEUTRAL),                # 1
    'Conversion':                            (OWNERSHIP, 'CONVERSION', NEUTRAL),          # 4
    # An ENABLING step, not a raise — the company is creating headroom it may
    # never use. Distinct event_type so a consumer can exclude it rather than
    # count a resolution as money received.
    'Increase in Authorised Capital':        (OWNERSHIP, 'AUTHORISED_CAPITAL', NEUTRAL),  # 5
    # ⚠ NOT A FUND RAISE. An OFS is an existing holder selling: the shares
    # change hands, the company receives NOTHING and is not diluted. Filing it
    # under the same event_type as a QIP would make every 'capital raised'
    # figure wrong. n=2 live, far too few to measure.
    'Offer for sale':                        (OWNERSHIP, 'OFS', NEUTRAL),                 # 3

    # ── SWITCH (management/strategy) — a SPARK family with neutral polarity,
    # because an appointment is not good or bad news on its own.
    'Appointment':                           (SPARK, 'MGMT_CHANGE', NEUTRAL),    # 256
    'Change in Management':                  (SPARK, 'MGMT_CHANGE', NEUTRAL),    # 166
    'Change in Director(s)':                 (SPARK, 'MGMT_CHANGE', NEUTRAL),    # 88
    # Resignations skew negative but are not reliably so; polarity stays neutral
    # and the LLM may refine it later. Guessing here would be directional
    # language dressed as data.
    'Resignation of Director/KMP/SMP':       (SPARK, 'MGMT_EXIT', NEUTRAL),      # 186
    'Resignation':                           (SPARK, 'MGMT_EXIT', NEUTRAL),      # 112
    'Cessation':                             (SPARK, 'MGMT_EXIT', NEUTRAL),      # 74

    # ── NEGATIVE SPARK ──────────────────────────────────────────────────────
    'Change in Auditors':                    (NEGATIVE_SPARK, 'AUDITOR_CHANGE', NEGATIVE),   # 86
    'Action(s) taken or orders passed':      (NEGATIVE_SPARK, 'REGULATORY_ACTION', NEGATIVE),# 75
    'Action(s) initiated or orders passed':  (NEGATIVE_SPARK, 'REGULATORY_ACTION', NEGATIVE),# 34
    'Pendency of Litigation(s)/dispute(s) or the outcome impacting the Company':
                                             (NEGATIVE_SPARK, 'LITIGATION', NEGATIVE),       # 69
    'Corporate Insolvency Resolution Process':
                                             (NEGATIVE_SPARK, 'INSOLVENCY', NEGATIVE),       # 66

    # ── GENERAL: confidently routine. Half the stream. ──────────────────────
    'Copy of Newspaper Publication':         (GENERAL, 'NEWSPAPER', NEUTRAL),    # 2,546
    'Shareholders meeting':                  (GENERAL, 'AGM_EGM', NEUTRAL),      # 2,326
    'Analysts/Institutional Investor Meet/Con. Call Updates':
                                             (GENERAL, 'ANALYST_MEET', NEUTRAL), # 1,813
    # NSE ASKING the company to explain a move -- an effect, never a cause. If
    # this were ever treated as a spark the chain would run backwards.
    'Spurt in Volume':                       (GENERAL, 'EXCHANGE_QUERY', NEUTRAL),  # 149
    'Price movement':                        (GENERAL, 'EXCHANGE_QUERY', NEUTRAL),  # 99
    'Trading Window':                        (GENERAL, 'TRADING_WINDOW', NEUTRAL),  # 68
    'News Verification':                     (GENERAL, 'EXCHANGE_QUERY', NEUTRAL),  # 43
    'Corrigendum':                           (GENERAL, 'CORRIGENDUM', NEUTRAL),     # 36
    'Amendment to AOA/MOA':                  (GENERAL, 'ARTICLES', NEUTRAL),        # 34
    'Committee Meeting Updates':             (GENERAL, 'COMMITTEE', NEUTRAL),       # 28

    # ── PROCEEDS REPORTS (2026-09-24): routine, and a CONSEQUENCE of a raise ─
    # SEBI requires periodic reporting on how issue proceeds were used. Three
    # subjects, 541 rows, all previously UNCLASSIFIED and therefore queued for
    # the LLM at no benefit. Measured median 5-session excess -0.27 pts (n=441).
    #
    # ⚠ They must NOT join the fund-raising event types. A monitoring report is
    # filed quarterly ABOUT a raise that already happened, so counting it as a
    # raise would over-weight one event into many -- the migration-216 lesson,
    # where 427 of 2,733 result rows were a second Day 0 for one result.
    'Monitoring Agency Report':              (GENERAL, 'FUND_UTILISATION', NEUTRAL),   # 350
    'Statement of deviation(s) or variation(s) under Reg. 32':
                                             (GENERAL, 'FUND_UTILISATION', NEUTRAL),   # 182
    'Utilisation of Funds':                  (GENERAL, 'FUND_UTILISATION', NEUTRAL),   # 9
}

# ⚠ LEFT UNCLASSIFIED ON PURPOSE, although they sit in the frontend's
# "Capital Raise" chip alongside the entries above:
#   'Giving guarantees/indemnity/ becoming a surety for third party' (39) — a
#     contingent LIABILITY, not a raise. OPTIEMUS filed one the day after its
#     +20% bar. Its direction is genuinely contested and it belongs to no
#     family here without a rule of its own.
#   'Redemption' (1), 'Forfeiture' (4) — too few to place, and the meaning
#     turns on the document rather than the subject line.
# Naming them here so the next person can see they were considered and refused,
# rather than assume an oversight.

# Generic labels that carry no signal by themselves. Deliberately NOT in
# DESC_MAP: each can be anything, so they go to the LLM with their summary_text.
# Together with the 67-value tail this is 36.5% of the stream.
AMBIGUOUS_DESCS = frozenset({
    'General Updates',                   # 2,039
    'Updates',                           # 1,302
    'Outcome of Board Meeting',          # 544
    'Press Release',                     # 440
    'Credit Rating',                     # 182
    'Clarification - Financial Results', # 128
    'Investor Presentation',             # 125
    'Credit Rating- New',                # 42
    'Credit Rating- Revision',           # 41
    'Agreements',                        # 45
    'Disclosure of material issue',      # 34
})


def classify_desc(desc: str | None) -> tuple[str, str | None, str, float]:
    """(family, event_type, polarity, confidence) from NSE's own category.

    Returns UNCLASSIFIED for anything the map does not cover — including every
    AMBIGUOUS_DESCS value and the whole tail. That is the LLM's queue, and it
    must stay distinguishable from GENERAL.

    Confidence is 1.0 or 0.0 on purpose: this pass is a lookup, not a judgement.
    Graded confidence belongs to the model pass that follows it.
    """
    if not desc:
        return UNCLASSIFIED, None, NEUTRAL, 0.0
    hit = DESC_MAP.get(desc.strip())
    if hit:
        return hit[0], hit[1], hit[2], 1.0
    return UNCLASSIFIED, None, NEUTRAL, 0.0


def needs_model(desc: str | None) -> bool:
    """True when the deterministic pass cannot place it."""
    return classify_desc(desc)[0] == UNCLASSIFIED


# ═══════════════════════════════════════════════════════════════════════════
# Board-meeting PURPOSE → "did this meeting approve results?"
# ═══════════════════════════════════════════════════════════════════════════
# A SECOND FEED, and a different question. Everything above maps the
# announcements stream's `desc`. This maps /api/corporate-board-meetings, the
# PRIOR INTIMATION a company must file before it meets — the only NSE metadata
# that says a result is coming, because the result itself is filed as the
# generic 'Outcome of Board Meeting' (see migration 214's header).
#
# ⚠ THIS DOES NOT DATE ANYTHING. It answers which meetings are results
# meetings. Day 0 still comes from the outcome announcement's exchdisstime via
# kd_day_zero_trade_date. A meeting date is a date the market could not yet act
# on, so dating from it would inject the exact lookahead bias the whole plan
# guards against.
#
# Measured on the live feed, 481 meetings over 30 days (probe v3, 2026-09-16):
#   bm_purpose names results outright on  45 (9.4%)
#   bm_purpose is the generic 'Board Meeting Intimation' on 262 (54.5%)
# So the free-text rule below is not a nicety — it is most of the coverage, and
# its wording deserves the scrutiny a threshold gets. km_board_meetings stores
# `results_basis` precisely so the purpose/desc split stays MEASURABLE instead
# of assumed.

# bm_purpose is a slash-joined set ('Financial Results/Fund Raising'), so a
# substring test is the right shape here rather than an exact-value map.
_PURPOSE_RESULTS_TOKEN = 'financial results'

# Free text, lowercased and whitespace-collapsed before matching. Every phrase
# ends at 'result' so the singular and plural both hit.
#
# Deliberately NOT included: 'financial statement'. An AGM notice adopting
# audited financial STATEMENTS is not a results announcement, and it is common
# enough that admitting it would quietly inflate the population every drift
# number downstream is measured over.
_DESC_RESULTS_PHRASES = (
    'financial result',
    'quarterly result',
    'half yearly result',
    'half-yearly result',
    'annual result',
    'audited result',      # covers 'unaudited result' by substring
    'standalone result',
    'consolidated result',
)


def _norm(text: str | None) -> str:
    return ' '.join((text or '').lower().split())


def classify_board_meeting(purpose: str | None,
                           desc: str | None) -> tuple[bool, str | None]:
    """(is_results, basis) for one board-meeting intimation.

    basis is 'purpose' when bm_purpose named results outright, 'desc' when only
    the free text did, and None when neither — which is a real FALSE, not a
    gap: the company told the exchange what the meeting was for and it was not
    results.
    """
    if _PURPOSE_RESULTS_TOKEN in _norm(purpose):
        return True, 'purpose'
    body = _norm(desc)
    if any(p in body for p in _DESC_RESULTS_PHRASES):
        return True, 'desc'
    return False, None
