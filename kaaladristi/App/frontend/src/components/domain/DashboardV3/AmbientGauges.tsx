import { useState } from 'react';
import { useMarketBreadth, useBreadthRoc, useIndustryRotation } from '@/hooks';
import Sparkline from './Sparkline';
import type { MarketBreadthDay, BreadthRocDay } from '@/types';

// ── Gauge card ────────────────────────────────────────────────────────────────

interface GaugeCardProps {
  label: string;
  value: string | number;
  sub: string;
  color: string;
  sparkValues?: number[];
  expanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}

function GaugeCard({ label, value, sub, color, sparkValues = [], expanded, onToggle, children }: GaugeCardProps) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: `1px solid ${expanded ? color : 'var(--border)'}`,
        borderRadius: 12,
        padding: '16px 18px',
        cursor: onToggle ? 'pointer' : 'default',
        transition: 'border-color 0.2s',
      }}
      onClick={onToggle}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.14em',
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              color,
            }}
          >
            {value}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)', marginTop: 5 }}>
            {sub}
          </div>
        </div>

        {sparkValues.length > 1 && (
          <Sparkline values={sparkValues} color={color} filled width={80} height={32} />
        )}
      </div>

      {expanded && children && (
        <div
          style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 12 }}
          onClick={e => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function breadthTone(score: number | null): { text: string; color: string } {
  if (score === null) return { text: '—', color: 'var(--text-faint)' };
  if (score >= 70) return { text: 'expanding', color: 'var(--bull)' };
  if (score >= 50) return { text: 'neutral+', color: 'var(--gold)' };
  if (score >= 30) return { text: 'neutral−', color: 'var(--caution)' };
  return { text: 'contracting', color: 'var(--bear)' };
}

function rocTone(val: number | null): { text: string; color: string } {
  if (val === null) return { text: '—', color: 'var(--text-faint)' };
  if (val > 0.5) return { text: 'accelerating', color: 'var(--bull)' };
  if (val > 0) return { text: 'positive', color: 'var(--gold)' };
  if (val > -0.5) return { text: 'slowing', color: 'var(--caution)' };
  return { text: 'declining', color: 'var(--bear)' };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AmbientGauges() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const breadth   = useMarketBreadth(14);
  const roc       = useBreadthRoc(14);
  const rotation  = useIndustryRotation();

  const toggle = (id: string) => setExpanded(v => v === id ? null : id);

  // Breadth
  const breadthRows  = (breadth.data ?? []) as MarketBreadthDay[];
  const latestB      = breadthRows[breadthRows.length - 1];
  const breadthScore = latestB?.breadth_score ?? null;
  const breadthSpark = breadthRows.slice(-6).map(d => d.breadth_score ?? 0);
  const bTone        = breadthTone(breadthScore);

  // ROC
  const rocRows  = (roc.data ?? []) as BreadthRocDay[];
  const latestR  = rocRows[rocRows.length - 1];
  const rocValue = latestR?.roc_13 ?? null;
  const rocSpark = rocRows.slice(-6).map(d => d.roc_13 ?? 0);
  const rTone    = rocTone(rocValue);

  // Rotation counts
  const rotationData    = rotation.data;
  const rotatingInCount = rotationData?.rotatingIn.length ?? 0;
  const leadingCount    = rotationData?.leading.length ?? 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>

      {/* ── Breadth score ── */}
      <GaugeCard
        label="Market Breadth"
        value={breadthScore !== null ? breadthScore.toFixed(0) : '—'}
        sub={bTone.text}
        color={bTone.color}
        sparkValues={breadthSpark}
        expanded={expanded === 'breadth'}
        onToggle={() => toggle('breadth')}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
          {([
            { lbl: 'above 20d', val: latestB?.pct_above_20, isCount: false },
            { lbl: 'above 50d', val: latestB?.pct_above_50, isCount: false },
            { lbl: 'above 150d', val: latestB?.pct_above_150, isCount: false },
            { lbl: 'stocks', val: latestB?.stock_count, isCount: true },
          ] as const).map(({ lbl, val, isCount }) => (
            <div key={lbl} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-faint)' }}>{lbl}</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {val != null ? (isCount ? val : `${(val as number).toFixed(0)}%`) : '—'}
              </span>
            </div>
          ))}
        </div>
      </GaugeCard>

      {/* ── Momentum ── */}
      <GaugeCard
        label="Momentum"
        value={rocValue !== null ? (rocValue > 0 ? `+${rocValue.toFixed(2)}` : rocValue.toFixed(2)) : '—'}
        sub={rTone.text}
        color={rTone.color}
        sparkValues={rocSpark}
        expanded={expanded === 'momentum'}
        onToggle={() => toggle('momentum')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {([
            { lbl: 'roc-13', val: latestR?.roc_13 },
            { lbl: 'roc-55', val: latestR?.roc_55 },
            { lbl: 'sma-5', val: latestR?.sma_breadth },
          ] as const).map(({ lbl, val }) => (
            <div key={lbl} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-faint)' }}>{lbl}</span>
              <span style={{ color: val != null && val > 0 ? 'var(--bull)' : val != null && val < 0 ? 'var(--bear)' : 'var(--text-faint)' }}>
                {val != null ? val.toFixed(3) : '—'}
              </span>
            </div>
          ))}
        </div>
      </GaugeCard>

      {/* ── Rotating In count ── */}
      <GaugeCard
        label="Rotating In"
        value={rotatingInCount}
        sub={rotatingInCount === 1 ? 'industry' : 'industries'}
        color={rotatingInCount > 0 ? 'var(--bull)' : 'var(--text-faint)'}
        expanded={expanded === 'rotating-in'}
        onToggle={rotatingInCount > 0 ? () => toggle('rotating-in') : undefined}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rotationData?.rotatingIn.map(item => (
            <div key={item.industry} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%' }}>
                {item.industry}
              </span>
              <span style={{ color: 'var(--bull)' }}>+{item.rank_change}</span>
            </div>
          ))}
        </div>
      </GaugeCard>

      {/* ── Leadership count ── */}
      <GaugeCard
        label="Leadership"
        value={leadingCount}
        sub={leadingCount === 1 ? 'industry in lead' : 'industries in lead'}
        color={leadingCount > 0 ? 'var(--gold)' : 'var(--text-faint)'}
        expanded={expanded === 'leadership'}
        onToggle={leadingCount > 0 ? () => toggle('leadership') : undefined}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rotationData?.leading.map(item => (
            <div key={item.industry} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%' }}>
                {item.industry}
              </span>
              <span style={{ color: 'var(--text-faint)' }}>#{item.industry_rank}</span>
            </div>
          ))}
        </div>
      </GaugeCard>

    </div>
  );
}
