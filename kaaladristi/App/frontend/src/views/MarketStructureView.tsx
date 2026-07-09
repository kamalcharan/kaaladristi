import { useState } from 'react';
import MarketBreadthChart from '@/components/domain/MarketBreadthChart';
import BreadthRocChart from '@/components/domain/BreadthRocChart';
import BreadthHeatmap from '@/components/domain/BreadthHeatmap';
import BreadthRawTable from '@/components/domain/BreadthRawTable';
import MarketWeatherCard from '@/components/domain/DashboardV3/MarketWeatherCard';
import NakVaraSignals from '@/components/domain/DashboardV3/NakVaraSignals';
import ConfluenceDotGrid from '@/components/domain/ConfluenceDotGrid';
import { dashboardDate } from '@/stores/appStore';
import { useConfluenceHeatmap, useMarketBreadth } from '@/hooks';
import { Loader2, AlertCircle } from 'lucide-react';
import type { ConfluenceConditions, ConfluencePattern } from '@/types';
import { PageHeader } from '@/components/ui';

// ── Color helpers ─────────────────────────────────────────────────────────────

function breadthRegimeColor(regime: string | null): string {
  if (regime === 'Elevated') return 'var(--bull)';
  if (regime === 'Depressed') return 'var(--bear)';
  return 'var(--caution)';
}

function rocRegimeColor(regime: string | null): string {
  if (regime === 'Expanding') return 'var(--bull)';
  if (regime === 'Positive')  return 'var(--bull)';
  if (regime === 'Negative')  return 'var(--caution)';
  return 'var(--bear)';
}

function nakvarColor(outcome: string | null): string {
  if (outcome === 'bullish') return 'var(--bull)';
  if (outcome === 'bearish') return 'var(--bear)';
  return 'var(--text-muted)';
}

function patternColor(pct: number | null): string {
  if (pct == null) return 'var(--text-muted)';
  if (pct >= 65) return 'var(--bull)';
  if (pct >= 55) return 'color-mix(in srgb, var(--bull) 70%, transparent)';
  if (pct >= 45) return 'var(--caution)';
  return 'var(--bear)';
}

function fmtRoc(v: number | null): string {
  if (v == null) return '—';
  return v >= 0 ? `+${v.toFixed(4)}` : v.toFixed(4);
}

// ── Condition card ────────────────────────────────────────────────────────────

function CondCard({
  label, value, valueSub, badge, badgeColor, rows,
}: {
  label: string;
  value: string;
  valueSub?: string;
  badge: string;
  badgeColor: string;
  rows?: { k: string; v: string; color?: string }[];
}) {
  // color-mix, not a hex-alpha suffix (badgeColor is now often var(--bull)
  // etc. rather than a plain hex — appending a suffix like the old
  // `${badgeColor}0d` trick did produces invalid CSS for a var() input).
  const bg = `color-mix(in srgb, ${badgeColor} 5%, transparent)`;
  const border = `color-mix(in srgb, ${badgeColor} 16%, transparent)`;
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 10,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 8,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}>
        {label}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: badgeColor, lineHeight: 1 }}>
            {value}
          </div>
          {valueSub && (
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
              {valueSub}
            </div>
          )}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: badgeColor,
          background: `color-mix(in srgb, ${badgeColor} 9%, transparent)`,
          border: `1px solid color-mix(in srgb, ${badgeColor} 22%, transparent)`,
          borderRadius: 5,
          padding: '4px 10px',
          whiteSpace: 'nowrap',
        }}>
          {badge}
        </div>
      </div>

      {rows && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8, borderTop: '1px solid color-mix(in srgb, var(--text-primary) 5%, transparent)' }}>
          {rows.map(r => (
            <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-muted)' }}>{r.k}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: r.color ?? 'var(--text-secondary)', fontWeight: 600 }}>{r.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Historical Pattern Block ──────────────────────────────────────────────────

function PatternBlock({ pattern }: { pattern: ConfluencePattern | null }) {
  if (!pattern) {
    return (
      <div style={{
        background: 'color-mix(in srgb, var(--text-primary) 2%, transparent)',
        border: '1px dashed color-mix(in srgb, var(--text-primary) 8%, transparent)',
        borderRadius: 10,
        padding: '24px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
      }}>
        No pattern data — insufficient historical instances for this combination
      </div>
    );
  }

  const pct    = pattern.positive_day_pct;
  const ret    = pattern.avg_day_return;
  const color  = patternColor(pct);
  const bg     = `color-mix(in srgb, ${color} 5%, transparent)`;
  const border = `color-mix(in srgb, ${color} 16%, transparent)`;

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 10,
      padding: '20px 22px',
    }}>
      {/* Regime labels */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[
          { k: 'BREADTH', v: pattern.breadth_regime },
          { k: 'ROC',     v: pattern.roc_regime },
          { k: 'ASTRO',   v: pattern.nakvar_outcome.toUpperCase() },
        ].map(t => (
          <div
            key={t.k}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.12em',
              padding: '3px 9px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
              border: '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)',
              color: 'var(--text-secondary)',
            }}
          >
            {t.k}: <span style={{ color: 'var(--text-primary)' }}>{t.v}</span>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 700, color, lineHeight: 1 }}>
            {pct != null ? `${pct.toFixed(1)}%` : '—'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 3 }}>
            Positive Days
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: (ret ?? 0) >= 0 ? 'var(--bull)' : 'var(--bear)', lineHeight: 1 }}>
            {ret != null ? `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%` : '—'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 3 }}>
            Avg Day Return
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1 }}>
            {pattern.signal_count.toLocaleString()}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 3 }}>
            Historical Signals
          </div>
        </div>
      </div>

      {pattern.signal_count < 20 && (
        <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--caution)' }}>
          ⚠ Small sample — interpret with caution
        </div>
      )}
    </div>
  );
}

