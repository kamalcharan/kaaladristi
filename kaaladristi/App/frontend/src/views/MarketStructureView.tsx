import { useState } from 'react';
import MarketBreadthChart from '@/components/domain/MarketBreadthChart';
import BreadthRocChart from '@/components/domain/BreadthRocChart';
import MarketWeatherCard from '@/components/domain/DashboardV3/MarketWeatherCard';
import NakVaraSignals from '@/components/domain/DashboardV3/NakVaraSignals';
import { dashboardDate } from '@/stores/appStore';
import { useConfluenceHistorical } from '@/hooks';
import type { ConfluenceRow } from '@/types';

// ── Static sample data (user-provided research numbers) ──────────────────────
// Used as fallback while API is loading or unavailable.

const SAMPLE_ROWS: ConfluenceRow[] = [
  // Breadth matrix — Positive outcome
  { outcome: 'bullish', breadth_regime: 'Depressed', roc_regime: null, transits: 214,   accuracy_pct: 44.1, avg_return: -0.21 },
  { outcome: 'bullish', breadth_regime: 'Moderate',  roc_regime: null, transits: 1847,  accuracy_pct: 44.3, avg_return: 0.04  },
  { outcome: 'bullish', breadth_regime: 'Elevated',  roc_regime: null, transits: 2103,  accuracy_pct: 58.1, avg_return: 0.57  },
  // Breadth matrix — Negative outcome
  { outcome: 'bearish', breadth_regime: 'Depressed', roc_regime: null, transits: 186,   accuracy_pct: 48.6, avg_return: -0.14 },
  { outcome: 'bearish', breadth_regime: 'Moderate',  roc_regime: null, transits: 1823,  accuracy_pct: 48.0, avg_return: -0.08 },
  { outcome: 'bearish', breadth_regime: 'Elevated',  roc_regime: null, transits: 1284,  accuracy_pct: 50.8, avg_return: -0.11 },
  // ROC matrix — Positive outcome
  { outcome: 'bullish', breadth_regime: null, roc_regime: 'Contracting', transits: 7,    accuracy_pct: 28.6, avg_return: -0.88 },
  { outcome: 'bullish', breadth_regime: null, roc_regime: 'Negative',    transits: 1204, accuracy_pct: 45.3, avg_return: 0.02  },
  { outcome: 'bullish', breadth_regime: null, roc_regime: 'Positive',    transits: 2891, accuracy_pct: 54.0, avg_return: 0.38  },
  { outcome: 'bullish', breadth_regime: null, roc_regime: 'Expanding',   transits: 1,    accuracy_pct: 100,  avg_return: 1.12  },
  // ROC matrix — Negative outcome
  { outcome: 'bearish', breadth_regime: null, roc_regime: 'Contracting', transits: 6,    accuracy_pct: 83.3, avg_return: -2.38 },
  { outcome: 'bearish', breadth_regime: null, roc_regime: 'Negative',    transits: 1397, accuracy_pct: 47.7, avg_return: -0.09 },
  { outcome: 'bearish', breadth_regime: null, roc_regime: 'Positive',    transits: 1780, accuracy_pct: 49.4, avg_return: -0.12 },
  { outcome: 'bearish', breadth_regime: null, roc_regime: 'Expanding',   transits: 14,   accuracy_pct: 78.6, avg_return: -1.74 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const OUTCOME_DISPLAY: Record<string, string> = {
  bullish: 'Positive Outcome',
  bearish: 'Negative Outcome',
};

function cellColor(pct: number | null): string {
  if (pct == null) return '#94a3b8';
  if (pct >= 70)   return '#22c55e';
  if (pct >= 55)   return '#14b8a6';
  if (pct >= 45)   return '#f59e0b';
  return '#ef4444';
}

function cellBg(pct: number | null): string {
  const c = cellColor(pct);
  return `${c}18`;
}

function makeLookup(rows: ConfluenceRow[], dim: 'breadth_regime' | 'roc_regime') {
  const m: Record<string, Record<string, ConfluenceRow>> = {};
  for (const r of rows) {
    const key = r[dim];
    if (!key) continue;
    if (!m[r.outcome]) m[r.outcome] = {};
    m[r.outcome][key] = r;
  }
  return m;
}

// ── Matrix cell ───────────────────────────────────────────────────────────────

function MatrixCell({ row }: { row: ConfluenceRow | undefined }) {
  if (!row) {
    return (
      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569', fontSize: 11 }}>—</td>
    );
  }
  const pct = row.accuracy_pct;
  const color = cellColor(pct);
  const bg    = cellBg(pct);
  const small = row.transits < 20;
  const high  = pct != null && pct >= 70;

  return (
    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 15,
            fontWeight: 700,
            color,
            background: bg,
            border: `1px solid ${color}40`,
            borderRadius: 6,
            padding: '3px 10px',
            minWidth: 72,
            textAlign: 'center',
            position: 'relative',
          }}
        >
          {pct != null ? `${pct.toFixed(1)}%` : '—'}
          {high && (
            <span style={{
              position: 'absolute',
              top: -6, right: -6,
              fontSize: 9,
              background: color,
              color: '#000',
              borderRadius: 99,
              padding: '1px 4px',
              fontWeight: 700,
              lineHeight: 1.4,
            }}>★</span>
          )}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569' }}>
          n={row.transits.toLocaleString()}
          {small && <span style={{ color: '#f59e0b', marginLeft: 3 }}>⚠</span>}
        </div>
        {row.avg_return != null && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: row.avg_return >= 0 ? '#22c55e' : '#ef4444',
          }}>
            {row.avg_return >= 0 ? '+' : ''}{row.avg_return.toFixed(2)}%
          </div>
        )}
      </div>
    </td>
  );
}

