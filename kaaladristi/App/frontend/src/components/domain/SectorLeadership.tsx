import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLeadership, type LeadershipRow } from '@/services/sectorLeadership';
import type { SectorTab } from '@/services/sectorRotation';
import { sectorSessionDate, SECTOR_FLOW_STYLE } from '@/lib/sectorFlow';
import type { FlowSignal } from '@/components/domain/FlowIntensityMap';
import MagicRsSubchart from './VisualPulse/MagicRsSubchart';
import '@/styles/sectorResearch.css';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const groups = ['Running broadly', 'Building', 'Cooling', 'Limited coverage', 'Not aligned', 'Unavailable'] as const;
const tone = (s:string) => s==='Running broadly'?'var(--risk-green)':s==='Building'||s==='Cooling'?'var(--risk-amber)':'var(--text-muted)';
const state = (v:boolean|null) => v==null?'Unavailable':v?'Aligned':'Not aligned';
function Alignment({label,value}:{label:string;value:boolean|null}) {
 return <span className="leadership-alignment" title={`${label}: ${state(value)}`}><i style={{background:value==null?'var(--text-muted)':value?'var(--risk-green)':'var(--risk-red)'}}/>{label} {value==null?'—':value?'✓':'−'}</span>;
}
function Support({row}:{row:LeadershipRow}) {
 const c=row.current;
 return <div><strong>{c.leaders??0}/{c.eligible} Leaders</strong><small>{c.watch??0} Watch · {c.eligible}/{c.total} classified</small>
  <div className="leadership-support" aria-label={`${c.leaders??0} Leaders out of ${c.eligible} classified constituents`}><span style={{width:`${c.eligible?100*(c.leaders??0)/c.eligible:0}%`}}/></div>
  {row.status==='Limited coverage'&&<small>Too few readings for broad support</small>}</div>;
}
function History({row}:{row:LeadershipRow}) {
 return <div><strong>{row.aligned_streak} completed weeks</strong><div className="leadership-strip" role="img" aria-label={`${row.name}: weekly and monthly alignment history, oldest to latest`}>
  {row.alignment_history.map(s=><span key={s.date} title={`${sectorSessionDate(s.date)}: W ${state(s.weekly)}, M ${state(s.monthly)}`} style={{background:s.weekly==null||s.monthly==null?'var(--text-muted)':s.weekly&&s.monthly?'var(--risk-green)':s.weekly||s.monthly?'var(--risk-amber)':'var(--risk-red)'}}/>)}</div><small>Current W/M agreement run</small></div>;
}
function Flow({row}:{row:LeadershipRow}) {
 const f=row.flow; const style=SECTOR_FLOW_STYLE[f?.state.toUpperCase() as FlowSignal];
 return <div><strong className="leadership-flow-badge" style={{color:style?.color??'var(--text-secondary)',background:style?.bg??'var(--border)'}}>{f?.state??'Unavailable'}</strong><small>5D {f?.score_5d?.toFixed(1)??'—'} · 22D {f?.score_22d?.toFixed(1)??'—'}</small></div>;
}
export function SectorLeadershipEvidence({row,months,showLink=true}:{row:LeadershipRow;months:number;showLink?:boolean}) {
 const [tf,setTf]=useState<'weekly'|'monthly'>('weekly');
 const series=row.charts[tf]; const latest=series.at(-1);
 const variant=tf==='weekly'?row.charts.weekly_method:'short';
 return <div className="leadership-evidence">
  <div className="sector-toolbar"><h3>MagicRS · {row.name}</h3><div className="sector-tabs">{(['weekly','monthly'] as const).map(t=><button key={t} className="sector-question" aria-pressed={tf===t} onClick={()=>setTf(t)}>{t==='weekly'?'Weekly':'Monthly'}</button>)}</div></div>
  <p>{tf==='weekly'?'Weekly':'Monthly'}: <strong>{state(row.current[tf])}</strong> · completed close {row.current[`${tf}_date`]?sectorSessionDate(row.current[`${tf}_date`]!):'unavailable'} · benchmark NIFTY 500</p>
  {series.some(s=>s.magic_rs!=null)?<><MagicRsSubchart data={series} activeIndex={-1} benchmarkLabel="NIFTY 500" variant={variant} showStats={false}/>
   <p>MagicRS <strong>{latest?.magic_rs?.toFixed(2)??'—'}</strong> · {variant==='long'?60:21}-period average <strong>{latest?.magic_ma?.toFixed(2)??'—'}</strong></p></>:<p>No completed MagicRS readings in this window. Try a longer history window.</p>}
  <p className="text-xs text-muted">{variant==='long'?'144-period RS; weekly agreement means RS is above its 60-period average.':'21-period RS; agreement means RS is above zero.'} Chart shading shows RS relative to its average, which can differ from agreement. A missing average means insufficient warm-up history.</p>
  <p className="text-xs text-muted">{series.length?`${sectorSessionDate(series[0].trade_date)} → ${sectorSessionDate(series.at(-1)!.trade_date)} · `:''}{months}-month display. Historical support uses current recorded constituents.</p>
  {showLink && <Link className="sector-question inline-flex items-center" to={`/sector-rotation/${row.index_id}?asof=${row.current.date}&research=leadership&months=${months}`}>Open full sector evidence →</Link>}
 </div>;
}
export function SelectedSectorLeadership({indexId,category,date,months}:{indexId:number;category:SectorTab;date:string;months:number}) {
 const {data,isFetching,error,refetch}=useLeadership(category,date,months);
 const row=data?.rows.find(r=>r.index_id===indexId);
 if(isFetching) return <p role="status" className="p-4">Loading published longer-term readings…</p>;
 if(error) return <div role="alert" className="p-4"><p>{error.message}</p><button className="sector-question" onClick={()=>refetch()}>Retry longer-term readings</button></div>;
 if(!row) return <p className="p-4">No longer-term reading is available for this index and session.</p>;
 return <section className="leadership-view p-4" aria-label="Selected index longer-term strength">
  <h2>Longer-term strength · {row.status}</h2>
  <p className="text-sm text-muted">Completed weekly and monthly readings · selected session {sectorSessionDate(date)}. Current flow is a separate observation.</p>
  <div className="leadership-mobile-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:16,margin:"12px 0"}}><div><small>MagicRS agreement</small><Alignment label="Weekly" value={row.current.weekly}/><Alignment label="Monthly" value={row.current.monthly}/></div><Support row={row}/><History row={row}/><Flow row={row}/></div>
  <SectorLeadershipEvidence row={row} months={months} showLink={false}/>
 </section>;
}

