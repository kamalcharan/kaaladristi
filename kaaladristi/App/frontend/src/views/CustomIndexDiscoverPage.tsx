import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Theme {
  id: number;
  theme_name: string;
  description: string;
  rationale: string;
  constituent_symbols: string[];
  llm?: string;
  discovered_at?: string;
}

type Llm = 'claude' | 'qwen';

// ── Page ──────────────────────────────────────────────────────────────────────

const PIPELINE_URL = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const DISPLAY: React.CSSProperties = { fontFamily: 'var(--font-display)' };

function agoLabel(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CustomIndexDiscoverPage() {
  const navigate = useNavigate();
  const [llm, setLlm] = useState<Llm>('claude');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themes, setThemes] = useState<Theme[] | null>(null);

  // Load persisted recommendations (staging table, migration 097) on mount —
  // past discoveries survive navigation without re-invoking the LLM.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${PIPELINE_URL}/api/custom-index/themes?status=new`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.themes) && data.themes.length > 0) {
          setThemes(data.themes);
        }
      } catch {
        // staging table not reachable — page still works, just without history
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function discover() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${PIPELINE_URL}/api/custom-index/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llm }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      // Newest first; keep previously staged themes visible below the fresh batch.
      setThemes((prev) => [...(data.themes ?? []), ...(prev ?? []).filter(
        (p) => !(data.themes ?? []).some((n: Theme) => n.id === p.id),
      )]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setLoading(false);
    }
  }

  async function setThemeStatus(id: number | undefined, status: 'used' | 'dismissed') {
    if (!id) return; // pre-persistence theme (staging insert failed) — nothing to update
    try {
      await fetch(`${PIPELINE_URL}/api/custom-index/themes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch {
      // non-fatal — worst case the theme reappears next visit
    }
  }

  function useTheme(theme: Theme) {
    void setThemeStatus(theme.id, 'used');
    navigate('/custom-index/create', {
      state: {
        name: theme.theme_name,
        constituents: theme.constituent_symbols.map((s) => ({ symbol: s })),
      },
    });
  }

  function dismissTheme(theme: Theme) {
    void setThemeStatus(theme.id, 'dismissed');
    setThemes((prev) => (prev ?? []).filter((t) => t !== theme));
  }

  function LlmBtn({ value, label }: { value: Llm; label: string }) {
    const active = llm === value;
    return (
      <button
        onClick={() => setLlm(value)}
        style={{
          flex: 1,
          padding: '7px 0',
          fontSize: '12px',
          fontWeight: active ? 600 : 400,
          borderRadius: '8px',
          border: `1px solid ${active ? 'var(--accent-indigo)' : 'var(--border)'}`,
          background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
          color: active ? 'var(--accent-indigo)' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Header */}
      <div
        style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <button
            onClick={() => navigate('/custom-index')}
            style={{ fontSize: '12px', color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px' }}
          >
            ←
          </button>
          <h1 style={{ ...DISPLAY, fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
            Discover with AI
          </h1>
          <span style={{ ...MONO, fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            NSE Only
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', width: '260px' }}>
            <LlmBtn value="claude" label="Claude (Sonnet 4.6)" />
            <LlmBtn value="qwen" label="Qwen3 (Local)" />
          </div>
          <button
            onClick={discover}
            disabled={loading}
            style={{
              padding: '7px 18px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              background: loading ? 'rgba(255,255,255,0.06)' : 'var(--accent-indigo)',
              color: loading ? 'var(--text-faint)' : '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Discovering…' : 'Discover Themes'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 24px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
          <p style={{ fontSize: '12px', color: 'var(--risk-red)', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {themes === null ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center', maxWidth: '380px' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px', opacity: 0.4 }}>✨</div>
              <p style={{ ...DISPLAY, fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                {initialLoading ? 'Loading saved themes…' : 'Find emerging themes'}
              </p>
              {!initialLoading && (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  Select a model and click "Discover Themes" to scan active NSE stocks with
                  accumulation signals and surface cohesive sub-themes. Results are saved —
                  they'll still be here next time without another AI call.
                </p>
              )}
            </div>
          </div>
        ) : themes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-faint)' }}>No themes identified — try again or adjust signal conditions.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '16px',
              alignItems: 'start',
            }}
          >
            {themes.map((theme, i) => (
              <div
                key={theme.id ?? `fresh-${i}`}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  background: 'var(--surface)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                  <p style={{ ...DISPLAY, fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                    {theme.theme_name}
                  </p>
                  {(theme.llm || theme.discovered_at) && (
                    <span style={{ ...MONO, fontSize: '9px', color: 'var(--text-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {[theme.llm, agoLabel(theme.discovered_at)].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {theme.description}
                </p>
                {theme.rationale && (
                  <p style={{ fontSize: '11px', color: 'var(--text-faint)', margin: 0, lineHeight: 1.5 }}>
                    {theme.rationale}
                  </p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '2px' }}>
                  {(theme.constituent_symbols ?? []).map((sym) => (
                    <span
                      key={sym}
                      style={{
                        ...MONO,
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        background: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      {sym}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    onClick={() => useTheme(theme)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: '1px solid var(--accent-indigo)',
                      background: 'rgba(99,102,241,0.08)',
                      color: 'var(--accent-indigo)',
                      cursor: 'pointer',
                    }}
                  >
                    Use this theme →
                  </button>
                  <button
                    onClick={() => dismissTheme(theme)}
                    title="Dismiss — hides this recommendation permanently"
                    style={{
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text-faint)',
                      cursor: 'pointer',
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
