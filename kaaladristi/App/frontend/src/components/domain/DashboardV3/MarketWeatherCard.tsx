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
      mixed: number;
      total: number;
    };
    roc: {
      roc_13: number;
      roc_13_prev: number;
      normalized: number;
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

// ── Helper: momentum arrow from ROC delta ─────────────────────────────────────

function rocArrow(roc_13: number, roc_13_prev: number): string {
  const delta = roc_13 - roc_13_prev;
  if (delta > 0.1)  return '↗';
  if (delta < -0.1) return '↘';
  return '→';
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
      mixed: 0,
      total: 5,
    },
    roc: {
      roc_13: 0.86,
      roc_13_prev: 1.09,
      normalized: 0.50,
    },
    breadth: {
      breadth_score: 51.57,
      normalized: 0.5157,
    },
  },
};

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
          Based on {data.components.astro.total} active signal{data.components.astro.total !== 1 ? 's' : ''}
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
}

function BarRow({ label, normalized, rightLabel, rightSub }: BarRowProps) {
  const pct = Math.round(normalized * 100);
  const color = barColor(normalized);

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
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-faint)',
            }}
          >
            {rightSub}
          </span>
        )}
      </div>
    </div>
  );
}

function BarsSection({ data }: { data: MarketWeatherProps }) {
  const { astro, roc, breadth } = data.components;
  const astroNorm = astro.score / 100;
  const arrow = rocArrow(roc.roc_13, roc.roc_13_prev);
  const rocText = rocLabel(roc.roc_13);
  const bLabel = breadthLabel(breadth.breadth_score);

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <BarRow
        label="Astro Signals"
        normalized={astroNorm}
        rightLabel="Positive"
      />
      <BarRow
        label="Momentum"
        normalized={roc.normalized}
        rightLabel={rocText}
        rightSub={`${roc.roc_13 > 0 ? '+' : ''}${roc.roc_13.toFixed(2)} ${arrow}`}
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
    { label: 'Positive', count: astro.positive, color: '#22c55e' },
    { label: 'Negative', count: astro.negative, color: '#ef4444' },
    { label: 'Mixed',    count: astro.mixed,    color: '#f59e0b' },
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

// ── Root component ────────────────────────────────────────────────────────────

export default function MarketWeatherCard(props: Partial<MarketWeatherProps> = {}) {
  const data: MarketWeatherProps = Object.keys(props).length ? (props as MarketWeatherProps) : sampleData;

  return (
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
    </div>
  );
}
