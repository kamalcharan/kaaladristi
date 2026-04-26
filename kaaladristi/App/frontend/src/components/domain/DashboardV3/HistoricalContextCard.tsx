import { useQuery } from '@tanstack/react-query';

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL as string | undefined)?.trim() ?? 'http://localhost:8101';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoricalContext {
  available: boolean;
  date?: string;
  conditions?: {
    vara: string;
    nakshatra: string;
    nakshatra_lord: string;
    paksha: string;
    breadth_regime: string;
    breadth_score: number | null;
  };
  historical?: {
    occurrences: number;
    positive_pct: number | null;
    avg_return: number | null;
    recent: { date: string; return: number }[];
  };
}

async function fetchContext(date: string): Promise<HistoricalContext> {
  const res = await fetch(`${PIPELINE_API}/api/dashboard/context?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtReturn(val: number): string {
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HistoricalContextCard({ date }: { date: string }) {
  const { data, isLoading, isError } = useQuery<HistoricalContext>({
    queryKey: ['dashboard_context', date],
    queryFn: () => fetchContext(date),
    staleTime: 15 * 60 * 1000,
    retry: false,
  });

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 18px',
      fontFamily: 'var(--font-mono)',
    }}>
      {/* Header */}
      <div style={{
        fontSize: 9,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--text-faint)',
        marginBottom: 14,
      }}>
        Historical Context
      </div>

      {isLoading && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', paddingBottom: 4 }}>
          Loading…
        </div>
      )}

      {isError && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', paddingBottom: 4 }}>
          Unavailable — backend offline
        </div>
      )}

      {data && !data.available && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', paddingBottom: 4 }}>
          No panchāṅgam data for this date
        </div>
      )}

      {data?.available && data.conditions && data.historical && (() => {
        const { conditions, historical } = data;
        const { occurrences, positive_pct, avg_return, recent } = historical;

        return (
          <>
            {/* Condition line */}
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2, lineHeight: 1.5 }}>
              {conditions.vara} · {conditions.nakshatra_lord} Nakshatra · {conditions.paksha}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 14 }}>
              Breadth: {conditions.breadth_regime}
            </div>

            {/* Stats block */}
            {occurrences === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 14 }}>
                No historical data for this combination
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', marginBottom: 14 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Similar days since 2007</span>
                  <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>
                    {occurrences < 20 ? `${occurrences} (limited data)` : occurrences}
                  </span>

                  <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Nifty positive</span>
                  <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>
                    {positive_pct !== null ? `${positive_pct.toFixed(1)}%` : '—'}
                  </span>

                  <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Average day return</span>
                  <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>
                    {avg_return !== null ? fmtReturn(avg_return) : '—'}
                  </span>
                </div>

                {/* Recent occurrences */}
                {recent.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 6 }}>
                      Recent occurrences
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 14 }}>
                      {recent.map(r => (
                        <div key={r.date} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                        }}>
                          <span>{fmtDate(r.date)}</span>
                          <span style={{ color: 'var(--text-primary)' }}>{fmtReturn(r.return)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Divider + disclaimer */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
                Historical data only. Not a forecast.
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