// ── Conditions panel (3 cards) ────────────────────────────────────────────────

function ConditionsPanel({ cond }: { cond: ConfluenceConditions }) {
  const breadthColor = breadthRegimeColor(cond.breadth_regime);
  const rocColor     = rocRegimeColor(cond.roc_regime);
  const nakColor     = nakvarColor(cond.nakvar_outcome);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {/* Breadth Card */}
      <CondCard
        label="Market Breadth"
        value={cond.breadth_score != null ? cond.breadth_score.toFixed(1) : '—'}
        valueSub="Breadth Score (0–100)"
        badge={cond.breadth_regime ?? '—'}
        badgeColor={breadthColor}
        rows={[
          { k: 'Threshold', v: '>55 Elevated · <35 Depressed', color: 'var(--text-muted)' },
        ]}
      />

      {/* ROC-13 Card */}
      <CondCard
        label="Momentum (ROC-13)"
        value={fmtRoc(cond.roc_13)}
        valueSub="Rate of Change · 13-period"
        badge={cond.roc_regime ?? '—'}
        badgeColor={rocColor}
        rows={[
          { k: 'SMA (5)', v: fmtRoc(cond.sma_breadth) },
          { k: 'Direction', v: cond.roc_direction ?? '—', color: rocColor },
        ]}
      />

      {/* Nak-Vara Card */}
      <CondCard
        label="Astro Signal (Nak-Vara)"
        value={cond.nakvar_outcome ? cond.nakvar_outcome.toUpperCase() : '—'}
        valueSub={cond.nakvar_rule_name ?? cond.nakvar_rule_code ?? 'No dominant signal'}
        badge={cond.nakvar_outcome ? `${cond.nakvar_outcome.toUpperCase()} SIGNAL` : 'NEUTRAL'}
        badgeColor={nakColor}
        rows={[
          { k: 'Vara (weekday)', v: cond.vara ?? '—' },
          { k: 'Nakshatra Lord', v: cond.nakshatra_lord ?? '—' },
          ...(cond.nakvar_conf != null ? [{ k: 'Confidence', v: `${(cond.nakvar_conf * 100).toFixed(0)}%` }] : []),
        ]}
      />
    </div>
  );
}

// ── Insight callout cards (reworded as Historical Observations) ───────────────

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

const OBSERVATIONS: InsightCard[] = [
  {
    color:   'var(--bear)',
    icon:    '▼',
    title:   'Depressed Breadth + Negative ROC',
    sub:     'Market structure overwhelms all astro signals',
    acc:     '35–37%',
    ret:     'avg −0.31% to −0.35%',
    n:       '772 signal days',
    verdict: 'When breadth is depressed and momentum is negative, positive astro signals fail. Market internals dominate — the historical edge disappears entirely in this regime.',
  },
  {
    color:   'var(--bull)',
    icon:    '▲',
    title:   'Elevated Breadth + Positive ROC + Positive Astro',
    sub:     'Strongest positive confluence observed',
    acc:     '56.3%',
    ret:     'avg +0.19%',
    n:       '1,292 signals',
    verdict: 'When all three layers align — broad participation, expanding short-term momentum, and positive astro — the historical frequency of a positive trading day is highest across the system.',
  },
  {
    color:   'var(--caution)',
    icon:    '◈',
    title:   'Elevated Breadth overrides Negative Astro',
    sub:     'Structural breadth dominated negative signals — 63.9% positive days',
    acc:     '63.9%',
    ret:     'avg +0.20%',
    n:       '393 signals',
    verdict: 'Negative astro in an elevated breadth regime historically still produced positive market days at 63.9% frequency. This suggests structural breadth is a stronger force than the astro signal in isolation.',
  },
];

