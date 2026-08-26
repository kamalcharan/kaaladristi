"""Extract the scanner contract from the FRONTEND SOURCE, not from notes about it.

Why this file exists
--------------------
Every scanner-integrity defect found on 2026-08-24/25 had one shape: the check
was written by reading the code it was checking, so it agreed with itself and
reported clean while real defects sat in production.

  * MATVIEW_PRESET_COLUMNS was a hand-typed Python list mirroring ScanTable.tsx.
    It omitted score_5d/score_22d, so the audit passed while every row in the
    UI showed a dash.
  * "is this preset matview-backed?" was answered by "does it have rows in
    km_scan_results". waking_giants has rows AND is served from km_wg_journeys,
    so a dead arm looked healthy for a whole migration cycle.

A constant I maintain by hand cannot detect that I maintained it wrong. So the
contract is READ OUT OF THE SHIPPING CODE at audit time:

  preset -> which fetcher executeScan() dispatches to
         -> which table that fetcher actually queries
         -> which columns ScanTable renders for it

Drift now surfaces as a changed extraction, not as silent agreement.

Every extractor RAISES if it finds nothing. A parser that silently returns an
empty set is exactly the failure mode this file exists to remove: it would make
the audit report "no defects" for the worst possible reason.
"""

from __future__ import annotations

import os
import re

_HERE = os.path.dirname(os.path.abspath(__file__))
_SRC = os.path.normpath(os.path.join(_HERE, '..', '..', 'frontend', 'src'))
SCAN_ENGINE = os.path.join(_SRC, 'services', 'scanEngine.ts')
SCAN_TABLE = os.path.join(_SRC, 'components', 'domain', 'ScanTable.tsx')


def _read(path: str) -> str:
    if not os.path.exists(path):
        raise FileNotFoundError(
            f'scan contract source missing: {path}. The audit derives its '
            f'expectations from the frontend; without it there is nothing to '
            f'check against and a "clean" result would be meaningless.')
    with open(path, encoding='utf-8') as fh:
        return fh.read()


def _block(src: str, start_pat: str, open_ch: str, close_ch: str) -> str:
    """Return the balanced {...} / [...] block that follows `start_pat`."""
    m = re.search(start_pat, src)
    if not m:
        raise ValueError(f'anchor not found in frontend source: {start_pat!r}')
    i = src.index(open_ch, m.end() - 1)
    depth, j = 0, i
    while j < len(src):
        if src[j] == open_ch:
            depth += 1
        elif src[j] == close_ch:
            depth -= 1
            if depth == 0:
                return src[i:j + 1]
        j += 1
    raise ValueError(f'unbalanced block after {start_pat!r}')


def _require(value, what: str):
    if not value:
        raise ValueError(
            f'extracted nothing for {what} — the frontend source shape changed. '
            f'Fix the extractor; do NOT let the audit run on an empty contract.')
    return value


# ── 1. preset metadata ──────────────────────────────────────────────────
def preset_meta(src: str | None = None) -> dict[str, dict]:
    """id -> {universe, limit, vani_rule} straight off SCAN_PRESETS."""
    if src is None:
        src = _read(SCAN_ENGINE)
    block = _block(src, r'SCAN_PRESETS[^=\n]*=', '[', ']')
    out = {}
    for entry in re.finditer(r"\{\s*id:\s*'([^']+)'(.*?)\}\s*,?\s*(?=\n)", block, re.S):
        pid, body = entry.group(1), entry.group(2)
        uni = re.search(r"universe:\s*'([^']+)'", body)
        lim = re.search(r'limit:\s*(\d+)', body)
        van = re.search(r"vani_rule:\s*(?:'([^']+)'|(null))", body)
        cat = re.search(r"category:\s*'([^']*)'", body)
        out[pid] = {
            'universe': uni.group(1) if uni else None,
            'limit': int(lim.group(1)) if lim else None,
            'vani_rule': van.group(1) if (van and van.group(1)) else None,
            'category': cat.group(1) if cat else '',
        }
    return _require(out, 'SCAN_PRESETS')


