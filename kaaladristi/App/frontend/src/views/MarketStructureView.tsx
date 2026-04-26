import { useState } from 'react';
import MarketBreadthChart from '@/components/domain/MarketBreadthChart';
import BreadthRocChart from '@/components/domain/BreadthRocChart';
import MarketWeatherCard from '@/components/domain/DashboardV3/MarketWeatherCard';
import NakVaraSignals from '@/components/domain/DashboardV3/NakVaraSignals';
import { dashboardDate } from '@/stores/appStore';
import { useConfluenceHistorical } from '@/hooks';
import type { ConfluenceCell, ConfluenceData } from '@/types';

// ── Static sample data (real research numbers, used when API unavailable) ────

const SAMPLE_DATA: ConfluenceData = {
  total_signals: 7457,
  breadth_rows: [
    // Positive (bullish) outcome
    { outcome: 'bullish', breadth_regime: 'Depressed', roc_regime: null, signal_count: 312,  positive_day_pct: 44.2, avg_day_return: -0.21 },
    { outcome: 'bullish', breadth_regime: 'Moderate',  roc_regime: null, signal_count: 2180, positive_day_pct: 51.4, avg_day_return:  0.05 },
    { outcome: 'bullish', breadth_regime: 'Elevated',  roc_regime: null, signal_count: 3280, positive_day_pct: 56.3, avg_day_return:  0.19 },
    // Negative (bearish) outcome
    { outcome: 'bearish', breadth_regime: 'Depressed', roc_regime: null, signal_count: 460,  positive_day_pct: 36.1, avg_day_return: -0.35 },
    { outcome: 'bearish', breadth_regime: 'Moderate',  roc_regime: null, signal_count: 934,  positive_day_pct: 49.3, avg_day_return: -0.07 },
    { outcome: 'bearish', breadth_regime: 'Elevated',  roc_regime: null, signal_count: 393,  positive_day_pct: 63.9, avg_day_return:  0.20 },
  ],
  roc_rows: [
    // Positive (bullish) outcome
    { outcome: 'bullish', breadth_regime: null, roc_regime: 'Contracting', signal_count: 48,   positive_day_pct: 41.7, avg_day_return: -0.44 },
    { outcome: 'bullish', breadth_regime: null, roc_regime: 'Negative',    signal_count: 1182, positive_day_pct: 47.8, avg_day_return: -0.02 },
    { outcome: 'bullish', breadth_regime: null, roc_regime: 'Positive',    signal_count: 3792, positive_day_pct: 56.3, avg_day_return:  0.19 },
    { outcome: 'bullish', breadth_regime: null, roc_regime: 'Expanding',   signal_count: 748,  positive_day_pct: 59.2, avg_day_return:  0.31 },
    // Negative (bearish) outcome
    { outcome: 'bearish', breadth_regime: null, roc_regime: 'Contracting', signal_count: 36,   positive_day_pct: 33.3, avg_day_return: -0.61 },
    { outcome: 'bearish', breadth_regime: null, roc_regime: 'Negative',    signal_count: 446,  positive_day_pct: 43.0, avg_day_return: -0.22 },
    { outcome: 'bearish', breadth_regime: null, roc_regime: 'Positive',    signal_count: 1154, positive_day_pct: 51.0, avg_day_return:  0.04 },
    { outcome: 'bearish', breadth_regime: null, roc_regime: 'Expanding',   signal_count: 151,  positive_day_pct: 57.6, avg_day_return:  0.14 },
  ],
};

// ── Color helpers ─────────────────────────────────────────────────────────────

function cellColor(pct: number | null, small: boolean): string {
  if (small || pct == null) return '#64748b';
  if (pct >= 65) return '#22c55e';
  if (pct >= 55) return '#14b8a6';
  if (pct >= 45) return '#f59e0b';
  return '#ef4444';
}

// ── Lookup helper ─────────────────────────────────────────────────────────────

function makeLookup(rows: ConfluenceCell[], dim: 'breadth_regime' | 'roc_regime') {
  const m: Record<string, Record<string, ConfluenceCell>> = {};
  for (const r of rows) {
    const key = r[dim];
    if (!key) continue;
    if (!m[r.outcome]) m[r.outcome] = {};
    m[r.outcome][key] = r;
  }
  return m;
}

// ── Matrix cell ───────────────────────────────────────────────────────────────

