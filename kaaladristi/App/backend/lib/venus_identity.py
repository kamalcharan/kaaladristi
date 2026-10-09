"""One database-owned implementation of Venus/conjunction sample windows."""

OWNED_RULE_CODES = frozenset({
    'BAY-R03-VEN-RET', 'TRN-VEN-RIS-W-BUL', 'TRN-VEN-RIS-E-BUL',
    'TR-VEN-CMB-W-BUL', 'CON-MER-VEN-BEA', 'CON-MER-VEN-CD-BEA', 'CON-VEN-MER-BEA',
})


def refresh_venus_data(cur):
    """Caller owns transaction. Missing migration fails before any old writer."""
    cur.execute("SELECT to_regprocedure('public.refresh_venus_event_windows()')")
    if cur.fetchone()[0] is None:
        raise RuntimeError('Apply migration 235 before generating Venus data')
    cur.execute('SELECT public.refresh_venus_event_windows()')
    return cur.fetchone()[0]
