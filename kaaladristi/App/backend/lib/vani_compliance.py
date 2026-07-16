"""
Kāla-Drishti — VaNi SEBI Compliance Layer
==========================================
Single source of truth for SEBI-safe language in AI-generated text.
Seeded from the SEBI Sweep skill (App/mnt/skills/user/sebi-sweep/SKILL.md):
phrase-level blocks with sanctioned replacements (POA D15 — not blanket
word bans), plus hard-reject recommendation phrases.

Three layers of defense (used together by callers):
  1. translate_zone()/translate_flow() — convert DB vocabulary to the
     on-screen display vocabulary BEFORE anything enters an LLM prompt.
     The model can't say what it never sees.
  2. Prompt rules — intents state the banned vocabulary explicitly
     (see _VANI_RULES in vani_intents.py).
  3. post_filter() — substitute forbidden phrases in LLM output per the
     skill's replacement table; reject outright if recommendation
     language survives. Only clean text should be cached or served.

The morning-brief word set (MORNING_BRIEF_BLOCKLIST) and the correlation
endpoint's phrase list (CORRELATION_REJECT_PHRASES) live here too so all
VaNi endpoints share one compliance module.
"""

import re

# ── Display vocabulary (mirror of frontend signalScale.ts) ───────────────────
# VaNi speaks the same words the screen shows. DB zone values are internal.

ZONE_DISPLAY: dict[str, str] = {
    'Strong Bull':  'Leading',
    'Mild Bull':    'Improving',
    'Neutral Bull': 'Neutral',
    'Neutral':      'Neutral',   # legacy, no longer emitted
    'Neutral Bear': 'Neutral',
    'Mild Bear':    'Weakening',
    'Strong Bear':  'Lagging',
}

FLOW_DISPLAY: dict[str, str] = {
    'FRESH_LONGS':      'Fresh Longs',
    'FRESH_SHORTS':     'Fresh Shorts',
    'SHORT_COVERING':   'Short Covering',
    'LONG_LIQUIDATION': 'Long Liquidation',
    'LOW_VOLUME':       'Low Volume',
    'MIXED':            'Mixed',
}


def translate_zone(zone: str | None) -> str:
    """DB magic_rs_zone value → SEBI-safe on-screen label."""
    if not zone:
        return '—'
    return ZONE_DISPLAY.get(zone, zone if 'bull' not in zone.lower() and 'bear' not in zone.lower() else 'Neutral')


def translate_flow(flow: str | None) -> str:
    """DB flow_type value → display label."""
    if not flow:
        return '—'
    return FLOW_DISPLAY.get(flow, flow.replace('_', ' ').title())


# ── Phrase substitution table (sebi-sweep skill, longest-match-first) ────────
# Applied case-insensitively to LLM output; replacement preserves the
# capitalization of the matched phrase's first letter.

_SUBSTITUTIONS: list[tuple[str, str]] = [
    # Zone names — prefer on-screen vocabulary over the skill's generic table
    ('strong bull',   'Leading'),
    ('strong bear',   'Lagging'),
    ('mild bull',     'Improving'),
    ('mild bear',     'Weakening'),
    ('neutral bull',  'Neutral'),
    ('neutral bear',  'Neutral'),
    # Directional signal words (skill table)
    ('buy signal',    'entry signal'),
    ('sell signal',   'exit signal'),
    ('signal to buy', 'condition met'),
    ('signal to sell', 'condition met'),
    ('bullish',       'positive'),
    ('bearish',       'negative'),
    ('bull',          'uptrend'),
    ('bear',          'downtrend'),
    # Flow / activity words (skill table)
    ('white-hot',     'peak flow'),
    ('accumulation',  'rising flow'),
    ('accumulating',  'flow increasing'),
    ('distribution',  'falling flow'),
    ('distributing',  'flow decreasing'),
    ('hot money',     'elevated flow'),
    # Recommendation words (skill table)
    ('recommended',   'observed'),
    ('stop loss',     'risk level'),
    ('target price',  'reference level'),
]

# Hard-reject phrases — if any survive substitution, the text must NOT be
# served or cached. From the skill's "VaNi Language Rules" + bare buy/sell.
_REJECT_PATTERNS: list[re.Pattern] = [re.compile(p, re.IGNORECASE) for p in (
    r'\byou should\b',
    r'\bbuy\b',
    r'\bsell\b',
    r'\bbuying opportunity\b',
    r'\bselling opportunity\b',
    r'\bexpect (the )?price\b',
    r'\bprice will\b',
    r'\bmarket will\b',
    r'\bguaranteed\b',
    r'\brecommend\b',
    r'\bmust (buy|sell|enter|exit)\b',
)]

_WORD_CHARS = re.compile(r'\w')


def _preserve_case(match: re.Match, replacement: str) -> str:
    src = match.group(0)
    if src[:1].isupper():
        return replacement[:1].upper() + replacement[1:]
    return replacement


def apply_substitutions(text: str) -> str:
    """Replace forbidden phrases with their sanctioned equivalents."""
    out = text
    for phrase, repl in _SUBSTITUTIONS:
        pattern = re.compile(r'\b' + re.escape(phrase) + r'\b', re.IGNORECASE)
        out = pattern.sub(lambda m, r=repl: _preserve_case(m, r), out)
    return out


def post_filter(text: str | None) -> tuple[str | None, bool]:
    """
    Sanitize LLM output. Returns (clean_text, rejected).
    - Substitutes forbidden phrases per the sweep table.
    - If recommendation language survives, returns (None, True) — callers
      must not serve or cache the text.
    """
    if not text:
        return text, False
    clean = apply_substitutions(text)
    for pat in _REJECT_PATTERNS:
        if pat.search(clean):
            return None, True
    return clean, False


# ── Mandatory disclaimer (skill: "VaNi Language Rules") ──────────────────────

DISCLAIMER = 'This is not investment advice. DristiQ is a data correlation platform.'


def append_disclaimer(text: str) -> str:
    """Append the mandatory closing line if not already present."""
    if DISCLAIMER.lower() in text.lower():
        return text
    return f'{text.rstrip()}\n\n{DISCLAIMER}'


# ── Endpoint-specific legacy lists (moved here, behavior unchanged) ──────────

# Morning-brief observation filter (was _VANI_FORBIDDEN_WORDS in pipeline2_api).
MORNING_BRIEF_BLOCKLIST = frozenset({
    'buy', 'sell', 'recommend', 'predict', 'forecast',
    # 'watch' intentionally allowed — the morning-brief prompt uses "watch for reversal"
    'monitor', 'assess', 'develop', 'potential',
    'could indicate', 'may impact', 'heightened', 'significant',
    'dynamics', 'interplay', 'intellectual', 'recalibration',
})

# Correlation-insight reject list (was inline _forbidden_phrases).
CORRELATION_REJECT_PHRASES = [
    'buy ', 'sell ', 'bullish', 'bearish',
    'price will', 'market will', 'expect',
    'rise ', 'fall ', 'rally', 'correction',
    'predict', 'forecast', 'recommend',
    'potential rise', 'potential fall',
    'potential gain', 'potential loss',
    'potential upside', 'potential downside',
    'could rise', 'could fall', 'may rise', 'may fall',
    'likely to', 'expected to',
]