export default function SectorLeadership({category,date,months}:{category:SectorTab;date?:string;months:number}) {
 const {data,isFetching,error,refetch}=useLeadership(category,date,months);
 const mobile=useMediaQuery('(max-width: 1100px)');
 const [filter,setFilter]=useState('All'); const [expanded,setExpanded]=useState<number|null>(null);
 if(isFetching) return <p role="status" className="p-4">Loading published longer-term readings…</p>;
 if(error) return <div role="alert" className="p-4"><p>{error.message}</p><button className="sector-question" onClick={()=>refetch()}>Retry longer-term readings</button></div>;
 const all=data?.rows??[];
 const rows=all.filter(r=>filter==='All'||r.status===filter).sort((a,b)=>groups.indexOf(a.status)-groups.indexOf(b.status)||b.aligned_streak-a.aligned_streak||a.name.localeCompare(b.name));
 const name=(r:LeadershipRow)=><Link to={`/sector-rotation/${r.index_id}?asof=${r.current.date}&research=leadership&months=${months}`}>{r.name}</Link>;
 const toggle=(r:LeadershipRow)=><button className="sector-question" aria-expanded={expanded===r.index_id} onClick={()=>setExpanded(expanded===r.index_id?null:r.index_id)}>MagicRS {expanded===r.index_id?'−':'+'}</button>;
 return <section className="leadership-view" aria-label="Longer-term leadership">
  <div><h2>Which baskets are holding their strength?</h2><p className="text-sm text-muted">Compare longer-term agreement, constituent support and today’s flow.</p></div>
  <div className="leadership-filters" aria-label="Filter longer-term groups">{['All',...groups].map(g=><button key={g} className="sector-question" aria-pressed={filter===g} onClick={()=>setFilter(g)}>{g} <strong>{g==='All'?all.length:all.filter(r=>r.status===g).length}</strong></button>)}</div>
  <p className="text-xs text-muted">Closing data: {data?.date?sectorSessionDate(data.date):'unavailable'} · History: {months} months · Window changes history, not the current group.</p>
  {!rows.length&&<p>No baskets in this group for the selected session.</p>}
  {!!rows.length&&<>
   {!mobile&&<div className="leadership-desktop"><table className="leadership-table"><thead><tr><th>Basket</th><th>Longer-term story</th><th>MagicRS</th><th>Stage 2 support</th><th>Agreement history</th><th>Current flow</th></tr></thead><tbody>{rows.map(r=><Fragment key={r.index_id}><tr><td>{name(r)}</td><td><strong style={{color:tone(r.status)}}>{r.status}</strong></td><td><div className="leadership-alignments"><Alignment label="W" value={r.current.weekly}/><Alignment label="M" value={r.current.monthly}/></div>{toggle(r)}</td><td><Support row={r}/></td><td><History row={r}/></td><td><Flow row={r}/></td></tr>{expanded===r.index_id&&<tr><td colSpan={6}><SectorLeadershipEvidence row={r} months={months}/></td></tr>}</Fragment>)}</tbody></table></div>}
   {mobile&&<div className="leadership-mobile">{rows.map(r=><article key={r.index_id}><div className="space-y-2">{name(r)}<p style={{color:tone(r.status)}}>{r.status}</p></div><div className="leadership-mobile-grid"><div><small>MagicRS agreement</small><Alignment label="W" value={r.current.weekly}/><Alignment label="M" value={r.current.monthly}/></div><div><small>Current flow</small><Flow row={r}/></div><Support row={r}/><History row={r}/></div>{toggle(r)}{expanded===r.index_id&&<SectorLeadershipEvidence row={r} months={months}/>}</article>)}</div>}
  </>}
  <p className="text-xs text-muted">History: oldest → latest · Green: W/M agree · Amber: one agrees · Red: neither · Grey: missing. W = weekly, M = monthly. Leaders and Watch are observed stage classifications.</p>
  <details className="leadership-rules"><summary>How are these groups decided?</summary><p>Running broadly: W/M agreement for at least 8 completed weeks, at least 60% Leaders among classified constituents, at least 5 classified and 80% membership coverage.</p><p>Building: W/M agree, but those persistence or support requirements are not met. Cooling: agreement was lost after agreement within the previous 26 weekly observations.</p><p>Limited coverage: fewer than 5 classified or less than 80% coverage. Unavailable: insufficient W/M readings. Not aligned: no current agreement and no recent agreement to classify as Cooling.</p><p>Changing current flow does not automatically change the longer-term story. These groups describe evidence; they do not predict continuation. Reconstructed history uses current membership.</p></details>
 </section>;
}