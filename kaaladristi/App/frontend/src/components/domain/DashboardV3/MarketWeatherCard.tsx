import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// ── Part 1: Types, helpers, sample data ──────────────────────────────────────

export interface MarketWeatherProps {
  date: string;
  composite_score: number;
  composite_label: string;
  composite_icon: string;
  components: {
    astro: {
      score: number;
      positive: number;
      negative: number;
      turning: number;
      mixed: number;
      total: number;
      avg_pos_conf: number;
      avg_neg_conf: number;
      avg_trn_conf: number;
    };
    roc: {
      roc_13: number;
      roc_13_prev: number;
      normalized: number;
      sma_breadth?: number;
    };
    breadth: {
      breadth_score: number;
      normalized: number;
    };
  };
}

// ── Helper: bar fill color based on 0-1 normalized score ─────────────────────

function barColor(normalized: number): string {
  if (normalized >= 0.70) return '#22c55e';
  if (normalized >= 0.60) return '#14b8a6';
  if (normalized >= 0.45) return '#f59e0b';
  if (normalized >= 0.35) return '#f97316';
  return '#ef4444';
}

// ── Helper: ROC crossover color ───────────────────────────────────────────────

function rocCrossoverColor(roc_13: number, sma_breadth: number | undefined): string {
  const s = sma_breadth ?? 0;
  if (roc_13 > 0 && roc_13 > s) return '#22c55e';   // accelerating — green
  if (roc_13 > 0 && roc_13 <= s) return '#f97316';  // decelerating — orange
  if (roc_13 <= 0 && roc_13 > s) return '#f59e0b';  // recovering — amber
  return '#ef4444';                                   // falling — red
}

// ── Helper: momentum arrow + color from ROC delta ────────────────────────────

function rocArrow(roc_13: number, roc_13_prev: number): { glyph: string; color: string } {
  const delta = roc_13 - roc_13_prev;
  if (delta > 0.1)  return { glyph: '↗', color: '#22c55e' };
  if (delta < -0.1) return { glyph: '↘', color: '#ef4444' };
  return { glyph: '→', color: '#D4A853' };
}

// ── Helper: composite score → label + icon ────────────────────────────────────

function compositeLabel(score: number): { label: string; icon: string } {
  if (score > 70) return { label: 'High Positive Alignment', icon: '☀️' };
  if (score > 60) return { label: 'Moderate Positive',       icon: '🌤' };
  if (score > 45) return { label: 'Mixed Signals',           icon: '🌥' };
  if (score > 35) return { label: 'Moderate Negative',       icon: '🌦' };
  return           { label: 'High Negative Alignment',       icon: '🌧' };
}

// ── Helper: ROC value → text label ───────────────────────────────────────────

function rocLabel(roc_13: number): string {
  if (roc_13 > 3)  return 'Expanding';
  if (roc_13 > 1)  return 'Accelerating';
  if (roc_13 > 0)  return 'Decelerating';
  if (roc_13 > -1) return 'Stabilising';
  return 'Contracting';
}

// ── Helper: breadth score → text label ───────────────────────────────────────

function breadthLabel(score: number): string {
  if (score > 55) return 'Elevated';
  if (score > 35) return 'Moderate';
  return 'Depressed';
}

// ── Sample data (hardcoded — no API call) ─────────────────────────────────────

const sampleData: MarketWeatherProps = {
  date: '2026-04-25',
  composite_score: 62,
  composite_label: 'Moderate Positive',
  composite_icon: '🌤',
  components: {
    astro: {
      score: 73.4,
      positive: 4,
      negative: 1,
      turning: 0,
      mixed: 0,
      total: 5,
      avg_pos_conf: 73.4,
      avg_neg_conf: 55.0,
      avg_trn_conf: 0,
    },
    roc: {
      roc_13: 0.86,
      roc_13_prev: 1.09,
      normalized: 0.50,
      sma_breadth: 1.09,
    },
    breadth: {
      breadth_score: 51.57,
      normalized: 0.5157,
    },
  },
};

// ── Historical context types + helpers ───────────────────────────────────────

interface HistoricalContext {
  available: boolean;
  conditions?: {
    vara: string;
    nakshatra: string;
    nakshatra_lord: string;
    paksha: string;
    breadth_regime: string;
  };
  historical?: {
    occurrences: number;
    positive_pct: number | null;
    avg_return: number | null;
    recent: { date: string; return: number }[];
  };
}

function fmtReturn(val: number): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

function fmtHistDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

// Injected once; prefixed to avoid clashing with other animations.
const HISTORY_CSS = `
  @keyframes kd-pulse-opacity {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1.0; }
  }
  .kd-hist-pulse { animation: kd-pulse-opacity 2s ease-in-out infinite; }
  .kd-hist-pulse.seen { animation: none; opacity: 0.7; }
  .kd-hist-chevron { transition: transform 0.25s ease; }
  .kd-hist-chevron.open { transform: rotate(180deg); }
`;

// ── HistoryPanel: renders inside the expandable section ──────────────────────

