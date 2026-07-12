import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { from } from '@/services/postgrest';
import { displaySymbol } from '@/lib/symbolUtils';
import { fetchEquityUniverse, type EquityRow } from '@/services/equityUniverse';
import { PageHeader } from '@/components/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Suggestion {
  symbol: string;
  company_name: string | null;
  reason: string | null;
}

const PIPELINE_URL = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';
const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const DISPLAY: React.CSSProperties = { fontFamily: 'var(--font-display)' };

// ── Data ──────────────────────────────────────────────────────────────────────

async function fetchIndexMeta(indexId: number): Promise<{ id: number; name: string } | null> {
  const { data, error } = await from('km_index_symbols')
    .select('id,name')
    .eq('id', indexId)
    .eq('category', 'custom')
    .execute();
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: number; name: string }[];
  return rows[0] ?? null;
}

async function fetchConstituentIds(indexId: number): Promise<number[]> {
  const { data, error } = await from('km_index_constituents')
    .select('equity_id')
    .eq('index_id', indexId)
    .execute();
  if (error) throw new Error(error.message);
  return ((data ?? []) as { equity_id: number }[]).map((r) => r.equity_id);
}

// ── Shared row ────────────────────────────────────────────────────────────────

function EquityLine({ row }: { row: EquityRow }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ ...MONO, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
        {displaySymbol(row)}
        {row.exchange === 'BSE' && (
          <span style={{ marginLeft: '6px', fontSize: '9px', fontWeight: 600, padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-faint)', verticalAlign: 'middle' }}>
            BSE
          </span>
        )}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {row.company_name ?? '—'}{row.industry ? ` · ${row.industry}` : ''}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CustomIndexManagePage() {
  const navigate = useNavigate();
  const { indexId: indexIdParam } = useParams();
  const indexId = Number(indexIdParam);
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [computing, setComputing] = useState(false);
  const [computeMsg, setComputeMsg] = useState<string | null>(null);

  const { data: meta, isLoading: metaLoading } = useQuery({
    queryKey: ['custom-index-meta', indexId],
    queryFn: () => fetchIndexMeta(indexId),
    enabled: Number.isFinite(indexId),
  });

  const { data: constituentIds = [] } = useQuery({
    queryKey: ['custom-index-constituents', indexId],
    queryFn: () => fetchConstituentIds(indexId),
    enabled: Number.isFinite(indexId),
  });

  const { data: universe = [] } = useQuery({
    queryKey: ['custom-create-equities'],
    queryFn: fetchEquityUniverse,
    staleTime: 10 * 60 * 1000,
  });

  const byId = useMemo(() => new Map(universe.map((r) => [r.id, r])), [universe]);
  const bySymbol = useMemo(() => new Map(universe.map((r) => [r.symbol, r])), [universe]);
  const memberIds = useMemo(() => new Set(constituentIds), [constituentIds]);

  const members = useMemo(
    () => constituentIds.map((id) => byId.get(id)).filter((r): r is EquityRow => !!r),
    [constituentIds, byId],
  );

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return universe
      .filter((r) => !memberIds.has(r.id))
      .filter((r) =>
        r.symbol.toLowerCase().includes(q) ||
        (r.company_name ?? '').toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [query, universe, memberIds]);

  async function refreshConstituents() {
    await queryClient.invalidateQueries({ queryKey: ['custom-index-constituents', indexId] });
    await queryClient.invalidateQueries({ queryKey: ['custom-index-counts'] });
  }

  async function addStock(row: EquityRow) {
    setMutating(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error: err } = await from('km_index_constituents')
        .insert({ index_id: indexId, equity_id: row.id, snapshot_date: today })
        .execute();
      if (err) throw new Error(err.message);
      await refreshConstituents();
      setSuggestions((prev) => prev?.filter((s) => bySymbol.get(s.symbol)?.id !== row.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setMutating(false);
    }
  }

  async function removeStock(row: EquityRow) {
    setMutating(true);
    setError(null);
    try {
      const { error: err } = await from('km_index_constituents')
        .delete()
        .eq('index_id', indexId)
        .eq('equity_id', row.id)
        .execute();
      if (err) throw new Error(err.message);
      await refreshConstituents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setMutating(false);
    }
  }

  async function calculate() {
    setComputing(true);
    setComputeMsg(null);
    setError(null);
    try {
      const res = await fetch(`${PIPELINE_URL}/api/custom-index/${indexId}/compute`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setComputeMsg(`${data.rows_computed} bars computed in ${(data.elapsed_ms / 1000).toFixed(1)}s — Sector Rotation will now show this index.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calculate failed');
    } finally {
      setComputing(false);
    }
  }

  async function suggest() {
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch(`${PIPELINE_URL}/api/custom-index/${indexId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llm: 'claude' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suggestion failed');
    } finally {
      setSuggesting(false);
    }
  }

  if (!Number.isFinite(indexId)) {
    return <div style={{ padding: '24px', color: 'var(--risk-red)' }}>Invalid index id.</div>;
  }
  if (!metaLoading && meta === null) {
    return (
      <div style={{ padding: '24px' }}>
        <p style={{ color: 'var(--risk-red)', fontSize: '13px' }}>Custom index #{indexId} not found.</p>
        <button onClick={() => navigate('/custom-index')} style={{ fontSize: '12px', color: 'var(--accent-indigo)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ← Back to Custom Index
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      <div style={{ flexShrink: 0 }}>
        <PageHeader
          eyebrow="Custom Index"
          title={
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <button onClick={() => navigate('/custom-index')} style={{ fontSize: '12px', color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ←
              </button>
              {meta?.name ?? '…'}
            </span>
          }
          meta={`${members.length} stocks`}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={calculate}
                disabled={computing}
                title="Recompute this index's synthetic EOD history (close/5D/22D/66D) and scores so it reflects the current constituent set in Sector Rotation"
                style={{
                  padding: '7px 18px', fontSize: '13px', fontWeight: 600, borderRadius: '8px',
                  border: '1px solid var(--risk-green)',
                  background: computing ? 'color-mix(in srgb, var(--text-primary) 6%, transparent)' : 'rgba(34,197,94,0.08)',
                  color: computing ? 'var(--text-faint)' : 'var(--risk-green)',
                  cursor: computing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {computing ? 'Calculating…' : '⚡ Calculate'}
              </button>
              <button
                onClick={suggest}
                disabled={suggesting}
                style={{
                  padding: '7px 18px', fontSize: '13px', fontWeight: 600, borderRadius: '8px',
                  border: '1px solid var(--accent-indigo)',
                  background: suggesting ? 'color-mix(in srgb, var(--text-primary) 6%, transparent)' : 'rgba(99,102,241,0.08)',
                  color: suggesting ? 'var(--text-faint)' : 'var(--accent-indigo)',
                  cursor: suggesting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {suggesting ? 'Analysing…' : '✨ Suggest new stocks (AI)'}
              </button>
            </div>
          }
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 24px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
          <p style={{ fontSize: '12px', color: 'var(--risk-red)', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Calculate success */}
      {computeMsg && (
        <div style={{ padding: '10px 24px', background: 'rgba(34,197,94,0.08)', borderBottom: '1px solid rgba(34,197,94,0.2)' }}>
          <p style={{ fontSize: '12px', color: 'var(--risk-green)', margin: 0 }}>{computeMsg}</p>
        </div>
      )}

      {/* Body — 3 columns: constituents / add search / AI suggestions */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '20px 24px' }}>

        {/* Constituents */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Constituents
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {members.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--text-faint)', padding: '16px' }}>No constituents.</p>
            )}
            {members.map((row) => (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                <EquityLine row={row} />
                <button
                  onClick={() => removeStock(row)}
                  disabled={mutating}
                  style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--risk-red)', background: 'transparent', color: 'var(--risk-red)', cursor: 'pointer', flexShrink: 0 }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Manual add */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol or company to add…"
              style={{ width: '100%', padding: '7px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {query.length < 2 && (
              <p style={{ fontSize: '12px', color: 'var(--text-faint)', padding: '16px' }}>Type at least 2 characters.</p>
            )}
            {query.length >= 2 && results.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--text-faint)', padding: '16px' }}>No matches outside the basket.</p>
            )}
            {results.map((row) => (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                <EquityLine row={row} />
                <button
                  onClick={() => addStock(row)}
                  disabled={mutating}
                  style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--risk-green)', background: 'transparent', color: 'var(--risk-green)', cursor: 'pointer', flexShrink: 0 }}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* AI suggestions */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            AI Suggestions
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {suggestions === null && (
              <p style={{ fontSize: '12px', color: 'var(--text-faint)', padding: '16px', lineHeight: 1.5 }}>
                Click "Suggest new stocks (AI)" to scan currently-signaling stocks that fit this theme but aren't in it yet.
              </p>
            )}
            {suggestions !== null && suggestions.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--text-faint)', padding: '16px' }}>
                No new fits found among currently-signaling stocks.
              </p>
            )}
            {(suggestions ?? []).map((s, i) => {
              const row = bySymbol.get(s.symbol);
              const already = row ? memberIds.has(row.id) : false;
              return (
                <div key={`${s.symbol}-${i}`} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...MONO, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {row ? displaySymbol(row) : s.symbol}
                        {row?.exchange === 'BSE' && (
                          <span style={{ marginLeft: '6px', fontSize: '9px', fontWeight: 600, padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-faint)', verticalAlign: 'middle' }}>
                            BSE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {s.company_name ?? row?.company_name ?? ''}
                      </div>
                    </div>
                    {row && !already ? (
                      <button
                        onClick={() => addStock(row)}
                        disabled={mutating}
                        style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--risk-green)', background: 'transparent', color: 'var(--risk-green)', cursor: 'pointer', flexShrink: 0 }}
                      >
                        + Add
                      </button>
                    ) : (
                      <span style={{ fontSize: '10px', color: 'var(--text-faint)', flexShrink: 0 }}>
                        {already ? 'in basket' : 'not in universe'}
                      </span>
                    )}
                  </div>
                  {s.reason && (
                    <p style={{ fontSize: '11px', color: 'var(--text-faint)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      {s.reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Footnote */}
      <div style={{ padding: '8px 24px 14px', flexShrink: 0 }}>
        <p style={{ fontSize: '11px', color: 'var(--text-faint)', margin: 0 }}>
          Adding/removing stocks doesn't update Sector Rotation until a compute runs. Hit "⚡ Calculate" to rebuild this index's synthetic history right now, or wait for the next daily pipeline run — either way, history is rebuilt from the current constituent set.
        </p>
      </div>

    </div>
  );
}
