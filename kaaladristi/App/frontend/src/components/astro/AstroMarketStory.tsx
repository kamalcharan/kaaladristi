import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AstroBand } from '@/services/astroOverlayService';
import { fetchIndexStudyWindow, type IndicatorRow } from '@/services/indicatorData';
import { fetchMarketBreadth, fetchBreadthRoc } from '@/services/panchang';
import { fetchSectorIndices, SECTOR_TAB_CATEGORIES } from '@/services/sectorRotation';
import { astroMarketSequence, percentChange, relativeRatioChange } from '@/services/astroMarketStory';
import { astroToday } from '@/services/astroEvents';
import { shiftStudyDate } from '@/services/astroStudy';
import type { StoryEvent } from '@/services/storyEvents';
import MarketBreadthChart from '@/components/domain/MarketBreadthChart';
import BreadthRocChart from '@/components/domain/BreadthRocChart';
import SignalLineChart from '@/components/domain/StockCockpit/SignalLineChart';

const value = (n: number | null | undefined, digits = 2) => n == null ? 'Unavailable' : Number(n).toLocaleString('en-IN',{maximumFractionDigits:digits});
const change = (n: number | null | undefined) => n == null ? 'Unavailable' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const exact = <T extends {trade_date:string}>(data:T[]|undefined,date:string|undefined) => date ? data?.find(r=>r.trade_date===date) : undefined;