# ── 2. routing: preset -> fetcher -> table ──────────────────────────────
_TABLE_OF = {
    'km_scan_results': 'matview',
    'km_wg_journeys': 'journeys',
    'km_equity_eod': 'live',
}


def _fetcher_body(src: str, name: str) -> str:
    m = re.search(rf'(?:async\s+)?function\s+{re.escape(name)}\s*\(', src)
    if not m:
        return ''
    return _block(src, rf'(?:async\s+)?function\s+{re.escape(name)}\s*\(', '{', '}')


def routing(src: str | None = None) -> dict[str, str]:
    """preset -> 'matview' | 'journeys' | 'live'.

    Resolved the way executeScan() resolves it: the FIRST branch that matches
    wins, then the chosen fetcher's body decides the table. This is the check
    that "has rows in km_scan_results" could never make.
    """
    if src is None:
        src = _read(SCAN_ENGINE)
    body = _block(src, r'export\s+async\s+function\s+executeScan\s*\(', '{', '}')

    wg = set(re.findall(r'^\s*(\w+):\s*\'(?:WAKING|ASCENDING|STIRRING)\'',
                        _block(src, r'WG_JOURNEY_PRESETS[^=\n]*=', '{', '}'), re.M))
    _require(wg, 'WG_JOURNEY_PRESETS')
    bundle = set(re.findall(r"'([^']+)'",
                            _block(src, r'MATVIEW_BUNDLE_PRESETS[^=\n]*=', '[', ']')))
    _require(bundle, 'MATVIEW_BUNDLE_PRESETS')

    out: dict[str, str] = {}

    def _claim(pid: str, fetcher: str):
        if pid in out:            # first branch wins, like executeScan
            return
        fb = _fetcher_body(src, fetcher)
        for table, kind in _TABLE_OF.items():
            if f"from('{table}')" in fb:
                out[pid] = kind
                return
        out[pid] = 'unknown'

    # Walk executeScan top to bottom so branch precedence is preserved.
    for line in body.splitlines():
        for pid, fetcher in re.findall(
                r"scanId\s*===\s*'([^']+)'\s*(?:\|\|[^)]*)?\)\s*return\s+(\w+)", line):
            _claim(pid, fetcher)
        if 'WG_JOURNEY_PRESETS' in line and 'return' in line:
            fetcher = re.search(r'return\s+(\w+)', line)
            for pid in sorted(wg):
                _claim(pid, fetcher.group(1) if fetcher else '')
        if 'MATVIEW_BUNDLE_PRESETS' in line and 'has(scanId)' in line:
            for pid in sorted(bundle):
                _claim(pid, 'fetchFromScanMatview')

    return _require(out, 'executeScan routing')


def matview_served(src: str | None = None) -> set[str]:
    """Presets the frontend genuinely reads out of km_scan_results."""
    return {p for p, kind in routing(src).items() if kind == 'matview'}


# ── 3. columns the UI renders per preset ────────────────────────────────
def preset_columns(src: str | None = None) -> dict[str, list[str]]:
    """preset -> column keys, from ScanTable's per-preset overrides."""
    if src is None:
        src = _read(SCAN_TABLE)
    block = _block(src, r'PRESET_COL_OVERRIDES\s*:[^=]*=', '{', '}')
    out = {}
    for m in re.finditer(r'(\w+):\s*\[(.*?)\]', block, re.S):
        out[m.group(1)] = re.findall(r"'([^']+)'", m.group(2))
    return _require(out, 'PRESET_COL_OVERRIDES')


FIELD_AVAILABILITY_TS = os.path.join(_SRC, 'fieldAvailability.ts')

