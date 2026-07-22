"""
Deterministic Mercury readiness narration — NO LLM.

Powers the 'index.astro_now' VaNi intent. Mirrors the client-side
services/mercuryStory.ts + services/ruleInterpretation.ts logic (same
readiness voice, same base-rate honesty) so the story reads identically
whether a user reads it on-chart (ribbon/right-click) or asks VaNi for it —
one story, computed once, in two places by necessity but never diverging in
content or tone.

Owner directive (2026-07-22): "we don't need LLM everywhere... insert the
data into the cache table, when cache is having data, LLM won't be
invoked." This function is called by vani_ask() in pipeline2_api.py, its
result written straight into km_vani_cache (lib/vani_cache.py) — the LLM
path for this intent is dead code in practice, kept only so the intent
registry entry has a valid (never-reached) system_prompt.
"""

from datetime import date, timedelta

RULE_JOURNEY = 'TRN-MER-MAN-TRN'
RULE_MOTION = 'TR-MER-RET'
RULE_COMBUST = 'TR-MER-CMB-E-BEA'
WATCH_ORB_DAYS = 2

# Only sign-ingress days are "watch days" (confirmed 2026-07-22 against
# km_rule_evidence: TRN-MER-MAN-TRN 'start' 56.1% vs 48.9% base clears the
# +/-5pt honesty threshold; TR-MER-RET start/end sit at 50.9%/47.1% — INSIDE
# the threshold, i.e. ordinary days). Motion/combust boundaries render as
# orientation only — never fed the WATCH framing or a stat line, matching
# services/ruleInterpretation.ts's per-boundary dev>=5 gate. Revisit only if
# a future evidence refresh changes these numbers.


def _fmt(d: date) -> str:
    return d.strftime('%d %b')


def build_mercury_readiness_text(db, date_str: str) -> str | None:
    today = date.fromisoformat(date_str)
    back = today - timedelta(days=WATCH_ORB_DAYS)
    fwd = today + timedelta(days=90)

    rules = db.execute(
        "SELECT id, rule_code FROM km_astro_rule_master WHERE rule_code = ANY(%s)",
        ([RULE_JOURNEY, RULE_MOTION, RULE_COMBUST],),
    )
    code_by_id = {r['id']: r['rule_code'] for r in rules}
    if not code_by_id:
        return None

    transits = db.execute(
        """SELECT rule_id, start_date, end_date, sign, combustion_type
           FROM km_rule_transits
           WHERE rule_id = ANY(%s) AND end_date >= %s AND start_date <= %s
           ORDER BY start_date""",
        (list(code_by_id.keys()), back, fwd),
    )
    if not transits:
        return None

    sign = None
    motion = 'direct'
    combust_until = None
    combust_stage = None
    upcoming: list[tuple[date, str, bool]] = []   # (date, label, is_watch_day)
    watch_candidates: list[tuple[date, str]] = []

    for t in transits:
        code = code_by_id[t['rule_id']]
        s, e = t['start_date'], t['end_date']
        active = s <= today <= e
        if code == RULE_JOURNEY:
            # Ingress — the only confirmed watch-day family.
            if active:
                sign = t['sign']
                watch_candidates.append((s, f"enters {t['sign']}"))
            elif s > today and t['sign']:
                upcoming.append((s, f"enters {t['sign']}", True))
                watch_candidates.append((s, f"enters {t['sign']}"))
        elif code == RULE_MOTION:
            # Motion boundaries — orientation only (not a confirmed watch day).
            if active:
                motion = 'retrograde'
                if e >= today:
                    upcoming.append((e, 'stations direct', False))
            elif s > today:
                upcoming.append((s, 'turns retrograde', False))
        elif code == RULE_COMBUST:
            if active:
                combust_until = e
                combust_stage = t['combustion_type']
                upcoming.append((e, 'exits combust', False))
            elif s > today:
                upcoming.append((s, 'enters combust', False))

    upcoming.sort(key=lambda x: x[0])

    # Nearest watch-day whose +/-2-session orb contains today.
    watch = None
    best_dist = 999
    for d, label in watch_candidates:
        dist = abs((d - today).days)
        if dist <= WATCH_ORB_DAYS and dist < best_dist:
            watch, best_dist = (d, label), dist

    # ── Compose ─────────────────────────────────────────────────────────────
    parts: list[str] = []
    state = f"Mercury is currently {motion}"
    if sign:
        state += f" in {sign}"
    if combust_until:
        stage_txt = f" ({combust_stage})" if combust_stage else ""
        state += f", running combust{stage_txt} until {_fmt(combust_until)} — a period of reduced visibility, not a trend-change marker"
    parts.append(state + ".")

    if watch:
        w_date, w_label = watch
        # Pull the evidence for the governing boundary — sign-ingress ('start')
        # is the only carrier confirmed so far (astro-story.md); fall back to
        # silence on the stat line for boundaries without a confirmed tilt.
        ev = db.execute(
            """SELECT e.transitions FROM km_rule_evidence e
               JOIN km_astro_rule_master r ON r.id = e.rule_id
               WHERE r.rule_code = %s""",
            (RULE_JOURNEY,),
        )
        stat_line = ''
        if ev and ev[0].get('transitions'):
            t = ev[0]['transitions'].get('start')
            if t and t.get('n', 0) >= 10 and t.get('base_flip_pct') is not None:
                dev = t['flip_pct'] - t['base_flip_pct']
                if abs(dev) >= 5 and dev > 0:
                    stat_line = (
                        f" Around this kind of boundary, the short-term trend has "
                        f"historically changed {t['flip_pct']:.0f}% of the time versus "
                        f"about {t['base_flip_pct']:.0f}% on an ordinary day ({t['n']} "
                        f"occurrences on record)"
                    )
                    if t.get('confirm_given_flip_pct') is not None:
                        stat_line += (
                            f", confirmed by a break of the previous session's high or "
                            f"low {t['confirm_given_flip_pct']:.0f}% of the time when it changed"
                        )
                    stat_line += '.'
        parts.append(
            f"Today falls inside a watch window — Mercury {w_label} on {_fmt(w_date)}."
            + stat_line +
            " This is a cue for readiness, not a directional call: keep the previous "
            "session's high and low visible for a couple of sessions either side of "
            "the date, since that break is what historically confirms the change."
        )
    elif upcoming:
        nxt_date, nxt_label, is_watch = upcoming[0]
        days_away = (nxt_date - today).days
        kind = "watch day" if is_watch else "event"
        parts.append(
            f"The next {kind} is {_fmt(nxt_date)} ({nxt_label}, {days_away}d away)."
        )

    return ' '.join(parts)