// ── Correlation matrix ────────────────────────────────────────────────────────

const BREADTH_COLS = ['Depressed', 'Moderate', 'Elevated'] as const;
const ROC_COLS     = ['Contracting', 'Negative', 'Positive', 'Expanding'] as const;
const OUTCOMES     = ['bullish', 'bearish'] as const;

const TABLE_STYLE: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: 'var(--font-sans)',
};

const TH_STYLE: React.CSSProperties = {
  padding: '8px 14px',
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#64748b',
  textAlign: 'center',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
};

const ROW_HEADER_STYLE: React.CSSProperties = {
  padding: '10px 16px',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
  borderRight: '1px solid rgba(255,255,255,0.06)',
  verticalAlign: 'middle',
};

function BreadthMatrix({ lookup }: { lookup: Record<string, Record<string, ConfluenceRow>> }) {
  return (
    <table style={TABLE_STYLE}>
      <thead>
        <tr>
          <th style={{ ...TH_STYLE, textAlign: 'left', minWidth: 140 }}>Astro Signal</th>
          {BREADTH_COLS.map(c => (
            <th key={c} style={TH_STYLE}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {OUTCOMES.map(o => (
          <tr key={o} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <td style={ROW_HEADER_STYLE}>{OUTCOME_DISPLAY[o]}</td>
            {BREADTH_COLS.map(c => (
              <MatrixCell key={c} row={lookup[o]?.[c]} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RocMatrix({ lookup }: { lookup: Record<string, Record<string, ConfluenceRow>> }) {
  return (
    <table style={TABLE_STYLE}>
      <thead>
        <tr>
          <th style={{ ...TH_STYLE, textAlign: 'left', minWidth: 140 }}>Astro Signal</th>
          {ROC_COLS.map(c => (
            <th key={c} style={TH_STYLE}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {OUTCOMES.map(o => (
          <tr key={o} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <td style={ROW_HEADER_STYLE}>{OUTCOME_DISPLAY[o]}</td>
            {ROC_COLS.map(c => (
              <MatrixCell key={c} row={lookup[o]?.[c]} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Insight callout cards ─────────────────────────────────────────────────────

interface InsightCard {
  icon:    string;
  color:   string;
  title:   string;
  sub:     string;
  acc:     string;
  ret:     string | null;
  verdict: string;
}

const INSIGHTS: InsightCard[] = [
  {
    icon:    '▼',
    color:   '#ef4444',
    title:   'Negative + Contracting ROC',
    sub:     'Strongest signal in the system',
    acc:     '83.3%',
    ret:     'avg −2.38%',
    verdict: 'When negative astro aligns with contracting momentum breadth, downside follow-through is historically the most consistent pattern across 30 years.',
  },
  {
    icon:    '▲',
    color:   '#22c55e',
    title:   'Positive + Elevated Breadth',
    sub:     'Best positive confluence',
    acc:     '58.1%',
    ret:     'avg +0.57%',
    verdict: 'Positive astro signals see their highest accuracy when broad market participation is already elevated — institutional support is structurally present.',
  },
  {
    icon:    '◈',
    color:   '#f59e0b',
    title:   'Positive + Depressed Breadth',
    sub:     'Structural mismatch — reduce conviction',
    acc:     '44.1%',
    ret:     null,
    verdict: 'Positive astro in a depressed breadth regime produces below-50% accuracy. The astro signal lacks structural support from market internals.',
  },
];

function InsightCallouts() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {INSIGHTS.map((ins) => (
        <div
          key={ins.title}
          style={{
            background: `${ins.color}08`,
            border: `1px solid ${ins.color}30`,
            borderRadius: 10,
            padding: '14px 16px',
          }}
        >
          {/* Accent top bar */}
          <div style={{ width: 32, height: 2, background: ins.color, borderRadius: 1, marginBottom: 10 }} />

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: ins.color, lineHeight: 1.3, fontWeight: 700 }}>
              {ins.icon}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.35 }}>
              {ins.title}
            </span>
          </div>

          {/* Sub-label */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: ins.color, marginBottom: 10 }}>
            {ins.sub}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: ins.color }}>{ins.acc}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#64748b', letterSpacing: '0.08em' }}>ACCURACY</div>
            </div>
            {ins.ret && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: ins.color }}>{ins.ret}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#64748b', letterSpacing: '0.08em' }}>AVG RETURN</div>
              </div>
            )}
          </div>

          {/* Verdict */}
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#94a3b8', lineHeight: 1.55 }}>
            {ins.verdict}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function MatrixLegend() {
  const items = [
    { color: '#22c55e', label: '≥ 70% — High conviction' },
    { color: '#14b8a6', label: '55–69% — Moderate edge' },
    { color: '#f59e0b', label: '45–54% — Ambiguous' },
    { color: '#ef4444', label: '< 45% — Counter-signal' },
  ];
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      {items.map(i => (
        <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: i.color }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#64748b' }}>{i.label}</span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#f59e0b' }}>⚠ n&lt;20</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#64748b' }}>= small sample</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#22c55e', fontWeight: 700 }}>★</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#64748b' }}>= high conviction (&gt;70%)</span>
      </div>
    </div>
  );
}

// ── Shared section wrapper ────────────────────────────────────────────────────

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '13px 18px 11px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          {title}
        </div>
        {sub && (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>
        )}
      </div>
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  );
}

// ── Tab 2 — Historical Confluence ─────────────────────────────────────────────

function HistoricalConfluenceTab() {
  const { data: liveRows, isError } = useConfluenceHistorical();

  // Use live data when available, fall back to sample data
  const rows = (liveRows && liveRows.length > 0) ? liveRows : SAMPLE_ROWS;
  const isLive = liveRows && liveRows.length > 0;

  const breadthRows = rows.filter(r => r.breadth_regime && !r.roc_regime);
  const rocRows     = rows.filter(r => r.roc_regime && !r.breadth_regime);

  const breadthLookup = makeLookup(breadthRows, 'breadth_regime');
  const rocLookup     = makeLookup(rocRows,     'roc_regime');

  const totalTransits = breadthRows.reduce((s, r) => s + r.transits, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Source tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          padding: '3px 10px',
          borderRadius: 4,
          background: isLive ? 'rgba(34,197,94,0.10)' : 'rgba(245,158,11,0.10)',
          color: isLive ? '#22c55e' : '#f59e0b',
          border: `1px solid ${isLive ? 'rgba(34,197,94,0.30)' : 'rgba(245,158,11,0.30)'}`,
        }}>
          {isLive ? 'Live DB' : 'Research Sample'}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569' }}>
          {totalTransits.toLocaleString()} signal dates · 30 years history · NSE NIFTY 50
        </span>
        {isError && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#ef4444' }}>
            API unavailable — showing research data
          </span>
        )}
      </div>

      {/* Matrix 1: Astro × Breadth */}
      <Section
        title="Astro × Breadth Regime"
        sub="Accuracy when astro outcome aligns with EMA breadth regime"
      >
        <div style={{ overflowX: 'auto' }}>
          <BreadthMatrix lookup={breadthLookup} />
        </div>
        <div style={{ marginTop: 10, padding: '10px 0 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <MatrixLegend />
        </div>
      </Section>

      {/* Matrix 2: Astro × ROC */}
      <Section
        title="Astro × ROC Momentum Regime"
        sub="Accuracy when astro outcome aligns with ROC-13 momentum state"
      >
        <div style={{ overflowX: 'auto' }}>
          <RocMatrix lookup={rocLookup} />
        </div>
        <div style={{ marginTop: 10, padding: '10px 0 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#475569' }}>
              ROC regime: <span style={{ color: '#94a3b8' }}>Contracting (ROC &lt; −1) · Negative (−1 to 0) · Positive (0 to +1) · Expanding (&gt;1)</span>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <MatrixLegend />
          </div>
        </div>
      </Section>

      {/* Insight callouts */}
      <Section title="Key Confluence Patterns">
        <InsightCallouts />
      </Section>

    </div>
  );
}

// ── Tab 1 — Today's Structure ─────────────────────────────────────────────────

function TodayStructureTab({ date }: { date: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Composite score */}
      <MarketWeatherCard date={date} />

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <MarketBreadthChart />
        <BreadthRocChart />
      </div>

      {/* Today's rule signals tiered by confluence */}
      <NakVaraSignals date={date} />

    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'today',      label: "Today's Structure" },
  { id: 'historical', label: 'Historical Confluence' },
] as const;
type TabId = typeof TABS[number]['id'];

// ── Root ──────────────────────────────────────────────────────────────────────

export default function MarketStructureView() {
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const date = dashboardDate();

  return (
    <div style={{ padding: '20px 24px 40px', minHeight: '100vh' }}>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          marginBottom: 4,
        }}>
          DristiQ · Market Intelligence
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 500,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          margin: 0,
        }}>
          Market Structure &amp; Confluence
        </h1>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
          Astro × breadth × momentum — 30-year confluence analysis
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '3px',
        background: 'var(--card)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        width: 'fit-content',
        marginBottom: 24,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 16px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: activeTab === t.id ? '#818cf8' : 'transparent',
              color: activeTab === t.id ? '#fff' : 'var(--text-faint)',
              fontWeight: activeTab === t.id ? 700 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'today'      && <TodayStructureTab date={date} />}
      {activeTab === 'historical' && <HistoricalConfluenceTab />}

    </div>
  );
}