/** Evidence around an event, composed inside ChartView; never another price chart. */
export default function AstroMarketStory({ band, rows, events, indexId, cutoff, activeDate, onInspect, compact = false }: {
  band: AstroBand; rows: IndicatorRow[]; events: StoryEvent[]; indexId: number;
  cutoff?: string; activeDate?: string; onInspect: (date:string) => void; compact?: boolean;
}) {
  const [evidenceOpen,setEvidenceOpen] = useState(!compact);
  const observedThrough = cutoff ?? astroToday();
  const sequence = astroMarketSequence(band,rows,observedThrough);
  const { anchor, checkpoints, firstBreak, direction, boundary, failure } = sequence;
  const start = shiftStudyDate(band.from,-90);
  const end = [shiftStudyDate(band.to,45),observedThrough].sort()[0];
  const window = {start,end};
  const breadth = useQuery({queryKey:['market-breadth','event-window',start,end],queryFn:()=>fetchMarketBreadth(400,window),staleTime:300_000});
  const roc = useQuery({queryKey:['breadth-roc','event-window',start,end],queryFn:()=>fetchBreadthRoc(400,window),staleTime:300_000});
  const vix = useQuery({queryKey:['index-window',94,start,end],queryFn:()=>fetchIndexStudyWindow(94,start,end),staleTime:300_000});
  const nifty = useQuery({queryKey:['index-window',1,start,end],queryFn:()=>fetchIndexStudyWindow(1,start,end),enabled:evidenceOpen && indexId!==1,staleTime:300_000});
  const benchmark = indexId===1 ? rows : nifty.data;
  const [ratioHorizon,setRatioHorizon] = useState(5);
  const ratioEnd = sequence.upcoming ? undefined : ratioHorizon===-1 ? sequence.periodEnd : rows.filter(r=>r.trade_date<=observedThrough)[sequence.at+ratioHorizon];
  const sectorStart = useQuery({queryKey:['sector-indices','sectoral',anchor?.trade_date],queryFn:()=>fetchSectorIndices(SECTOR_TAB_CATEGORIES.sectoral,anchor!.trade_date),enabled:evidenceOpen && !!anchor && !sequence.upcoming,staleTime:300_000});
  const sectorEnd = useQuery({queryKey:['sector-indices','sectoral',ratioEnd?.trade_date],queryFn:()=>fetchSectorIndices(SECTOR_TAB_CATEGORIES.sectoral,ratioEnd!.trade_date),enabled:evidenceOpen && !!ratioEnd,staleTime:300_000});
  const rankings = useMemo(()=>{
    const b0=exact(benchmark,anchor?.trade_date),b1=exact(benchmark,ratioEnd?.trade_date);
    if(!b0||!b1)return [];
    return (sectorStart.data ?? []).flatMap(s=>{
      const last=sectorEnd.data?.find(e=>e.index_id===s.index_id);
      if(!last)return [];
      const ratio=relativeRatioChange(s.close,last.close,b0.close,b1.close);
      return ratio==null ? [] : [{id:s.index_id,name:s.name,ratio,price:percentChange(s.close,last.close)}];
    }).sort((a,b)=>b.ratio-a.ratio);
  },[benchmark,anchor,ratioEnd,sectorStart.data,sectorEnd.data]);
  const [chosen,setChosen] = useState<number[]|null>(null);
  const selectedIds = chosen ?? rankings.slice(0,3).map(s=>s.id);
  const ratios = useQuery({
    queryKey:['astro-sector-ratio-series',start,ratioEnd?.trade_date,selectedIds.join(',')],
    queryFn:()=>Promise.all(selectedIds.map(async id=>({id,rows:await fetchIndexStudyWindow(id,start,ratioEnd!.trade_date)}))),
    enabled:evidenceOpen && !!ratioEnd && selectedIds.length>0, staleTime:300_000,
  });
  const ratioData = useMemo(()=>{
    if(!anchor||!ratioEnd)return [];
    const b0=exact(benchmark,anchor.trade_date);
    if(!b0)return [];
    return (benchmark ?? []).filter(b=>b.trade_date>=anchor.trade_date&&b.trade_date<=ratioEnd.trade_date).map(b=>{
      const point:Record<string,number|string|null>={trade_date:b.trade_date};
      for(const series of ratios.data ?? []){
        const s0=exact(series.rows,anchor.trade_date),s1=exact(series.rows,b.trade_date);
        const pct=s0&&s1 ? relativeRatioChange(s0.close,s1.close,b0.close,b.close) : null;
        point[`ratio_${series.id}`]=pct==null ? null : 100+pct;
      }
      return point;
    });
  },[anchor,ratioEnd,benchmark,ratios.data]);
  const focused = activeDate ?? anchor?.trade_date;
  const chartSlice = <T extends {trade_date:string}>(data:T[]|undefined):T[] => {
    if(!data)return [];
    const at=data.findIndex(r=>r.trade_date===focused);
    return at<0 ? data.slice(-66) : data.slice(Math.max(0,at-30),at+31);
  };
  const before=checkpoints[0].row;
  const b0=exact(breadth.data,before?.trade_date),ba=exact(breadth.data,anchor?.trade_date);
  const r0=exact(roc.data,before?.trade_date),ra=exact(roc.data,anchor?.trade_date);
  const v0=exact(vix.data,before?.trade_date),va=exact(vix.data,anchor?.trade_date);
  const allCheckpoints = [...checkpoints,...sequence.periodCheckpoints];
  const sequenceEnd = allCheckpoints.map(p=>p.row?.trade_date).filter((d):d is string=>!!d).sort().at(-1) ?? band.from;
  const within = events.filter(e=>e.date>=(before?.trade_date ?? band.from) && e.date<=sequenceEnd && e.date<=end);
  const technicalDates=[...new Set(within.map(e=>e.date))].sort();
  const after5=checkpoints[4].row;
  const b5=exact(breadth.data,after5?.trade_date),v5=exact(vix.data,after5?.trade_date);
  const breadthChange=ba?.breadth_score!=null&&b5?.breadth_score!=null ? b5.breadth_score-ba.breadth_score : null;
  const vixChange=percentChange(va?.close,v5?.close);
  const queries=[breadth,roc,vix];
  const waiting=queries.some(q=>q.isLoading);
  const failed=queries.some(q=>q.isError);
  const cross=anchor ? (roc.data ?? []).filter(r=>r.trade_date>=anchor.trade_date && r.trade_date<=(checkpoints[3].row?.trade_date ?? anchor.trade_date)).find(r=>{
    const previous=roc.data?.[roc.data.findIndex(p=>p.trade_date===r.trade_date)-1];
    return previous?.roc_13!=null&&previous.sma_breadth!=null&&r.roc_13!=null&&r.sma_breadth!=null&&previous.roc_13<=previous.sma_breadth&&r.roc_13>r.sma_breadth;
  }):undefined;
  return <section id="astro-market-story" aria-label="Astro market story" className="border border-kd-border rounded-xl bg-kd-card p-4 mb-4 min-w-0" style={{scrollMarginTop:120}}>
    <h2 className="text-lg font-semibold text-primary">What happened around {band.displayName}?</h2>
    <p className="text-sm text-secondary mt-1">{band.startTs ?? band.from}{!band.isPoint && ` → ${band.endTs ?? band.to}`} · {cutoff?'As of event: later observations excluded.':'Retrospective evidence.'} The date is a reference; this sequence does not establish that the planet caused the move.</p>
    {!anchor ? <p role="status" className="mt-3">Waiting for recorded market sessions around this date.</p> : <>
      {sequence.upcoming && <p className="mt-3 text-secondary">Event pending. The latest completed session is {anchor.trade_date}; event-day and following-session evidence are not available yet.</p>}
      {compact && <div className="my-3 text-sm text-secondary space-y-2">
        <p><strong className="text-primary">Before:</strong> Price {change(sequence.beforeReturn)} over the preceding five sessions; {anchor.sma_150==null?'SMA150 unavailable':anchor.close>=anchor.sma_150?'above SMA150':'below SMA150'}.</p>
        <p><strong className="text-primary">At the event:</strong> <button className="underline" onClick={()=>onInspect(anchor.trade_date)}>{anchor.trade_date}</button> · RSI {value(anchor.rsi_14)} · MagicRS {value(anchor.magic_rs)} / MA {value(anchor.magic_ma)}.</p>
        <p><strong className="text-primary">Following:</strong> +5 sessions {change(sequence.after5Return)}; +10 sessions {change(sequence.after10Return)}. {firstBreak?`${firstBreak.trade_date} closed ${direction==='up'?'above the event high':'below the event low'}.`:'No confirmed reference break yet.'} {failure?`Returned through that level on ${failure.trade_date}.`:''}</p>
        <p>Click a dated reading to inspect its candle. Full evidence includes technical events, breadth, ROC and sector ratios.</p>
      </div>}
      <p className="text-xs text-muted mb-2">Evidence uses daily market sessions. Click a dated reading to inspect its daily candle in the existing ChartView widgets. “Unavailable” is a data gap, not zero. +1/+2/+5/+10 count recorded trading sessions; astro dates include weekends. {!band.isPoint && 'Confirmation is measured from the period start; period-end and after-period readings are listed separately.'}</p>
      <details open={evidenceOpen} onToggle={e=>setEvidenceOpen(e.currentTarget.open)}><summary className="cursor-pointer text-sm text-primary mb-2">Full historical evidence</summary>
      <div className={`grid grid-cols-1 ${compact?'':'lg:grid-cols-3'} gap-3 my-3 text-sm`}>
        <article className="border border-kd-border rounded-lg p-3"><h3 className="font-semibold text-primary">Before · condition</h3><p className="mt-1 text-secondary">Price {sequence.beforeReturn==null?'change is unavailable':sequence.beforeReturn>0?'was rising':sequence.beforeReturn<0?'was falling':'was unchanged'}: {change(sequence.beforeReturn)} over the five preceding sessions{before && ` (${before.trade_date} → ${anchor.trade_date})`}. {anchor.sma_150==null?'SMA150 unavailable.':`At ${anchor.trade_date}, close ${value(anchor.close)} was ${anchor.close>=anchor.sma_150?'above':'below'} SMA150 ${value(anchor.sma_150)}.`}</p><p className="mt-2 text-secondary">All NSE breadth: {value(b0?.breadth_score)} → {value(ba?.breadth_score)}. ROC13: {value(r0?.roc_13,4)} → {value(ra?.roc_13,4)}; signal {value(ra?.sma_breadth,4)}. VIX: {value(v0?.close)} → {value(va?.close)}.</p></article>
        <article className="border border-kd-border rounded-lg p-3"><h3 className="font-semibold text-primary">Event · confirmation</h3><p className="mt-1 text-secondary">{anchor.trade_date===band.from?`Event-day EOD: ${anchor.trade_date}.`:`Calendar event ${band.from}; last recorded market session ${anchor.trade_date}.`} Reference high {value(anchor.high)} / low {value(anchor.low)}. {firstBreak?`${firstBreak.trade_date} closed ${direction==='up'?'above the reference high':'below the reference low'} at ${value(firstBreak.close)}.`:sequence.upcoming?'Confirmation pending.':checkpoints[3].row?'Neither following session closed outside this reference range.':'Two following sessions are not yet available.'}</p><p className="mt-2 text-secondary">RSI14 {value(anchor.rsi_14)}. MagicRS {value(anchor.magic_rs)} / MA {value(anchor.magic_ma)}{anchor.magic_rs!=null&&anchor.magic_ma!=null ? `: ${anchor.magic_rs>anchor.magic_ma?'above':'at or below'} its relative-strength trend${anchor.magic_rs<0?', while still below zero':''}.` : '.'} {cross?`ROC13 crossed above its signal on ${cross.trade_date}.`:ra?.roc_13==null||ra.sma_breadth==null?'ROC confirmation unavailable.':`Event-session ROC13 was ${ra.roc_13>ra.sma_breadth?'above':'at or below'} its signal.`} {cross?.roc_13!=null&&cross.roc_13<0?'The cross was still below zero.':''}</p></article>
        <article className="border border-kd-border rounded-lg p-3"><h3 className="font-semibold text-primary">Following · did it hold?</h3><p className="mt-1 text-secondary">From the reference close: +5 sessions {change(sequence.after5Return)}; +10 sessions {change(sequence.after10Return)}. {firstBreak?failure?`The initial ${direction==='up'?'upward':'downward'} break lost its reference level (${value(boundary)}) on ${failure.trade_date}.`:sequence.complete10?'The following closes stayed beyond the broken reference level through +10 sessions.':'The break has held in the available following sessions; the full ten-session window is pending.':'There is no confirmed range break to assess.'}</p><p className="mt-2 text-secondary">{breadthChange==null?'Following-session breadth confirmation is unavailable.':`At +5 sessions (${after5?.trade_date}), breadth ${breadthChange>0?'improved':breadthChange<0?'weakened':'was unchanged'} by ${value(Math.abs(breadthChange))} points.`} {vixChange==null?'Following-session VIX change is unavailable.':`VIX ${vixChange>0?'rose':vixChange<0?'fell':'was unchanged'} (${change(vixChange)}).`}</p></article>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-xs text-secondary"><thead><tr>{['Stage / session','Close / from reference','RSI14','MagicRS / MA','All NSE breadth / above 20 EMA','ROC13 / signal','India VIX'].map(h=><th key={h} className="text-left p-2 border-b border-kd-border whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{allCheckpoints.map(p=>{
        const b=exact(breadth.data,p.row?.trade_date),r=exact(roc.data,p.row?.trade_date),v=exact(vix.data,p.row?.trade_date);
        return <tr key={p.label}><td className="p-2"><button className="text-left underline" disabled={!p.row} onClick={()=>p.row&&onInspect(p.row.trade_date)}>{p.label}<br/>{p.row?.trade_date ?? 'Not yet available'}</button></td><td className="p-2 whitespace-nowrap">{value(p.row?.close)} / {change(percentChange(anchor.close,p.row?.close))}</td><td className="p-2">{value(p.row?.rsi_14)}</td><td className="p-2 whitespace-nowrap">{value(p.row?.magic_rs)} / {value(p.row?.magic_ma)}</td><td className="p-2 whitespace-nowrap">{value(b?.breadth_score)} / {b?.pct_above_20==null?'Unavailable':`${value(b.pct_above_20)}%`}{b?.stock_count!=null && <small className="block">{b.stock_count} stocks</small>}</td><td className="p-2 whitespace-nowrap">{value(r?.roc_13,4)} / {value(r?.sma_breadth,4)}</td><td className="p-2">{value(v?.close)}</td></tr>;
      })}</tbody></table></div>
      {waiting && <p role="status" className="mt-2 text-sm text-secondary">Loading historical breadth, ROC and VIX evidence…</p>}
      {failed && <p role="alert" className="mt-2 text-sm text-secondary">Some historical evidence could not load. <button className="underline" onClick={()=>queries.filter(q=>q.isError).forEach(q=>void q.refetch())}>Retry evidence</button></p>}
      <details className="mt-3"><summary className="cursor-pointer text-sm text-primary">Technical events in this sequence · {within.length} events on {technicalDates.length} sessions</summary>{technicalDates.map(date=><article key={date} className="border-b border-kd-border py-2 text-sm"><button className="underline font-semibold" onClick={()=>onInspect(date)}>{date} · inspect candle</button>{within.filter(e=>e.date===date).map((e,i)=><p key={`${e.kind}-${i}`} className="mt-1 text-secondary"><strong>{e.title}</strong> · {e.detail}</p>)}</article>)}{!within.length&&<p>No technical events recorded in this loaded sequence.</p>}</details>
      <details className="mt-3" open><summary className="cursor-pointer text-sm text-primary">Participation and momentum · All NSE, same historical dates</summary><p className="text-xs text-muted my-2">All NSE participation and momentum on the study dates. MagicRS uses NIFTY 500; sector ratios use NIFTY 50.</p><div className="grid grid-cols-1 xl:grid-cols-2 gap-3 min-w-0"><MarketBreadthChart data={chartSlice(breadth.data)} maBasis="market" indexName="All NSE · event context" researchMode focusedDate={focused} isLoading={breadth.isLoading} isError={breadth.isError} onInspectDate={d=>d&&onInspect(d)}/><BreadthRocChart scope="market" data={chartSlice(roc.data)} indexName="All NSE · event context" researchMode focusedDate={focused} isLoading={roc.isLoading} isError={roc.isError} onInspectDate={d=>d&&onInspect(d)}/></div></details>
      <details className="mt-3" open><summary className="cursor-pointer text-sm text-primary">Sector leadership · ratio to NIFTY 50</summary><div className="flex flex-wrap gap-3 items-center my-2 text-sm"><label>Compare through <select className="bg-kd-card border border-kd-border rounded p-1" value={ratioHorizon} onChange={e=>setRatioHorizon(Number(e.target.value))}><option value={5}>+5 sessions</option><option value={10}>+10 sessions</option><option value={22}>+22 sessions</option>{!band.isPoint && <option value={-1}>Period end</option>}</select></label><span>{anchor.trade_date} → {ratioEnd?.trade_date ?? 'Pending'}</span></div>
        {!ratioEnd ? <p className="text-sm text-secondary">The selected following-session endpoint is not available in this observation mode.</p> : sectorStart.isLoading||sectorEnd.isLoading||nifty.isLoading&&indexId!==1 ? <p role="status">Loading dated sector comparisons…</p> : <>
          {(sectorStart.isError||sectorEnd.isError||nifty.isError) && <p role="alert">Sector comparison could not load. <button onClick={()=>{void sectorStart.refetch();void sectorEnd.refetch();if(indexId!==1)void nifty.refetch()}}>Retry sectors</button></p>}
          <p className="text-xs text-muted mb-2">A rising sector/NIFTY ratio means outperformance, even if both fell. Ranking uses exact shared dates from the current active sector catalog; historical membership is not reconstructed. Select up to three ratio lines.</p>
          <div className="max-h-64 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Sector</th><th className="text-right">Price change</th><th className="text-right">Ratio change vs NIFTY</th></tr></thead><tbody>{rankings.map(s=><tr key={s.id}><td className="p-1"><label><input type="checkbox" checked={selectedIds.includes(s.id)} disabled={!selectedIds.includes(s.id)&&selectedIds.length>=3} onChange={e=>setChosen(e.target.checked?[...selectedIds,s.id]:selectedIds.filter(id=>id!==s.id))}/> {s.name}</label></td><td className="text-right p-1">{change(s.price)}</td><td className="text-right p-1">{change(s.ratio)} · {s.ratio>0?'outperformed':s.ratio<0?'underperformed':'in line'}</td></tr>)}</tbody></table></div>
          {!rankings.length && <p className="text-sm text-secondary">No matched sector and NIFTY observations at both endpoints.</p>}
          {ratios.isLoading && selectedIds.length>0 && <p role="status">Loading ratio lines…</p>}
          {ratios.isError && <p role="alert">Ratio history could not load. <button onClick={()=>void ratios.refetch()}>Retry ratios</button></p>}
          {ratioData.length>1 && selectedIds.length>0 && <><p className="text-xs text-secondary my-2">Sector/NIFTY ratio indexed to 100 at {anchor.trade_date}. Gaps remain gaps.</p><SignalLineChart data={ratioData} height={160} activeDate={focused} onSessionChange={onInspect} refLines={[{y:100}]} series={selectedIds.map((id,i)=>({key:`ratio_${id}`,label:rankings.find(r=>r.id===id)?.name ?? `Index ${id}`,color:['var(--accent)','var(--bull)','var(--accent-cyan)'][i]}))}/></>}
        </>}
      </details>
      </details>
    </>}
  </section>;
}
