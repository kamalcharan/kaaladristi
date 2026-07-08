import { useAppStore } from '@/stores/appStore';
import { useDayRisk } from '@/hooks';
import { usePanchang, useAstroSignal, useMarketPulseInsight } from '@/hooks';
import RegimeBadge from '@/components/domain/RegimeBadge';

// ── Internal: confidence donut ───────────────────────────────────────────────

function Donut({ pct, size = 72 }: { pct: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const color =
    pct >= 65 ? 'var(--bull)' : pct >= 45 ? 'var(--gold)' : 'var(--caution)';
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="color-mix(in srgb, var(--text-primary) 6%, transparent)" strokeWidth={3.5}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={3.5}
        strokeDasharray={`${(c * pct) / 100} ${c}`}
        strokeDashoffset={c * 0.25}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function signalToAtmo(signal: string | undefined): string {
  switch (signal?.toUpperCase()) {
    case 'STRONG_BULL':  return 'strongly bullish';
    case 'BULL':
    case 'BULLISH':      return 'broadly constructive';
    case 'MINOR_BULL':   return 'mildly supportive';
    case 'NEUTRAL':      return 'neutral';
    case 'MINOR_BEAR':   return 'mildly cautious';
    case 'BEAR':
    case 'BEARISH':      return 'defensive';
    case 'STRONG_BEAR':  return 'elevated caution';
    default:             return '…';
  }
}

function scoreToConfidence(score: number): number {
  return Math.min(100, Math.max(0, Math.round(50 + (score / 12) * 50)));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TodaysSkyProps {
  date: string;
}

export default function TodaysSky({ date }: TodaysSkyProps) {
  const { selectedSymbol } = useAppStore();
  const dayRisk   = useDayRisk(date, selectedSymbol);
  const { data: panchang }     = usePanchang(date);
  const { data: astroSignal }  = useAstroSignal(date);
  const { data: insight }      = useMarketPulseInsight(date);

  const regime     = dayRisk.data?.regime ?? '—';
  const atmo       = signalToAtmo(astroSignal?.net_signal);
  const confidence = astroSignal ? scoreToConfidence(astroSignal.net_score) : 0;
  const isLoading  = !astroSignal && !panchang;

  const astroLens   = astroSignal?.net_signal?.replace(/_/g, ' ') ?? '—';
  const regimeLens  = regime !== '—' ? regime.toUpperCase() : '—';

  return (
    <div
      className="rounded-2xl mb-4 animate-fade-in"
      style={{
        background: 'linear-gradient(180deg, rgba(212,168,75,0.04) 0%, var(--card) 100%)',
        border: '1px solid var(--border-strong)',
      }}
    >
      {/* ── Main body ───────────────────────────────────────────── */}
      <div
        className="grid gap-8 items-center"
        style={{ padding: '22px 26px', gridTemplateColumns: '1fr auto auto' }}
      >
        {/* Left: heading + primary event */}
        <div style={{ minWidth: 0 }}>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-faint)',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}
            >
              ◉ Today&apos;s Sky
            </span>
            <RegimeBadge regime={regime} showLabel={false} size="sm" />
            {astroSignal?.turning_date && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  padding: '2px 8px',
                  background: 'var(--indigo-bg)',
                  border: '1px solid var(--border-indigo)',
                  borderRadius: 4,
                  color: 'var(--indigo)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                Turning Date
              </span>
            )}
          </div>

          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: 'var(--text-primary)',
              marginBottom: 8,
            }}
          >
            {isLoading ? (
              <span style={{ color: 'var(--text-faint)' }}>Reading the sky…</span>
            ) : (
              <>
                Today reads as{' '}
                <em style={{ color: 'var(--gold)', fontStyle: 'italic', fontWeight: 400 }}>
                  {atmo}.
                </em>
              </>
            )}
          </div>

          {astroSignal?.primary_event && (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
                maxWidth: '56ch',
              }}
            >
              {astroSignal.primary_event}
            </p>
          )}
        </div>

        {/* Centre: confidence score + donut */}
        <div className="flex items-center gap-5">
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                letterSpacing: '0.14em',
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              VaNi Confidence
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 30,
                color: 'var(--gold)',
                lineHeight: 1,
              }}
            >
              {confidence}
              <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>/100</span>
            </div>
          </div>
          <div style={{ width: 1, height: 48, background: 'var(--border)' }} />
          <Donut pct={confidence} size={72} />
        </div>

        {/* Right: two lens agreement */}
        <div
          className="flex flex-col gap-2"
          style={{ borderLeft: '1px solid var(--border)', paddingLeft: 24 }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              letterSpacing: '0.14em',
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            Two Lenses
          </div>

          <span
            style={{
              fontFamily: 'var(--font-mono)',
              padding: '3px 10px',
              background: 'var(--bull-bg)',
              border: '1px solid var(--bull-dim)',
              borderRadius: 4,
              fontSize: 10,
              color: 'var(--bull)',
              letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
            }}
          >
            ASTRO · {astroLens}
          </span>

          <span
            style={{
              fontFamily: 'var(--font-mono)',
              padding: '3px 10px',
              background: 'var(--gold-bg)',
              border: '1px solid rgba(212,168,75,0.2)',
              borderRadius: 4,
              fontSize: 10,
              color: 'var(--gold)',
              letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
            }}
          >
            MARKET · {regimeLens}
          </span>

          {astroSignal && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: astroSignal.turning_date ? 'var(--gold-soft)' : 'var(--text-faint)',
                marginTop: 2,
                letterSpacing: '0.14em',
              }}
            >
              {astroSignal.turning_date ? '⊕ TURNING DATE' : '⊙ ALIGNED'}
            </div>
          )}
        </div>
      </div>

      {/* ── Panchangam strip ────────────────────────────────────── */}
      <div
        className="flex items-center gap-6 flex-wrap"
        style={{
          borderTop: '1px solid var(--border)',
          padding: '12px 26px',
          background: 'rgba(0,0,0,0.15)',
          borderBottomLeftRadius: '1rem',
          borderBottomRightRadius: '1rem',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.16em',
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          ◇ Panchāṅgam
        </span>

        {panchang ? (
          <>
            {[
              {
                key: 'Vara',
                val: `${panchang.vara}${panchang.vara_lord ? ` · ${panchang.vara_lord}` : ''}`,
              },
              {
                key: 'Tithi',
                val: `${panchang.tithi_name}${panchang.tithi_lord ? ` · ${panchang.tithi_lord}` : ''}`,
              },
              {
                key: 'Nakshatra',
                val: `${panchang.nakshatra_name}${panchang.nakshatra_pada ? ` Pada ${panchang.nakshatra_pada}` : ''}${panchang.nakshatra_lord ? ` · ${panchang.nakshatra_lord}` : ''}`,
              },
            ].map(({ key, val }) => (
              <div key={key} className="flex items-baseline gap-2">
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9.5,
                    letterSpacing: '0.14em',
                    color: 'var(--text-faint)',
                    textTransform: 'uppercase',
                  }}
                >
                  {key}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{val}</span>
              </div>
            ))}
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Loading…</span>
        )}

        {insight?.insight && (
          <>
            <div style={{ flex: 1 }} />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 11.5,
                color: 'var(--text-muted)',
              }}
            >
              {insight.insight}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
