import type { MarketBreadthDay, BreadthRocDay } from '@/types';
import { SIGNAL_COLOR, SIGNAL_TEXT } from './FlowIntensityMap';
import { momentumState, participationState, momentumLabel, type StructureState } from '@/lib/structureStates';

const color = (s: StructureState) => s === 'MISSING' ? 'var(--card)' : SIGNAL_COLOR[s];
type Row = { label: string; values: (number | null)[]; states: StructureState[]; digits: number; suffix: string };
export default function MarketStructureHistory({ breadth, roc, mode, onSelectDate }: {
  breadth: MarketBreadthDay[]; roc: BreadthRocDay[]; mode: 'breadth' | 'roc'; onSelectDate: (date: string) => void;
}) {
  const dates = (mode === 'breadth' ? breadth : roc).map(r => r.trade_date);
  const rows: Row[] = mode === 'breadth' ? (['pct_above_20', 'pct_above_50', 'pct_above_150'] as const).map((k, i) => ({
    label: `Above ${[20, 50, 150][i]} EMA`, values: breadth.map(r => r[k]),
    states: breadth.map((r, j) => participationState(r[k], breadth[j - 1]?.[k])), digits: 1, suffix: '%',
  })) : (['roc_13', 'roc_55', 'sma_breadth'] as const).map((k, i) => ({
    label: ['ROC 13', 'ROC 55', 'Signal (5)'][i], values: roc.map(r => r[k]),
    states: roc.map(r => r[k] == null ? 'MISSING' : i === 0 ? momentumState(r.roc_13, r.sma_breadth) : 'QUIET'), digits: 4, suffix: '',
  }));
  if (mode === 'breadth') {
    (['up_5pct', 'down_5pct', 'up_20pct_5d', 'down_20pct_5d'] as const).forEach((k, i) => {
      if (!breadth.some(r => r[k] != null && (r.universe_count ?? 0) > 0)) return;
      rows.push({ label: ['Up >5% (session)', 'Down >5% (session)', 'Up >20% (5D)', 'Down >20% (5D)'][i],
        values: breadth.map(r => r[k] != null && (r.universe_count ?? 0) > 0 ? r[k]! / r.universe_count! * 100 : null),
        states: breadth.map(() => 'QUIET'), digits: 1, suffix: '%' });
    });
  }
  return <details className="glass-card rounded-xl p-4"><summary className="cursor-pointer text-sm font-medium">{mode === 'breadth' ? 'Participation' : 'Momentum'} history · visible values</summary>
    <p className="text-xs text-muted my-3">Oldest → latest. Select a session to read that snapshot with VaNi. {dates.length} available sessions.</p>
    <div className="overflow-x-auto" tabIndex={0} aria-label="Scrollable historical readings"><table className="text-[11px] border-separate border-spacing-1 w-full"><caption className="sr-only">{mode} historical values, chronological order</caption><thead><tr><th className="min-w-[140px] text-left">Measure</th>{dates.map(d => <th key={d} className="min-w-[68px] font-normal"><button className="text-accent-indigo underline" onClick={() => onSelectDate(d)} aria-label={`Read ${d}`}>{d.slice(5)}</button></th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row" className="text-left font-normal text-[var(--text-secondary)]">{row.label}</th>{row.values.map((v, i) => {
      const state = v == null ? 'MISSING' : row.states[i];
      const title = mode === 'roc' && row.label === 'ROC 13' ? momentumLabel(roc[i].roc_13, roc[i].sma_breadth) : state.toLowerCase();
      return <td key={dates[i]} title={`${dates[i]} · ${title}`} className="rounded text-center px-2 py-2 font-mono border border-[var(--border)]" style={{ background: color(state), color: state === 'MISSING' ? 'var(--text-muted)' : SIGNAL_TEXT[state] }}><span>{v == null ? '—' : `${v.toFixed(row.digits)}${row.suffix}`}</span><span className="sr-only"> {title}</span></td>;
    })}</tr>)}</tbody></table></div>
    <p className="text-[11px] text-muted mt-3">{mode === 'breadth' ? 'Participation: green = higher than the previous available session; amber = lower; slate = unchanged. The first session has no comparison. Mover rows show percentages without a condition color.' : 'ROC 13: green = above signal (recovering if negative); amber = positive, below signal; red = negative, below signal; slate = zero or equal to signal. ROC 55 and signal rows are neutral comparisons.'} Missing values use a dash. Colors are fixed rules, not scaled to the selected window.</p>
  </details>;
}
