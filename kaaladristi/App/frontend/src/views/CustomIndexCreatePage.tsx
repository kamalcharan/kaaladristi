import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { from } from '@/services/postgrest';
import { displaySymbol } from '@/lib/symbolUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EquityRow {
  id: number;
  symbol: string;
  company_name: string | null;
  industry: string | null;
  exchange: string;
  isin: string | null;
}

// ── Data fetch — NSE priority + BSE-only additions (ISIN dedup) ───────────────

async function fetchEquityUniverse(): Promise<EquityRow[]> {
  const { data, error } = await from('km_equity_symbols')
    .select('id,symbol,company_name,industry,exchange,isin')
    .is('is_active', 'true')
    .order('symbol', { ascending: true })
    .limit(8000)
    .execute();
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as EquityRow[];
  // NSE is the priority exchange: include a BSE scrip only when its ISIN has
  // no active NSE listing (mirrors the discover endpoint's universe rule).
  const nseIsins = new Set(
    rows.filter((r) => r.exchange === 'NSE' && r.isin).map((r) => r.isin as string),
  );
  return rows.filter(
    (r) => r.exchange === 'NSE' || (r.isin !== null && !nseIsins.has(r.isin)),
  );
}

// ── RowItem ───────────────────────────────────────────────────────────────────

function RowItem({
  row,
  action,
  actionLabel,
  actionColor,
}: {
  row: EquityRow;
  action: () => void;
  actionLabel: string;
  actionColor: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
          {displaySymbol(row)}
          {row.exchange === 'BSE' && (
            <span
              style={{
                marginLeft: '6px',
                fontSize: '9px',
                fontWeight: 600,
                padding: '1px 5px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                color: 'var(--text-faint)',
                verticalAlign: 'middle',
              }}
            >
              BSE
            </span>
          )}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.company_name ?? '—'}{row.industry ? ` · ${row.industry}` : ''}
        </div>
      </div>
      <button
        onClick={action}
        style={{
          fontSize: '11px',
          padding: '3px 8px',
          borderRadius: '6px',
          border: `1px solid ${actionColor}`,
          background: 'transparent',
          color: actionColor,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface LocationState {
  name?: string;
  constituents?: { symbol: string }[];
}

export default function CustomIndexCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const [basket, setBasket] = useState<EquityRow[]>([]);

  const { data: equities = [] } = useQuery({
    queryKey: ['custom-create-equities'],
    queryFn: fetchEquityUniverse,
    staleTime: 10 * 60 * 1000,
  });

  const prePopulated = useRef(false);

  useEffect(() => {
    if (prePopulated.current || equities.length === 0) return;
    const state = location.state as LocationState | null;
    if (!state?.name || !state?.constituents) return;
    prePopulated.current = true;
    setName(state.name);
    const symbolMap = new Map(equities.map((r) => [r.symbol, r]));
    const resolved = state.constituents
      .map((c) => symbolMap.get(c.symbol))
      .filter((r): r is EquityRow => r !== undefined);
    if (resolved.length > 0) setBasket(resolved);
  }, [equities, location.state]);

  const basketIds = useMemo(() => new Set(basket.map((r) => r.id)), [basket]);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return equities
      .filter((r) => !basketIds.has(r.id))
      .filter((r) =>
        r.symbol.toLowerCase().includes(q) ||
        (r.company_name ?? '').toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [query, equities, basketIds]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && basket.length > 0;

  const saveIndex = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const { data: idxData, error: idxErr } = await from('km_index_symbols')
        .insert({ name: name.trim(), category: 'custom', exchange: 'NSE', is_active: true })
        .execute();
      if (idxErr) throw new Error(idxErr.message);
      const newIndex = Array.isArray(idxData) ? idxData[0] : idxData;
      if (!newIndex?.id) throw new Error('Insert succeeded but returned no id');

      const today = new Date().toISOString().split('T')[0];
      const rows = basket.map((r) => ({
        index_id: newIndex.id,
        equity_id: r.id,
        snapshot_date: today,
      }));
      const { error: constErr } = await from('km_index_constituents')
        .insert(rows)
        .execute();
      if (constErr) throw new Error(constErr.message);

      navigate('/custom-index');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [name, basket, navigate]);

  function addToBasket(row: EquityRow) {
    setBasket((prev) => [...prev, row]);
  }

  function removeFromBasket(id: number) {
    setBasket((prev) => prev.filter((r) => r.id !== id));
  }

  const panelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    borderRight: '1px solid var(--border)',
    overflow: 'hidden',
  };

  const panelHeaderStyle: React.CSSProperties = {
    padding: '16px 20px 12px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  };

  const scrollStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* ── Left: form ───────────────────────────────────────────────────── */}
      <div style={{ ...panelStyle, width: '280px', flexShrink: 0 }}>
        <div style={panelHeaderStyle}>
          <button
            onClick={() => navigate('/custom-index')}
            style={{
              fontSize: '12px',
              color: 'var(--text-faint)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 0 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ← Back
          </button>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              margin: '0 0 4px',
              letterSpacing: '-0.01em',
            }}
          >
            Create Custom Index
          </h1>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-faint)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
            }}
          >
            NSE Only
          </span>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Index Name <span style={{ color: 'var(--risk-red)' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Pharma Basket"
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '13px',
                color: 'var(--text-primary)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this basket"
              rows={3}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '13px',
                color: 'var(--text-primary)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              disabled={!canSave || saving}
              onClick={saveIndex}
              style={{
                padding: '9px 0',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                background: canSave && !saving ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.06)',
                color: canSave && !saving ? '#fff' : 'var(--text-faint)',
                cursor: canSave && !saving ? 'pointer' : 'not-allowed',
                width: '100%',
              }}
            >
              {saving ? 'Saving…' : 'Save Index'}
            </button>
            {saveError && (
              <p style={{ fontSize: '11px', color: 'var(--risk-red)', margin: '4px 0 0', lineHeight: 1.4 }}>
                {saveError}
              </p>
            )}
            <button
              onClick={() => navigate('/custom-index')}
              style={{
                padding: '9px 0',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* ── Center: search ───────────────────────────────────────────────── */}
      <div style={{ ...panelStyle, flex: 1 }}>
        <div style={panelHeaderStyle}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 10px' }}>
            Add Constituents
          </h2>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbol or company name…"
            style={{
              width: '100%',
              padding: '7px 10px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={scrollStyle}>
          {query.length < 2 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-faint)' }}>Type at least 2 characters to search</p>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-faint)' }}>No matches for "{query}"</p>
            </div>
          ) : (
            results.map((row) => (
              <RowItem
                key={row.id}
                row={row}
                action={() => addToBasket(row)}
                actionLabel="+ Add"
                actionColor="var(--accent-indigo)"
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right: basket ────────────────────────────────────────────────── */}
      <div style={{ ...panelStyle, width: '300px', flexShrink: 0, borderRight: 'none' }}>
        <div style={panelHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Basket
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                padding: '1px 7px',
                borderRadius: '100px',
                background: basket.length > 0 ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.08)',
                color: basket.length > 0 ? '#fff' : 'var(--text-faint)',
              }}
            >
              {basket.length}
            </span>
          </div>
        </div>

        <div style={scrollStyle}>
          {basket.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-faint)' }}>No constituents added yet</p>
            </div>
          ) : (
            basket.map((row) => (
              <RowItem
                key={row.id}
                row={row}
                action={() => removeFromBasket(row.id)}
                actionLabel="×"
                actionColor="var(--risk-red)"
              />
            ))
          )}
        </div>
      </div>

    </div>
  );
}
