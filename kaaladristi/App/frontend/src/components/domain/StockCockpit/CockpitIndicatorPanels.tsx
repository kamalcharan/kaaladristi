/**
 * CockpitIndicatorPanels — collapsible evidence panels below the Study chart.
 *
 * Replaces the subpanes that used to be fused into the chart's legacy mode:
 * when the chart moved to the single framework-driven rendering path (owner
 * 2026-07-07: no hardcoded lines, both Study surfaces identical), the
 * RSI/Sniper/MagicRS readings became standalone panels — same pattern as the
 * Intraday page's IndicatorPanels. Daily timeframe only (the columns don't
 * exist on weekly/monthly bars); a panel hides itself when its data is absent.
 */

import { useState } from 'react';
import {
  LineChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, YAxis,
} from 'recharts';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { IndicatorRow } from '@/services/indicatorData';

const PANEL_H = 110;
const WINDOW = 130; // sessions shown — matches the Pulse bar window

interface SeriesDef {
  key: keyof IndicatorRow;
  color: string;
  label: string;
  dashed?: boolean;
}

interface PanelDef {
  id: string;
  title: string;
  series: SeriesDef[];
  refLines?: { y: number; label?: string }[];
  domain?: [number | 'auto', number | 'auto'];
}

const PANELS: PanelDef[] = [
  {
    id: 'momentum',
    title: 'Momentum · RSI / MFI',
    series: [
      { key: 'rsi_14', color: 'var(--accent-violet, #8b5cf6)', label: 'RSI 14' },
      { key: 'mfi_14', color: 'var(--accent-cyan, #06b6d4)', label: 'MFI 14' },
    ],
    refLines: [{ y: 70 }, { y: 30 }],
    domain: [0, 100],
  },
  {
    id: 'smart_money',
    title: 'Smart Money · Institution / Hot Money',
    series: [
      { key: 'sniper_inst', color: 'var(--accent-indigo, #6366f1)', label: 'Institution' },
      { key: 'sniper_hot', color: 'var(--caution, #f59e0b)', label: 'Hot Money' },
    ],
    refLines: [{ y: 35 }],
    domain: [0, 50],
  },
  {
    id: 'magic_rs',
    title: 'Magic RS · vs benchmark',
    series: [
      { key: 'magic_rs', color: 'var(--gold, #d4a84b)', label: 'Magic RS' },
      { key: 'magic_ma', color: 'var(--text-faint, #64748b)', label: 'MA', dashed: true },
    ],
    refLines: [{ y: 0 }],
    domain: ['auto', 'auto'],
  },
];

function Panel({ def, rows }: { def: PanelDef; rows: IndicatorRow[] }) {
  const [open, setOpen] = useState(def.id === 'momentum');

  const data = rows.slice(-WINDOW).map((r) => {
    const point: Record<string, unknown> = { trade_date: r.trade_date };
    for (const sr of def.series) point[sr.key as string] = r[sr.key];
    return point;
  });

  // Hide the panel entirely when none of its series carry data
  const hasData = def.series.some((sr) => data.some((d) => d[sr.key as string] != null));
  if (!hasData) return null;

  return (
    <div className="glass-card rounded-xl px-3 py-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 text-left"
      >
        {open ? <ChevronDown className="w-3 h-3 text-muted" /> : <ChevronRight className="w-3 h-3 text-muted" />}
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted">
          {def.title}
        </span>
        <span className="ml-auto flex items-center gap-3">
          {def.series.map((sr) => (
            <span key={String(sr.key)} className="flex items-center gap-1 text-[9px] text-muted">
              <span className="inline-block w-3 h-0.5 rounded" style={{ background: sr.color }} />
              {sr.label}
            </span>
          ))}
        </span>
      </button>

      {open && (
        <div className="mt-1">
          <ResponsiveContainer width="100%" height={PANEL_H}>
            <LineChart data={data} margin={{ top: 6, right: 4, bottom: 2, left: 4 }}>
              <YAxis
                domain={def.domain}
                width={30}
                tick={{ fontSize: 9, fill: 'var(--text-faint)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10,
                }}
                labelFormatter={(l: unknown, payload: unknown) => {
                  const p = payload as Array<{ payload?: { trade_date?: string } }>;
                  return p?.[0]?.payload?.trade_date ?? String(l);
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [typeof v === 'number' ? v.toFixed(1) : v, name]}
              />
              {(def.refLines ?? []).map((rl) => (
                <ReferenceLine key={rl.y} y={rl.y} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
              ))}
              {def.series.map((sr) => (
                <Line
                  key={String(sr.key)}
                  type="monotone"
                  dataKey={sr.key as string}
                  name={sr.label}
                  stroke={sr.color}
                  strokeWidth={1.5}
                  strokeDasharray={sr.dashed ? '4 3' : undefined}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function CockpitIndicatorPanels({ rows }: { rows: IndicatorRow[] }) {
  return (
    <div className="flex flex-col gap-2 mt-2">
      {PANELS.map((def) => (
        <Panel key={def.id} def={def} rows={rows} />
      ))}
    </div>
  );
}