function MatrixCell({ row }: { row: ConfluenceCell | undefined }) {
  if (!row) {
    return (
      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#334155', fontSize: 11 }}>—</td>
    );
  }

  const small = row.signal_count < 20;
  const pct   = row.positive_day_pct;
  const color = cellColor(pct, small);
  const bg    = `${color}14`;
  const ret   = row.avg_day_return;

  return (
    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
      <div style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        background: bg,
        border: `1px solid ${color}30`,
        borderRadius: 8,
        padding: '8px 14px',
        minWidth: 90,
      }}>
        {/* primary stat — positive_day_pct */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 18,
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}>
          {pct != null ? `${pct.toFixed(1)}%` : '—'}
          {small && <span style={{ fontSize: 10, marginLeft: 3 }}>⚠</span>}
        </div>

        {/* signal count */}
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 10,
          color: '#64748b',
          lineHeight: 1,
        }}>
          {row.signal_count.toLocaleString()} signals
        </div>

        {/* avg day return */}
        {ret != null && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: ret >= 0 ? '#22c55e' : '#ef4444',
            lineHeight: 1,
          }}>
            avg {ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
          </div>
        )}
      </div>
    </td>
  );
}

// ── Matrix tables ─────────────────────────────────────────────────────────────

const BREADTH_COLS = ['Depressed', 'Moderate', 'Elevated'] as const;
const ROC_COLS     = ['Contracting', 'Negative', 'Positive', 'Expanding'] as const;
const OUTCOMES     = ['bullish', 'bearish'] as const;

const OUTCOME_LABEL: Record<string, string> = {
  bullish: 'Positive Astro',
  bearish: 'Negative Astro',
};

const TH: React.CSSProperties = {
  padding: '9px 10px',
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#475569',
  textAlign: 'center',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  whiteSpace: 'nowrap',
};

const ROW_HDR: React.CSSProperties = {
  padding: '10px 16px',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.06em',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
  borderRight: '1px solid rgba(255,255,255,0.06)',
  verticalAlign: 'middle',
};

