import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { from } from '@/services/postgrest';
import { PageHeader } from '@/components/ui';

const PIPELINE_URL = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomIndex {
  id: number;
  name: string;
  created_at: string | null;
}

type ComputeStatus = 'idle' | 'loading' | 'done' | 'error';

// ── Data ──────────────────────────────────────────────────────────────────────

async function fetchCustomIndices(): Promise<CustomIndex[]> {
  const { data, error } = await from('km_index_symbols')
    .select('id,name,created_at')
    .eq('category', 'custom')
    .is('is_active', 'true')
    .order('created_at', { ascending: false })
    .execute();
  if (error) throw new Error(error.message);
  return (data ?? []) as CustomIndex[];
}

async function fetchConstituentCounts(ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await from('km_index_constituents')
    .select('index_id')
    .in('index_id', ids)
    .execute();
  if (error) return new Map();
  const counts = new Map<number, number>();
  for (const row of (data ?? []) as { index_id: number }[]) {
    counts.set(row.index_id, (counts.get(row.index_id) ?? 0) + 1);
  }
  return counts;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Page ──────────────────────────────────────────────────────────────────────

type DateRange = { from_date: string | null; to_date: string | null };

export default function CustomIndexPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [computeState, setComputeState] = useState<Record<number, { status: ComputeStatus; msg?: string }>>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Backfill panel
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number } | null>(null);

  async function calculateIndex(id: number, range?: DateRange) {
    setComputeState((prev) => ({ ...prev, [id]: { status: 'loading' } }));
    try {
      const res = await fetch(`${PIPELINE_URL}/api/custom-index/${id}/compute`, {
        method: 'POST',
        ...(range
          ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(range) }
          : {}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setComputeState((prev) => ({
        ...prev,
        [id]: { status: 'done', msg: `${data.rows_computed} bars in ${(data.elapsed_ms / 1000).toFixed(1)}s` },
      }));
    } catch (e) {
      setComputeState((prev) => ({
        ...prev,
        [id]: { status: 'error', msg: e instanceof Error ? e.message : 'failed' },
      }));
    }
  }

  async function runBackfillAll() {
    if (backfilling) return;
    const range: DateRange | undefined =
      fromDate || toDate ? { from_date: fromDate || null, to_date: toDate || null } : undefined;
    setBackfilling(true);
    setBackfillProgress({ done: 0, total: indices.length });
    // Sequential — the compute RPCs take a per-table advisory lock; running them
    // one index at a time avoids lock contention and keeps the DB responsive.
    for (let i = 0; i < indices.length; i++) {
      await calculateIndex(indices[i].id, range);
      setBackfillProgress({ done: i + 1, total: indices.length });
    }
    setBackfilling(false);
  }

  async function deleteIndex(id: number, name: string) {
    if (!window.confirm(
      `Delete custom index "${name}"?\n\nThis permanently removes its synthetic price history and constituent list. This cannot be undone.`,
    )) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${PIPELINE_URL}/api/custom-index/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      await queryClient.invalidateQueries({ queryKey: ['custom-indices'] });
    } catch (e) {
      window.alert(`Delete failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  }

  const { data: indices = [], isLoading } = useQuery({
    queryKey: ['custom-indices'],
    queryFn: fetchCustomIndices,
    staleTime: 60 * 1000,
  });

  const { data: counts = new Map() } = useQuery({
    queryKey: ['custom-index-counts', indices.map((i) => i.id)],
    queryFn: () => fetchConstituentCounts(indices.map((i) => i.id)),
    enabled: indices.length > 0,
    staleTime: 60 * 1000,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      <div style={{ flexShrink: 0 }}>
        <PageHeader
          eyebrow="Custom Index"
          title="Custom Index"
          meta="NSE Only"
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setBackfillOpen((o) => !o)}
                title="Recompute synthetic EOD + indicators for all custom indices over a date range"
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: `1px solid ${backfillOpen ? 'var(--accent-indigo)' : 'var(--border)'}`,
                  background: backfillOpen ? 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)' : 'transparent',
                  color: backfillOpen ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                ⟳ Backfill
              </button>
              <button
                onClick={() => navigate('/custom-index/create')}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                + Create Manually
              </button>
              <button
                onClick={() => navigate('/custom-index/discover')}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: '1px solid var(--accent-indigo)',
                  background: 'rgba(99,102,241,0.08)',
                  color: 'var(--accent-indigo)',
                  cursor: 'pointer',
                }}
              >
                ✨ Discover with AI
              </button>
            </div>
          }
        />
      </div>

      {/* Backfill panel */}
      {backfillOpen && (
        <div style={{ flexShrink: 0, padding: '0 24px 12px' }}>
          <div style={{
            border: '1px solid var(--border)', borderRadius: '10px',
            background: 'var(--card)', padding: '14px 18px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Backfill all custom indices
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '12px', lineHeight: 1.5 }}>
              Recomputes synthetic EOD + scores + indicators (ema / rsi / magic RS / flow) for every custom index.
              Leave both dates empty for full history. Runs one index at a time.
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                From
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={backfilling}
                  style={{
                    padding: '6px 10px', fontSize: '13px', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)',
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                To
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  disabled={backfilling}
                  style={{
                    padding: '6px 10px', fontSize: '13px', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)',
                  }}
                />
              </label>
              <button
                onClick={() => void runBackfillAll()}
                disabled={backfilling || indices.length === 0}
                style={{
                  padding: '7px 16px', fontSize: '13px', borderRadius: '8px',
                  border: '1px solid var(--accent-indigo)',
                  background: 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)', color: 'var(--accent-indigo)',
                  cursor: backfilling ? 'not-allowed' : 'pointer', fontWeight: 600,
                }}
              >
                {backfilling && backfillProgress
                  ? `Backfilling ${backfillProgress.done}/${backfillProgress.total}…`
                  : `Run backfill (${indices.length} ${indices.length === 1 ? 'index' : 'indices'})`}
              </button>
              {(fromDate || toDate) && !backfilling && (
                <button
                  onClick={() => { setFromDate(''); setToDate(''); }}
                  style={{
                    padding: '7px 12px', fontSize: '12px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text-faint)', cursor: 'pointer',
                  }}
                >
                  Clear dates
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

        {/* Loading */}
        {isLoading && (
          <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  height: '60px',
                  borderRadius: '10px',
                  background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        )}

        {/* Populated list */}
        {!isLoading && indices.length > 0 && (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {indices.map((idx) => (
              <div
                key={idx.id}
                onClick={() => navigate(`/sector-rotation/${idx.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 18px',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  background: 'var(--card)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-indigo)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(99,102,241,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    flexShrink: 0,
                  }}
                >
                  ⊞
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {idx.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>
                    Created {fmtDate(idx.created_at)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {counts.get(idx.id) ?? '—'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    stocks
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void calculateIndex(idx.id);
                  }}
                  disabled={computeState[idx.id]?.status === 'loading'}
                  title={
                    computeState[idx.id]?.msg
                      ?? "Compute this index's synthetic EOD history + scores so it shows up correctly in Sector Rotation -> Custom"
                  }
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${
                      computeState[idx.id]?.status === 'error' ? 'var(--risk-red)'
                      : computeState[idx.id]?.status === 'done' ? 'var(--risk-green)'
                      : 'var(--risk-green)'
                    }`,
                    background: computeState[idx.id]?.status === 'loading' ? 'color-mix(in srgb, var(--text-primary) 6%, transparent)' : 'transparent',
                    color: computeState[idx.id]?.status === 'error' ? 'var(--risk-red)' : 'var(--risk-green)',
                    cursor: computeState[idx.id]?.status === 'loading' ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {computeState[idx.id]?.status === 'loading' ? 'Calculating…'
                    : computeState[idx.id]?.status === 'done' ? '✓ Calculated'
                    : computeState[idx.id]?.status === 'error' ? '✕ Retry'
                    : '⚡ Calculate'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/custom-index/${idx.id}/manage`);
                  }}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  ✎ Manage
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteIndex(idx.id, idx.name);
                  }}
                  disabled={deletingId === idx.id}
                  title="Delete this custom index"
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--risk-red)',
                    background: 'transparent',
                    color: 'var(--risk-red)',
                    cursor: deletingId === idx.id ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    opacity: deletingId === idx.id ? 0.5 : 1,
                  }}
                >
                  {deletingId === idx.id ? 'Deleting…' : '🗑 Delete'}
                </button>
                <div style={{ fontSize: '14px', color: 'var(--text-faint)', flexShrink: 0 }}>›</div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && indices.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <div
              style={{
                textAlign: 'center',
                padding: '48px 32px',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                background: 'var(--card)',
                maxWidth: '360px',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '16px', opacity: 0.4 }}>⊞</div>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  margin: '0 0 8px',
                }}
              >
                No custom indices yet
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Use the buttons above to create your first basket
              </p>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
