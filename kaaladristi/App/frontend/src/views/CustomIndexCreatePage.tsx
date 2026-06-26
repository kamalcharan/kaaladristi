import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { from } from '@/services/postgrest';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EquityRow {
  id: number;
  symbol: string;
  company_name: string | null;
  industry: string | null;
}

// ── Data fetch — shares ['search-index'] cache with SearchStrip ───────────────

async function fetchNseEquities(): Promise<EquityRow[]> {
  const { data, error } = await from('km_equity_symbols')
    .select('id,symbol,company_name,industry')
    .eq('exchange', 'NSE')
    .is('is_active', 'true')
    .order('symbol', { ascending: true })
    .limit(8000)
    .execute();
  if (error) throw new Error(error.message);
  return (data ?? []) as EquityRow[];
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
          {row.symbol}
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

export default function CustomIndexCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const [basket, setBasket] = useState<EquityRow[]>([]);

  const { data: equities = [] } = useQuery({
    queryKey: ['search-index-nse'],
    queryFn: fetchNseEquities,
    staleTime: 10 * 60 * 1000,
  });

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

  const canSave = name.trim().length > 0 && basket.length > 0;

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
              disabled={!canSave}
              style={{
                padding: '9px 0',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                background: canSave ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.06)',
                color: canSave ? '#fff' : 'var(--text-faint)',
                cursor: canSave ? 'pointer' : 'not-allowed',
                width: '100%',
              }}
            >
              Save Index
            </button>
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