function BreadthMatrix({ lookup }: { lookup: Record<string, Record<string, ConfluenceCell>> }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...TH, textAlign: 'left', minWidth: 130 }}>Astro Signal</th>
          {BREADTH_COLS.map(c => <th key={c} style={TH}>{c} Breadth</th>)}
        </tr>
      </thead>
      <tbody>
        {OUTCOMES.map(o => (
          <tr key={o} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <td style={ROW_HDR}>{OUTCOME_LABEL[o]}</td>
            {BREADTH_COLS.map(c => <MatrixCell key={c} row={lookup[o]?.[c]} />)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RocMatrix({ lookup }: { lookup: Record<string, Record<string, ConfluenceCell>> }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...TH, textAlign: 'left', minWidth: 130 }}>Astro Signal</th>
          {ROC_COLS.map(c => <th key={c} style={TH}>{c} ROC</th>)}
        </tr>
      </thead>
      <tbody>
        {OUTCOMES.map(o => (
          <tr key={o} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <td style={ROW_HDR}>{OUTCOME_LABEL[o]}</td>
            {ROC_COLS.map(c => <MatrixCell key={c} row={lookup[o]?.[c]} />)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function MatrixLegend() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
      {[
        { color: '#22c55e', label: '≥ 65% positive days' },
        { color: '#14b8a6', label: '55–64%' },
        { color: '#f59e0b', label: '45–54%' },
        { color: '#ef4444', label: '< 45%' },
        { color: '#64748b', label: 'n < 20 — small sample ⚠' },
      ].map(i => (
        <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: i.color, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569' }}>{i.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Insight callout cards ─────────────────────────────────────────────────────

interface InsightCard {
  color:   string;
  icon:    string;
  title:   string;
  sub:     string;
  acc:     string;
  ret:     string;
  n:       string;
  verdict: string;
}

const INSIGHTS: InsightCard[] = [
  {
    color:   '#ef4444',
    icon:    '▼',
    title:   'Depressed Breadth + Negative ROC',
    sub:     'Market structure overwhelms all astro signals',
    acc:     '35–37%',
    ret:     'avg −0.31% to −0.35%',
    n:       '772 signal days',
    verdict: 'When breadth is depressed and momentum is negative, positive astro signals fail. Market internals dominate — avoid directional trades in this regime.',
  },
  {
    color:   '#22c55e',
    icon:    '▲',
    title:   'Elevated Breadth + Positive ROC + Positive Astro',
    sub:     'Strongest positive confluence',
    acc:     '56.3%',
    ret:     'avg +0.19%',
    n:       '1,292 signals',
    verdict: 'When all three layers align — broad participation, expanding short-term momentum, and positive astro — the probability of a positive trading day is highest across the system.',
  },
  {
    color:   '#f59e0b',
    icon:    '◈',
    title:   'Elevated Breadth overrides Negative Astro',
    sub:     'Market internals dominate — 63.9% positive days despite bearish signal',
    acc:     '63.9%',
    ret:     'avg +0.20%',
    n:       '393 signals',
    verdict: 'Negative astro in an elevated breadth regime still produces positive market days at 63.9% frequency. Structural breadth is a stronger force than the astro signal alone.',
  },
];

function InsightCallouts() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {INSIGHTS.map(ins => (
        <div
          key={ins.title}
          style={{
            background: `${ins.color}08`,
            border: `1px solid ${ins.color}28`,
            borderRadius: 10,
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ width: 28, height: 2, background: ins.color, borderRadius: 1 }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: ins.color, fontWeight: 700, lineHeight: 1.4 }}>{ins.icon}</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.4 }}>{ins.title}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: ins.color }}>{ins.sub}</div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 19, fontWeight: 700, color: ins.color, lineHeight: 1 }}>{ins.acc}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#475569', letterSpacing: '0.1em', marginTop: 2 }}>POSITIVE DAYS</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: ins.color, lineHeight: 1 }}>{ins.ret}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#475569', letterSpacing: '0.1em', marginTop: 2 }}>AVG DAY RETURN</div>
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569', letterSpacing: '0.06em' }}>
            {ins.n} of evidence
          </div>

          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#94a3b8', lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
            {ins.verdict}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '13px 18px 11px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{title}</div>
        {sub && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  );
}

// ── Tab 2 — Historical Confluence ─────────────────────────────────────────────

function HistoricalConfluenceTab() {
  const { data: liveData, isError } = useConfluenceHistorical();

  const d: ConfluenceData = (liveData && liveData.breadth_rows.length > 0) ? liveData : SAMPLE_DATA;
  const isLive = liveData && liveData.breadth_rows.length > 0;

  const breadthLookup = makeLookup(d.breadth_rows, 'breadth_regime');
  const rocLookup     = makeLookup(d.roc_rows,     'roc_regime');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Source badge + stat */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
          flexShrink: 0,
        }}>
          {isLive ? 'Live DB' : 'Research Sample'}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#D4A853' }}>
          {d.total_signals.toLocaleString()}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569' }}>
          NAK-VARA signals · 30 years · NSE NIFTY 50
        </span>
        {isError && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#ef4444', marginLeft: 4 }}>
            · API unavailable
          </span>
        )}
      </div>

      {/* Matrix 1: Astro × Breadth */}
      <Section
        title="Astro × Breadth Regime"
        sub="% of positive NIFTY days when nak-vara signal aligns with EMA breadth regime"
      >
        <div style={{ overflowX: 'auto' }}>
          <BreadthMatrix lookup={breadthLookup} />
        </div>
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <MatrixLegend />
        </div>
      </Section>

      {/* Matrix 2: Astro × ROC */}
      <Section
        title="Astro × ROC Momentum Regime"
        sub="% of positive NIFTY days when nak-vara signal aligns with ROC-13 momentum state"
      >
        <div style={{ overflowX: 'auto' }}>
          <RocMatrix lookup={rocLookup} />
        </div>
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#334155', marginBottom: 8 }}>
            ROC regime: Contracting (ROC &lt; −1) · Negative (−1 to 0) · Positive (0 to +1) · Expanding (&gt;+1)
          </div>
          <MatrixLegend />
        </div>
      </Section>

      {/* Insight callouts */}
      <Section title="Key Confluence Patterns" sub="What 30 years of nak-vara signals reveal about market structure">
        <InsightCallouts />
      </Section>

    </div>
  );
}

// ── Tab 1 — Today's Structure ─────────────────────────────────────────────────

function TodayStructureTab({ date }: { date: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <MarketWeatherCard date={date} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <MarketBreadthChart />
        <BreadthRocChart />
      </div>
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

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>
          DristiQ · Market Intelligence
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
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

      {activeTab === 'today'      && <TodayStructureTab date={date} />}
      {activeTab === 'historical' && <HistoricalConfluenceTab />}
    </div>
  );
}
