import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { from } from '@/services/postgrest';
import { displaySymbol, isNumericSymbol } from '@/lib/symbolUtils';
import { PageHeader } from '@/components/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ThemeEntry {
  symbol: string;
  company_name?: string | null;
  role?: string | null;
}

interface Theme {
  id: number;
  theme_name: string;
  description: string;
  rationale: string;
  constituent_symbols: string[];
  llm?: string;
  discovered_at?: string;
  source?: string; // 'auto' | 'targeted'
  detail?: { core?: ThemeEntry[]; ecosystem?: ThemeEntry[] } | null;
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
  const [targetName, setTargetName] = useState('');
  const [targeting, setTargeting] = useState(false);
  // symbol → company_name for numeric BSE scrip codes in the loaded themes,
  // so chips read "Triveni Engineering" instead of "500097" (displaySymbol
  // convention — same as scanners/catalog).
  const [nameBySymbol, setNameBySymbol] = useState<Map<string, string>>(new Map());

  const numericSymbols = useMemo(() => {
    const out = new Set<string>();
    for (const t of themes ?? []) {
      for (const s of t.constituent_symbols ?? []) if (isNumericSymbol(s)) out.add(s);
      for (const g of ['core', 'ecosystem'] as const) {
        for (const e of t.detail?.[g] ?? []) {
          if (!e.company_name && isNumericSymbol(e.symbol)) out.add(e.symbol);
        }
      }
    }
    return [...out].sort();
  }, [themes]);

  useEffect(() => {
    const missing = numericSymbols.filter(s => !nameBySymbol.has(s));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await from('km_equity_symbols')
        .select('symbol,company_name')
        .in('symbol', missing)
        .execute();
      if (cancelled || err || !Array.isArray(data)) return;
      setNameBySymbol(prev => {
        const next = new Map(prev);
        for (const r of data as { symbol: string; company_name: string | null }[]) {
          if (r.company_name) next.set(r.symbol, r.company_name);
        }
        return next;
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericSymbols]);

  /** Chip label: NSE ticker as-is; numeric BSE code → short company name. */
  const chipLabel = (symbol: string, companyName?: string | null) =>
    displaySymbol({ symbol, company_name: companyName ?? nameBySymbol.get(symbol) ?? null });

  // Load persisted recommendations (staging table, migration 120) on mount —
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

  async function target() {
    const name = targetName.trim();
    if (!name) return;
    setTargeting(true);
    setError(null);
    try {
      const res = await fetch(`${PIPELINE_URL}/api/custom-index/target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_name: name, llm }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.theme) {
        setThemes((prev) => [data.theme, ...(prev ?? [])]);
        setTargetName('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Targeted discovery failed');
    } finally {
      setTargeting(false);
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

      <div style={{ flexShrink: 0 }}>
        <PageHeader
          eyebrow="Custom Index"
          title={
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <button
                onClick={() => navigate('/custom-index')}
                style={{ fontSize: '12px', color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ←
              </button>
              Discover with AI
            </span>
          }
          meta="NSE + Liquid BSE"
          actions={
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
                  background: loading ? 'color-mix(in srgb, var(--text-primary) 6%, transparent)' : 'var(--accent-indigo)',
                  color: loading ? 'var(--text-faint)' : '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {loading ? 'Discovering…' : 'Discover Themes'}
              </button>
            </div>
          }
        />
      </div>

      {/* Targeted discovery bar */}
      <div
        style={{
          padding: '10px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          Or search a specific theme:
        </span>
        <input
          value={targetName}
          onChange={(e) => setTargetName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !targeting) void target(); }}
          placeholder='e.g. "Data Centers" — AI finds core + ecosystem stocks'
          style={{
            flex: 1,
            maxWidth: '420px',
            padding: '7px 12px',
            fontSize: '12px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          onClick={() => void target()}
          disabled={targeting || targetName.trim().length === 0}
          style={{
            padding: '7px 16px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '8px',
            border: '1px solid var(--accent-indigo)',
            background: targeting ? 'color-mix(in srgb, var(--text-primary) 6%, transparent)' : 'rgba(99,102,241,0.08)',
            color: targeting || targetName.trim().length === 0 ? 'var(--text-faint)' : 'var(--accent-indigo)',
            cursor: targeting || targetName.trim().length === 0 ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {targeting ? 'Searching…' : '🎯 Find Stocks'}
        </button>
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
                  Select a model and click "Discover Themes" to scan active NSE stocks (plus
                  liquid BSE-only listings) with accumulation signals and surface cohesive
                  sub-themes. Results are saved — they'll still be here next time without
                  another AI call.
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
                  background: 'var(--card)',
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
                  {(theme.llm || theme.discovered_at || theme.source === 'targeted') && (
                    <span style={{ ...MONO, fontSize: '9px', color: 'var(--text-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {[theme.source === 'targeted' ? '🎯 targeted' : null, theme.llm, agoLabel(theme.discovered_at)].filter(Boolean).join(' · ')}
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
                {theme.detail && ((theme.detail.core?.length ?? 0) + (theme.detail.ecosystem?.length ?? 0)) > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                    {(['core', 'ecosystem'] as const).map((group) => {
                      const entries = theme.detail?.[group] ?? [];
                      if (entries.length === 0) return null;
                      const isCore = group === 'core';
                      return (
                        <div key={group}>
                          <div style={{ ...MONO, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: isCore ? 'var(--accent-indigo)' : 'var(--text-faint)', marginBottom: '4px' }}>
                            {isCore ? 'Core' : 'Ecosystem'} · {entries.length}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {entries.map((e) => (
                              <span
                                key={e.symbol}
                                title={[
                                  e.company_name ?? nameBySymbol.get(e.symbol),
                                  isNumericSymbol(e.symbol) ? `BSE ${e.symbol}` : null,
                                  e.role,
                                ].filter(Boolean).join(' — ')}
                                style={{
                                  ...MONO,
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  border: `1px solid ${isCore ? 'var(--accent-indigo)' : 'var(--border)'}`,
                                  color: isCore ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                                  background: isCore ? 'rgba(99,102,241,0.08)' : 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
                                  cursor: 'default',
                                }}
                              >
                                {chipLabel(e.symbol, e.company_name)}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '2px' }}>
                    {(theme.constituent_symbols ?? []).map((sym) => (
                      <span
                        key={sym}
                        title={isNumericSymbol(sym)
                          ? [nameBySymbol.get(sym), `BSE ${sym}`].filter(Boolean).join(' — ')
                          : undefined}
                        style={{
                          ...MONO,
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                          background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
                        }}
                      >
                        {chipLabel(sym)}
                      </span>
                    ))}
                  </div>
                )}
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
