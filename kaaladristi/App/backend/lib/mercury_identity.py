"""Canonical Mercury identities; legacy rule codes remain compatibility keys.

No manifestation calculation is defined here. Visibility endings, sign journeys
and station-direct events must never be written with that semantic identity.
"""

RULE_EVENTS = {
    'TRN-MER-MAN-TRN': 'mercury_sign_journey',
    'TRN-MER-RIS-W-BUL': 'mercury_turns_direct',
    'TR-MER-CMB-E-BEA': 'mercury_combustion',
    'TR-MER-RET': 'mercury_motion_retrograde',
}


def canonical_snapshot(snapshot):
    """Copy/enrich Mercury-only snapshots, retaining the calculation provenance."""
    result = dict(snapshot)
    event_type = None
    if result.get('event') == 'mercury_station_direct':
        event_type = 'mercury_turns_direct'
        result['rule_type'] = 'motion_transition'
    elif result.get('event') == 'mercury_retrograde':
        event_type = 'mercury_motion_retrograde'
    elif result.get('rule_type') == 'sign_transit':
        event_type = 'mercury_sign_journey'
    elif result.get('rule_type') == 'combust':
        event_type = 'mercury_combustion'
    if event_type:
        result.update(event_type=event_type, identity_version=1)
    return result


def assert_identity_ready(cur):
    """Fail BEFORE destructive regeneration if migration 234 is missing/drifted."""
    cur.execute("SELECT to_regclass('public.km_astro_rule_event_map')")
    if cur.fetchone()[0] is None:
        raise RuntimeError('Apply migration 234 before generating Mercury windows')
    cur.execute("""
        SELECT r.rule_code,m.event_type,d.definition_status,
               r.conditions->>'event_type',r.display_name=d.display_name
        FROM public.km_astro_rule_event_map m
        JOIN public.km_astro_rule_master r ON r.id=m.rule_id
        JOIN public.km_astro_event_definition d ON d.event_type=m.event_type
        WHERE r.rule_code=ANY(%s)
    """, (list(RULE_EVENTS),))
    rows = {r[0]: r[1:] for r in cur.fetchall()}
    for code, event in RULE_EVENTS.items():
        if rows.get(code) != (event, 'defined', event, True):
            raise RuntimeError(f'Mercury identity mismatch for {code}; inspect migration 234')
