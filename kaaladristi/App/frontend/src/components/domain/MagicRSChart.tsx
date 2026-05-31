/**
 * MagicRSChart — Long + Short MagicRS over time (Recharts)
 *
 * Long RS  : solid line, green above MA / red below MA
 * Short RS : dashed lighter line
 * Long MA  : solid blue reference line
 * Background: green segments where long RS > MA, red where RS < MA
 * Crossover dots where long RS crosses long MA
 * Signal badge + current values in top-right overlay
 */

import React, { useMemo } from 'react';
import {
  ComposedChart, Line, ReferenceLine, ReferenceArea,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MagicRSDataPoint {
  trade_date: string;
  magic_rs: number | null;
  magic_ma: number | null;
  magic_rs_zone: string | null;
  magic_rs_short: number | null;
  magic_rs_short_ma: number | null;
  magic_rs_short_zone: string | null;
}

export interface MagicRSLatest {
  long_rs: number | null;
  long_ma: number | null;
  long_zone: string | null;
  short_rs: number | null;
  short_ma: number | null;
  short_zone: string | null;
  signal: 'Strong Alignment' | 'Emerging Recovery' | 'Tactical Pullback' | 'Negative Alignment';
}

interface MagicRSChartProps {
  data: MagicRSDataPoint[];
  latest: MagicRSLatest | null;
  symbol: string;
  height?: number;
}

// ── Colours ───────────────────────────────────────────────────────────────────

const COL = {
  green:      'var(--bull)',
  greenFaint: 'color-mix(in srgb, var(--bull) 13%, transparent)',
  red:        'var(--bear)',
  redFaint:   'color-mix(in srgb, var(--bear) 13%, transparent)',
  blue:       '#3b82f6',
  shortRS:    '#94a3b8',  // slate-400 — neutral, never green/red
  zero:       '#475569',
  grid:       'var(--bg)',
  text:       '#64748b',
  bg:         'var(--bg)',
};

const SIGNAL_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  'Strong Alignment':   { bg: 'var(--bull-bg)', text: 'var(--bull)', label: 'Strong Alignment' },
  'Emerging Recovery':  { bg: 'var(--caution-bg)', text: 'var(--caution)', label: 'Emerging Recovery' },
  'Tactical Pullback':  { bg: '#14b8a622', text: '#14b8a6', label: 'Tactical Pullback' },
  'Negative Alignment': { bg: 'var(--bear-bg)', text: 'var(--bear)', label: 'Negative Alignment' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${day}`;
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '—';
  return (v > 0 ? '+' : '') + v.toFixed(2);
}

// Compute x-domain segments where long RS is above vs below long MA
function computeSegments(data: MagicRSDataPoint[]): { x1: string; x2: string; above: boolean }[] {
  const segs: { x1: string; x2: string; above: boolean }[] = [];
  let segStart: string | null = null;
  let segAbove: boolean | null = null;

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    if (d.magic_rs == null || d.magic_ma == null) continue;
    const above = d.magic_rs >= d.magic_ma;

    if (segStart === null) {
      segStart = d.trade_date;
      segAbove = above;
    } else if (above !== segAbove) {
      segs.push({ x1: segStart, x2: data[i - 1].trade_date, above: segAbove! });
      segStart = d.trade_date;
      segAbove = above;
    }
  }
  if (segStart !== null && segAbove !== null) {
    segs.push({ x1: segStart, x2: data[data.length - 1].trade_date, above: segAbove });
  }
  return segs;
}

// Detect crossover indices (sign change of RS - MA)
function crossoverIndices(data: MagicRSDataPoint[]): Set<number> {
  const set = new Set<number>();
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    if (prev.magic_rs == null || prev.magic_ma == null) continue;
    if (curr.magic_rs == null || curr.magic_ma == null) continue;
    const prevDiff = prev.magic_rs - prev.magic_ma;
    const currDiff = curr.magic_rs - curr.magic_ma;
    if (prevDiff * currDiff < 0) set.add(i);
  }
  return set;
}

// ── Custom Dot — only renders on crossover points ────────────────────────────

function CrossoverDot(props: {
  cx?: number; cy?: number; index?: number; crossovers: Set<number>;
}) {
  const { cx, cy, index, crossovers } = props;
  if (cx == null || cy == null || index == null) return null;
  if (!crossovers.has(index)) return null;
  return <circle cx={cx} cy={cy} r={4} fill="var(--caution)" stroke={COL.bg} strokeWidth={1.5} />;
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function RSTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const get = (name: string) => payload.find(p => p.name === name)?.value;
  const longRS = get('magic_rs');
  const longMA = get('magic_ma');
  const shortRS = get('magic_rs_short');

  return (
    <div style={{
      background: '#0f172a', border: '1px solid var(--bg)',
      borderRadius: 6, padding: '8px 12px', fontSize: 11,
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ color: COL.text, marginBottom: 4 }}>{label}</div>
      {longRS != null && (
        <div style={{ color: longRS >= (longMA ?? 0) ? COL.green : COL.red }}>
          Long RS {fmt(longRS)}
        </div>
      )}
      {longMA != null && (
        <div style={{ color: COL.blue }}>Long MA {fmt(longMA)}</div>
      )}
      {shortRS != null && (
        <div style={{ color: COL.shortRS }}>Short RS {fmt(shortRS)}</div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MagicRSChart({ data, latest, symbol, height = 320 }: MagicRSChartProps) {
  const segments  = useMemo(() => computeSegments(data), [data]);
  const crossovers = useMemo(() => crossoverIndices(data), [data]);

  const signalStyle = latest?.signal ? (SIGNAL_STYLE[latest.signal] ?? SIGNAL_STYLE['Negative Alignment']) : null;

  // Tick reducer — show ~6 evenly spaced labels
  const tickInterval = Math.max(1, Math.floor(data.length / 6));

  return (
    <div style={{ position: 'relative', background: COL.bg, borderRadius: 8, padding: '12px 0 4px' }}>

      {/* Top-right overlay: current values + signal badge */}
      <div style={{
        position: 'absolute', top: 12, right: 16, zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
      }}>
        {signalStyle && (
          <span style={{
            background: signalStyle.bg,
            color: signalStyle.text,
            border: `1px solid ${signalStyle.text}44`,
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em',
          }}>
            {signalStyle.label}
          </span>
        )}
        {latest && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: COL.text, textAlign: 'right' }}>
            <span style={{ color: latest.long_rs != null && latest.long_ma != null && latest.long_rs >= latest.long_ma ? COL.green : COL.red }}>
              L {fmt(latest.long_rs)}
            </span>
            <span style={{ color: COL.blue, marginLeft: 8 }}>MA {fmt(latest.long_ma)}</span>
            <span style={{ color: COL.shortRS, marginLeft: 8 }}>S {fmt(latest.short_rs)}</span>
          </div>
        )}
      </div>

      {/* Symbol label top-left */}
      <div style={{
        position: 'absolute', top: 12, left: 16, zIndex: 10,
        fontFamily: 'var(--font-mono)', fontSize: 10,
        letterSpacing: '0.1em', color: COL.text, textTransform: 'uppercase',
      }}>
        {symbol} · MagicRS
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 28, right: 16, bottom: 4, left: 0 }}>

          <XAxis
            dataKey="trade_date"
            tickFormatter={fmtDate}
            interval={tickInterval}
            tick={{ fill: COL.text, fontSize: 9, fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: COL.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: COL.text, fontSize: 9, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => (v > 0 ? '+' : '') + v.toFixed(0)}
            width={36}
          />

          <Tooltip content={<RSTooltip />} />

          {/* Zero reference line */}
          <ReferenceLine y={0} stroke={COL.zero} strokeDasharray="3 4" strokeWidth={1} />

          {/* Background segments: green = RS above MA, red = RS below MA */}
          {segments.map((seg, idx) => (
            <ReferenceArea
              key={idx}
              x1={seg.x1}
              x2={seg.x2}
              fill={seg.above ? COL.greenFaint : COL.redFaint}
              strokeOpacity={0}
            />
          ))}

          {/* Long MA — blue solid */}
          <Line
            dataKey="magic_ma"
            stroke={COL.blue}
            strokeWidth={1.5}
            dot={false}
            connectNulls
            name="magic_ma"
            isAnimationActive={false}
          />

          {/* Short RS — dashed slate */}
          <Line
            dataKey="magic_rs_short"
            stroke={COL.shortRS}
            strokeWidth={1}
            strokeDasharray="4 2"
            dot={false}
            connectNulls
            name="magic_rs_short"
            isAnimationActive={false}
          />

          {/* Long RS — solid, green when above MA else red, crossover dots */}
          <Line
            dataKey="magic_rs"
            stroke={latest?.long_rs != null && latest?.long_ma != null && latest.long_rs >= latest.long_ma
              ? COL.green : COL.red}
            strokeWidth={2}
            connectNulls
            name="magic_rs"
            isAnimationActive={false}
            dot={(props) => <CrossoverDot {...props} crossovers={crossovers} />}
            activeDot={{ r: 4, fill: 'var(--caution)', strokeWidth: 0 }}
          />

        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 14, padding: '0 16px 4px',
        fontFamily: 'var(--font-mono)', fontSize: 9, color: COL.text,
      }}>
        <span><span style={{ color: COL.green }}>──</span> Long RS</span>
        <span><span style={{ color: COL.blue }}>──</span> Long MA</span>
        <span><span style={{ color: COL.shortRS }}>- -</span> Short RS</span>
        <span><span style={{ color: 'var(--caution)' }}>●</span> Crossover</span>
      </div>
    </div>
  );
}