# ScanTable.tsx line 148 resolves a preset's columns as:
#     defaultCols = PRESET_COL_OVERRIDES[presetId] ?? groupDefaultCols
# where groupDefaultCols comes from FIELD_AVAILABILITY[preset.category].
# BOTH paths must be in the contract. The blank Score 5D/22D bug lived in the
# group path (price_action.defaultCols carries score_5d/score_22d), so a
# contract that only read the per-preset overrides would have missed the very
# defect that started this work.
def group_columns(src: str | None = None) -> dict[str, list[str]]:
    """category -> defaultCols, from FIELD_AVAILABILITY."""
    if src is None:
        src = _read(FIELD_AVAILABILITY_TS)
    block = _block(src, r'FIELD_AVAILABILITY[^=]*=', '{', '}')
    out = {}
    for m in re.finditer(r'(\w+):\s*\{(.*?)\n  \}', block, re.S):
        d = re.search(r'defaultCols:\s*\[(.*?)\]', m.group(2), re.S)
        if d:
            out[m.group(1)] = re.findall(r"'([^']+)'", d.group(1))
    return _require(out, 'FIELD_AVAILABILITY')


# getFieldsForGroup()'s fallback for an unknown category.
_GROUP_FALLBACK = ['symbol', 'close', 'pct_chng']


def columns_for(preset: str, meta: dict, overrides: dict, groups: dict,
                db_meta: dict | None = None) -> list[str]:
    """Exactly what ScanTable renders for this preset.

    Resolution order mirrors the app:
      1. PRESET_COL_OVERRIDES[presetId]                       (ScanTable:148)
      2. FIELD_AVAILABILITY[preset.category].defaultCols      (ScanTable:115)
      3. getFieldsForGroup()'s fallback for an unknown category

    `preset.category` comes from getPresetMeta(), which prefers the
    kd_scan_presets ROW and only falls back to the hardcoded SCAN_PRESETS
    array. Those two disagree in production — on 2026-08-25, power_sell is
    category '' in the TS and 'market' in the DB, and stage_2_watch is
    NSE_ONLY in the TS and NSE_BSE in the DB. Reading the TS alone gives a
    confidently wrong answer, which is the same mistake as hand-maintaining
    the contract, one level down. Pass db_meta so the DB wins, as it does at
    run time."""
    if preset in overrides:
        return overrides[preset]
    cat = ''
    if db_meta and preset in db_meta:
        cat = db_meta[preset].get('category') or ''
    if not cat:
        cat = (meta.get(preset) or {}).get('category') or ''
    return groups.get(cat, _GROUP_FALLBACK)


# ── 4. the matview row mapper ───────────────────────────────────────────
# A column can be present and populated in km_scan_results and STILL render
# as a dash, because scanRowToScanStock() decides what survives the trip from
# the row to the ScanStock the table reads. Found live on 2026-08-25:
# migration 180 added score_5d/score_22d to the matview, fetchFromScanMatview
# selects *, and the mapper neither mapped them nor mentioned them — the UI
# stayed blank while a DB-only audit said "populated". This function makes the
# mapper part of the contract.
def mapper_fields(mapper_name: str, src: str | None = None) -> dict[str, str]:
    """field -> 'mapped' | 'null' for every field the named mapper returns."""
    if src is None:
        src = _read(SCAN_ENGINE)
    body = _block(src, rf'function {re.escape(mapper_name)}\([^)]*\)[^{{]*', '{', '}')
    out = {}
    for m in re.finditer(r'^\s{4}(\w+):\s*(.+?),?\s*$', body, re.M):
        field, expr = m.group(1), m.group(2).rstrip(',')
        out[field] = 'null' if expr == 'null' else 'mapped'
    return _require(out, f'{mapper_name} fields')


def preset_mapper(src: str | None = None) -> dict[str, str]:
    """preset -> the row-mapper its fetcher runs matview rows through.
    Presets share fetchFromScanMatview/scanRowToScanStock unless their own
    fetcher names a different *RowToScanStock (flower_pot_burst does)."""
    if src is None:
        src = _read(SCAN_ENGINE)
    out = {}
    for preset, kind in routing(src).items():
        if kind != 'matview':
            continue
        # find the fetcher executeScan dispatches this preset to
        body = _block(src, r'export\s+async\s+function\s+executeScan\s*\(', '{', '}')
        m = re.search(rf"scanId\s*===\s*'{re.escape(preset)}'[^\n]*return\s+(\w+)", body)
        fetcher = m.group(1) if m else 'fetchFromScanMatview'
        fb = _fetcher_body(src, fetcher)
        mm = re.search(r'(\w+RowToScanStock)', fb)
        out[preset] = mm.group(1) if mm else 'scanRowToScanStock'
    return _require(out, 'preset mappers')