function HistoricalObservations() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {OBSERVATIONS.map(ins => (
        <div
          key={ins.title}
          style={{
            background: `color-mix(in srgb, ${ins.color} 3%, transparent)`,
            border: `1px solid color-mix(in srgb, ${ins.color} 16%, transparent)`,
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
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 2 }}>POSITIVE DAYS</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: ins.color, lineHeight: 1 }}>{ins.ret}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 2 }}>AVG DAY RETURN</div>
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            {ins.n} of evidence
          </div>

          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6, borderTop: '1px solid color-mix(in srgb, var(--text-primary) 5%, transparent)', paddingTop: 8 }}>
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
    <div style={{ background: 'var(--card)', border: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '13px 18px 11px', borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{title}</div>
        {sub && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  );
}

// ── Tab 2 — Historical Confluence ─────────────────────────────────────────────

function HistoricalConfluenceTab({ date }: { date: string }) {
  const { data, isLoading, isError } = useConfluenceHeatmap(date);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Day-by-day signal grid */}
      <ConfluenceDotGrid />

      {/* Section 1 — Current Conditions */}
      <Section
        title="Today's Conditions"
        sub={`Breadth, momentum, and astro state as of ${date}`}
      >
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0', color: 'var(--text-muted)' }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>Loading conditions…</span>
          </div>
        ) : isError || !data ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0', color: 'var(--bear)' }}>
            <AlertCircle className="w-4 h-4" />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>Could not load conditions — backend may be offline</span>
          </div>
        ) : (
          <ConditionsPanel cond={data.conditions} />
        )}
      </Section>

      {/* Section 2 — Historical Pattern */}
      <Section
        title="Historical Pattern"
        sub="3-way confluence: most-recent breadth regime × ROC regime × today's astro signal — 30 years of NSE data"
      >
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0', color: 'var(--text-muted)' }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>Loading pattern…</span>
          </div>
        ) : (
          <PatternBlock pattern={data?.pattern ?? null} />
        )}
      </Section>

      {/* Historical Observations */}
      <Section title="Historical Observations" sub="What 30 years of nak-vara signals reveal about market structure">
        <HistoricalObservations />
      </Section>

      {/* Footer disclaimer */}
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 10,
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        padding: '12px 16px',
        background: 'color-mix(in srgb, var(--text-primary) 2%, transparent)',
        border: '1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)',
        borderRadius: 8,
      }}>
        <strong style={{ color: 'var(--text-muted)' }}>Disclaimer:</strong> These patterns are historical observations derived from
        backtested nak-vara astro signals combined with NSE NIFTY 50 breadth and momentum data. Past frequencies do not
        guarantee future outcomes. All figures represent statistical tendencies across a large sample — individual days
        will deviate. This data is educational and should not be used as the sole basis for any trading decision.
      </div>

    </div>
  );
}

// ── Tab 1 — Today's Structure ─────────────────────────────────────────────────

function TodayStructureTab({ date }: { date: string }) {
  // Shared fetch — the chart uses its own hook with the same query key, so React
  // Query dedupes (no double request). Heatmap + raw table read it here.
  const breadth = useMarketBreadth(66);
  const breadthData = breadth.data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <MarketWeatherCard date={date} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <MarketBreadthChart />
        <BreadthRocChart />
      </div>
      <BreadthHeatmap data={breadthData} />
      <BreadthRawTable data={breadthData} />
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
    <div style={{ minHeight: '100%' }}>
      <PageHeader
        eyebrow="Market Intelligence"
        title="Market Structure & Confluence"
        meta="Astro × breadth × momentum — 30-year confluence analysis"
      />

      <div style={{ padding: '20px 24px 40px' }}>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '3px',
        background: 'var(--card)',
        border: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)',
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
              background: activeTab === t.id ? 'var(--accent)' : 'transparent',
              color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-faint)',
              fontWeight: activeTab === t.id ? 700 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'today'      && <TodayStructureTab date={date} />}
      {activeTab === 'historical' && <HistoricalConfluenceTab date={date} />}
      </div>
    </div>
  );
}
