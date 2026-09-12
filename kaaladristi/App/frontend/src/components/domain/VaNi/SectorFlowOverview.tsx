import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MicroTrend } from '@/components/domain/FlowIntensityMap';
import { sectorSignal } from '@/lib/sectorFlow';

export interface OverviewRow {
  index_id: number; name: string; trade_date: string;
  score_5d: number | null; score_22d: number | null;
  avg_amt_5d: number | null; avg_amt_22d: number | null; ret_5d: number | null;
}
const groups = [
  { label: 'Money Entering', states: ['STRONG','BUILDING'], color: 'var(--risk-green)' },
  { label: 'Fading', states: ['FADING'], color: 'var(--risk-amber)' },
  { label: 'Money Leaving', states: ['OUTFLOW'], color: 'var(--risk-red)' },
];
export default function SectorFlowOverview({ rows, history, date, period, total }: {
  rows: OverviewRow[]; history: OverviewRow[]; date: string; period: number; total: number;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const quiet = rows.filter(r => sectorSignal(r) === 'QUIET').length;
  const unavailable = Math.max(0, total - rows.length) + rows.filter(r => sectorSignal(r) == null).length;
  return <div aria-label="Sector flow snapshot" className="space-y-3">
    {groups.map(group => {
      const members = rows.filter(r => group.states.includes(sectorSignal(r) ?? '')).sort((a,b)=>(group.label === 'Money Leaving' ? (a.ret_5d ?? 0)-(b.ret_5d ?? 0) : (b.score_5d ?? 0)-(a.score_5d ?? 0)) || a.name.localeCompare(b.name));
      const all = expanded.includes(group.label);
      return <section key={group.label} className="rounded-xl border border-[var(--border)] p-3" style={{borderTop:`2px solid ${group.color}`}}>
        <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-medium" style={{color:group.color}}>{group.label}</h4><span className="text-lg font-semibold font-mono" aria-label={`${members.length} indices ${group.label.toLowerCase()}`}>{members.length}</span></div>
        {members.length ? <><div className="grid grid-cols-[minmax(0,1fr)_34px_34px_56px] gap-1 text-[9px] text-muted mt-2" aria-hidden="true"><span>Index</span><span>Flow 5D</span><span>Flow 22D</span><span>Trend</span></div>
          {(all ? members : members.slice(0,3)).map(row => {
            const series = history.filter(r=>r.index_id===row.index_id).sort((a,b)=>b.trade_date.localeCompare(a.trade_date)).slice(0,period);
            return <Link key={row.index_id} to={`/sector-rotation/${row.index_id}?asof=${date}`} className="grid grid-cols-[minmax(0,1fr)_34px_34px_56px] items-center gap-1 py-2 border-b border-[var(--border)] last:border-0" aria-label={`${row.name}, Flow 5D ${row.score_5d?.toFixed(1)}, Flow 22D ${row.score_22d?.toFixed(1)}. Open index details.`}>
              <span className="text-[11px] leading-4 break-words">{row.name}</span><span className="text-[11px] font-mono text-right">{row.score_5d?.toFixed(1) ?? '—'}</span><span className="text-[11px] font-mono text-right text-muted">{row.score_22d?.toFixed(1) ?? '—'}</span>
              <span className="overflow-hidden" aria-label={`${series.length} session flow trend, oldest to newest`}><span className="block origin-left scale-x-75"><MicroTrend height={38} rowData={series.map(r=>({d1:0,amt:0,s5:r.score_5d ?? undefined,s22:r.score_22d ?? undefined}))}/></span></span>
            </Link>;
          })}
          {members.length > 3 && <button className="text-xs underline min-h-11" aria-expanded={all} onClick={()=>setExpanded(s=>all?s.filter(g=>g!==group.label):[...s,group.label])}>{all?'Show fewer':`View all ${members.length}`}</button>}</>
          : <p className="text-xs text-muted py-2">No indices in this group.</p>}
      </section>;
    })}
    <p className="text-xs text-muted">Quiet <strong>{quiet}</strong> · Unavailable <strong>{unavailable}</strong></p>
    <p className="text-[10px] leading-5 text-muted">Showing up to 3 examples per group, Entering/fading ordered by Flow 5D; leaving by weakest 5D return. Mini-trends: up to {period} sessions, oldest → newest; each uses its own scale.</p>
  </div>;
}