def mapper_gaps(db_meta: dict | None = None) -> dict[str, list[str]]:
    """preset -> UI columns its OWN mapper nulls or omits, matview presets
    only. These render as dashes no matter what the matview holds."""
    src = _read(SCAN_ENGINE)
    c = contract(db_meta)
    mappers = preset_mapper(src)
    fields_of = {name: mapper_fields(name, src) for name in set(mappers.values())}
    gaps = {}
    for preset, mapper in mappers.items():
        fields = fields_of[mapper]
        bad = [col for col in c['columns'].get(preset, [])
               if col != 'symbol' and fields.get(col, 'absent') != 'mapped']
        if bad:
            gaps[preset] = bad
    return gaps


FIELD_CONFIG_TS = os.path.join(_SRC, 'config', 'fieldConfig.ts')


def field_config_keys(src: str | None = None) -> set[str]:
    """Every column key ALL_FIELDS (fieldConfig.ts) actually defines."""
    if src is None:
        src = _read(FIELD_CONFIG_TS)
    block = _block(src, r'ALL_FIELDS\s*:[^=]*=', '{', '}')
    keys = set(re.findall(r'^\s{2}([a-zA-Z_][a-zA-Z0-9_]*):\s*\{', block, re.M))
    return _require(keys, 'ALL_FIELDS')


def unknown_columns(db_meta: dict | None = None) -> dict[str, list[str]]:
    """preset -> column keys it asks ScanTable to render that ALL_FIELDS
    (fieldConfig.ts) does NOT define. Such a column renders as nothing: no header, no cell, no error —
    just dead width in the grid.

    This layer was missing and it cost a shipped defect: weekly_movers listed
    'pct_below_52w_high', which IS a real km_equity_eod column, so every
    DB-facing check passed while the UI drew an empty column. The key
    ALL_FIELDS defines is 'pctBelow52wHigh'. Column-key validity and DB-column
    existence are different questions; the audit only asked the second.

    Measured when added: zero unknown keys across every existing preset override
    and every group defaultCols, so this fires on real drift, not on noise.
    """
    c = contract(db_meta)
    known = field_config_keys()
    out = {}
    for preset, cols in c['columns'].items():
        bad = [col for col in cols if col not in known]
        if bad:
            out[preset] = bad
    return out


def contract(db_meta: dict | None = None) -> dict:
    """The whole contract. Pass kd_scan_presets rows as `db_meta` so preset
    metadata resolves DB-first, the way getPresetMeta() does."""
    eng, tbl = _read(SCAN_ENGINE), _read(SCAN_TABLE)
    meta = preset_meta(eng)
    overrides = preset_columns(tbl)
    groups = group_columns()
    return {
        'meta': meta,
        'routing': routing(eng),
        'overrides': overrides,
        'groups': groups,
        # Resolved per preset — this is what the UI actually renders.
        'columns': {p: columns_for(p, meta, overrides, groups, db_meta) for p in meta},
        # Where the hardcoded array and the live DB row disagree. Not fatal —
        # the DB wins — but it is drift, and drift is what this file exists to
        # surface rather than absorb.
        'meta_drift': {
            p: {k: (meta[p].get(k), (db_meta or {}).get(p, {}).get(k))
                for k in ('category', 'universe', 'vani_rule')
                if p in (db_meta or {})
                and (db_meta[p].get(k) or None) != (meta[p].get(k) or None)}
            for p in meta if p in (db_meta or {})
        },
    }


if __name__ == '__main__':
    import json
    c = contract()
    print(json.dumps(c['routing'], indent=2, sort_keys=True))
    print(f"\npresets: {len(c['meta'])}  "
          f"matview-served: {sorted(p for p,k in c['routing'].items() if k=='matview')}")