function HistoryPanel({ ctx }: { ctx: HistoricalContext }) {
  if (!ctx.available || !ctx.conditions || !ctx.historical) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', padding: '4px 0 8px' }}>
        No panchāṅgam data for this date
      </div>
    );
  }
  const { conditions: c, historical: h } = ctx;
  return (
    <div style={{ fontFamily: 'var(--font-mono)' }}>
      {/* Condition line */}
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2, lineHeight: 1.5 }}>
        {c.vara} · {c.nakshatra_lord} Nakshatra · {c.paksha}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 12 }}>
        Breadth: {c.breadth_regime}
      </div>

      {h.occurrences === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12 }}>
          No historical data for this combination
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px', marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Similar days since 2007</span>
            <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>
              {h.occurrences < 20 ? `${h.occurrences} (limited data)` : h.occurrences}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Nifty positive</span>
            <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>
              {h.positive_pct !== null ? `${h.positive_pct.toFixed(1)}%` : '—'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Average day return</span>
            <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>
              {h.avg_return !== null ? fmtReturn(h.avg_return) : '—'}
            </span>
          </div>

          {h.recent.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 5 }}>
                Recent occurrences
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {h.recent.map(r => (
                  <div key={r.date} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{fmtHistDate(r.date)}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{fmtReturn(r.return)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
          Historical data only. Not a forecast.
        </span>
      </div>
    </div>
  );
}

// ── Part 2: Header section ────────────────────────────────────────────────────

function CardHeader({ data }: { data: MarketWeatherProps }) {
  const { label, icon } = compositeLabel(data.composite_score);

  const formattedDate = new Date(data.date + 'T00:00:00Z').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div
      style={{
        padding: '16px 20px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.16em',
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
          }}
        >
          Astro-Technical Alignment
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.1em',
            color: 'var(--text-faint)',
          }}
        >
          {formattedDate}
        </span>
      </div>

      {/* Score + icon centred */}
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 32, lineHeight: 1 }}>{icon}</span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 52,
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: '#D4A853',
            }}
          >
            {Math.round(data.composite_score)}
          </span>
        </div>
      </div>

      {/* Label */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      </div>

      {/* Signal count sub-label */}
      <div style={{ textAlign: 'center' }}>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            color: 'var(--text-faint)',
          }}
        >
          Based on {data.components.astro.total} nak-vara rule signal{data.components.astro.total !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

// ── Part 3: Metric bar row ────────────────────────────────────────────────────

interface BarRowProps {
  label: string;
  normalized: number;
  rightLabel: string;
  rightSub?: string;
  arrowGlyph?: string;
  arrowColor?: string;
  colorOverride?: string;
}

function BarRow({ label, normalized, rightLabel, rightSub, arrowGlyph, arrowColor, colorOverride }: BarRowProps) {
  const pct = Math.round(normalized * 100);
  const color = colorOverride ?? barColor(normalized);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr auto',
        alignItems: 'center',
        gap: 10,
        padding: '9px 20px',
      }}
    >
      {/* Label */}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>

      {/* Bar track */}
      <div
        style={{
          height: 5,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.07)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 3,
            background: color,
            transition: 'width 0.5s ease',
          }}
        />
      </div>

      {/* Right: pct + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 110, justifyContent: 'flex-end' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color,
            fontWeight: 600,
          }}
        >
          {pct}%
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 10,
            color: 'var(--text-secondary)',
          }}
        >
          {rightLabel}
        </span>
        {rightSub && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>
            {rightSub}
          </span>
        )}
        {arrowGlyph && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: arrowColor ?? 'var(--text-faint)', lineHeight: 1 }}>
            {arrowGlyph}
          </span>
        )}
      </div>
    </div>
  );
}

function BarsSection({ data }: { data: MarketWeatherProps }) {
  const { astro, roc, breadth } = data.components;

  // Bar fill = avg confidence of dominant-direction signals; color = direction
  let astroNorm: number;
  let astroBarLabel: string;
  let astroColorOverride: string | undefined;
  if (astro.total === 0) {
    astroNorm = 0; astroBarLabel = '—'; astroColorOverride = undefined;
  } else if (astro.turning > astro.positive && astro.turning > astro.negative) {
    astroNorm = astro.avg_trn_conf / 100; astroBarLabel = 'Inflection'; astroColorOverride = '#D4A853';
  } else if (astro.positive >= astro.negative) {
    astroNorm = astro.avg_pos_conf / 100;
    astroBarLabel = astro.avg_pos_conf >= 60 ? 'Positive' : 'Mod. Positive';
    astroColorOverride = '#22c55e';
  } else {
    astroNorm = astro.avg_neg_conf / 100;
    astroBarLabel = astro.avg_neg_conf >= 60 ? 'Negative' : 'Mod. Negative';
    astroColorOverride = '#ef4444';
  }

  const { glyph: arrowGlyph, color: arrowColor } = rocArrow(roc.roc_13, roc.roc_13_prev);
  const rocText = rocLabel(roc.roc_13);
  const bLabel = breadthLabel(breadth.breadth_score);

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <BarRow
        label="Astro Signals"
        normalized={astroNorm}
        rightLabel={astroBarLabel}
        colorOverride={astroColorOverride}
      />
      <BarRow
        label="Momentum"
        normalized={roc.normalized}
        rightLabel={rocText}
        rightSub={`${roc.roc_13 > 0 ? '+' : ''}${roc.roc_13.toFixed(2)}`}
        arrowGlyph={arrowGlyph}
        arrowColor={arrowColor}
        colorOverride={rocCrossoverColor(roc.roc_13, roc.sma_breadth)}
      />
      <BarRow
        label="Breadth"
        normalized={breadth.normalized}
        rightLabel={bLabel}
      />
    </div>
  );
}

// ── Part 4: Footer tally + main export ───────────────────────────────────────

function FooterTally({ astro }: { astro: MarketWeatherProps['components']['astro'] }) {
  const pills: { label: string; count: number; color: string }[] = [
    { label: 'Positive',   count: astro.positive, color: '#22c55e' },
    { label: 'Negative',   count: astro.negative, color: '#ef4444' },
    { label: 'Inflection', count: astro.turning,  color: '#D4A853' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        padding: '10px 20px',
      }}
    >
      {pills.map((p, i) => (
        <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && (
            <span
              style={{
                marginRight: 6,
                color: 'rgba(255,255,255,0.1)',
                fontSize: 14,
              }}
            >
              │
            </span>
          )}
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
              fontWeight: 700,
              color: p.color,
              lineHeight: 1,
            }}
          >
            {p.count}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 10,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {p.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Data hook ─────────────────────────────────────────────────────────────────

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL as string | undefined)?.trim() ?? 'http://localhost:8101';

async function fetchComposite(date: string): Promise<MarketWeatherProps> {
  const res = await fetch(`${PIPELINE_API}/api/dashboard/composite?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error(`composite ${res.status}`);
  return res.json() as Promise<MarketWeatherProps>;
}

export function useMarketWeather(date: string) {
  return useQuery({
    queryKey: ['market_weather', date],
    queryFn: () => fetchComposite(date),
    staleTime: 5 * 60 * 1000,
    enabled: !!date,
  });
}

// ── Card shell ────────────────────────────────────────────────────────────────

function CardShell({ data, date }: { data: MarketWeatherProps; date: string }) {
  const [open, setOpen] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [histCtx, setHistCtx] = useState<HistoricalContext | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  const handleTrigger = async () => {
    if (!clicked) setClicked(true);
    if (!histCtx && !histLoading) {
      setHistLoading(true);
      try {
        const res = await fetch(`${PIPELINE_API}/api/dashboard/context?date=${encodeURIComponent(date)}`);
        if (res.ok) setHistCtx(await res.json());
      } catch {
        setHistCtx({ available: false });
      } finally {
        setHistLoading(false);
      }
    }
    setOpen(o => !o);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HISTORY_CSS }} />
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(212,168,83,0.20)',
          borderRadius: 14,
          overflow: 'hidden',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(212,168,83,0.08)',
        }}
      >
        <CardHeader data={data} />
        <BarsSection data={data} />
        <FooterTally astro={data.components.astro} />

        {/* ── Trigger row ── */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleTrigger}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleTrigger()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            cursor: 'pointer',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            userSelect: 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span
            className={`kd-hist-pulse${clicked ? ' seen' : ''}`}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)' }}
          >
            ◈
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              flex: 1,
            }}
          >
            Historical Pattern
          </span>
          {histLoading ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>…</span>
          ) : (
            <svg
              className={`kd-hist-chevron${open ? ' open' : ''}`}
              width="12" height="12" viewBox="0 0 12 12"
              fill="none" stroke="var(--text-faint)" strokeWidth="1.8"
            >
              <path d="M2 4l4 4 4-4" />
            </svg>
          )}
        </div>

        {/* ── Expandable history panel — grid trick for smooth animation ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateRows: open ? '1fr' : '0fr',
            transition: 'grid-template-rows 0.28s ease',
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            {histCtx && (
              <div
                style={{
                  padding: '14px 20px 16px',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(0,0,0,0.15)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'var(--text-faint)',
                    marginBottom: 12,
                  }}
                >
                  Historical Context
                </div>
                <HistoryPanel ctx={histCtx} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

interface MarketWeatherCardProps {
  date?: string;
}

const cardBox: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid rgba(212,168,83,0.20)',
  borderRadius: 14,
  overflow: 'hidden',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
  padding: '48px 20px',
  textAlign: 'center' as const,
};

export default function MarketWeatherCard({ date }: MarketWeatherCardProps = {}) {
  const { data, isLoading, isError, error } = useMarketWeather(date ?? '');

  if (isLoading) {
    return (
      <div style={cardBox}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
          LOADING…
        </span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ ...cardBox, padding: '32px 24px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>
          Astro-Technical Alignment
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444', letterSpacing: '0.1em', marginBottom: 6 }}>
          API UNAVAILABLE
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-faint)' }}>
          {(error as Error)?.message ?? 'Could not reach pipeline API'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)', marginTop: 8, letterSpacing: '0.08em' }}>
          /api/dashboard/composite · {date}
        </div>
      </div>
    );
  }

  return <CardShell data={data} date={date ?? ''} />;
}
