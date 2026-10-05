import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { useFrameworkStore } from '@/stores/frameworkStore';
import { useAuthStore } from '@/stores/authStore';
import { useAstroOverlayBands } from '@/hooks/useAstroOverlayBands';
import CockpitOverlayStrip from '@/components/domain/StockCockpit/CockpitOverlayStrip';
import CatalogDrawer from '@/components/domain/Catalog/CatalogDrawer';
import CockpitIndicatorPanels from '@/components/domain/StockCockpit/CockpitIndicatorPanels';
import MagicRsSubchart from '@/components/domain/VisualPulse/MagicRsSubchart';
import SignalFlipCard from '@/components/domain/StockCockpit/SignalFlipCard';
import SignalLineChart from '@/components/domain/StockCockpit/SignalLineChart';
import type { ChartOverlay } from '@/types/framework';
import TradingChart from '@/components/charts/TradingChart';
import { astroToday, astroDate, boundary, fetchAstroEvents, type AstroOccurrence } from '@/services/astroEvents';
import { astroStudyLink, shiftStudyDate, studySession, studyEventBand, validStudyDate } from '@/services/astroStudy';
import { fetchIndexStudyWindow } from '@/services/indicatorData';
import { fetchActiveIndices } from '@/services/indexPickerService';
import { useAstroHorizon } from '@/hooks/useAstroHorizon';
import { trackEvent } from '@/lib/analytics';
import '@/components/astro/astroStudy.css';

const EMPTY_OVERLAYS: ChartOverlay[] = [];
const fmt = (n: number | null | undefined) => n == null ? 'Unavailable' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export default function AstroStudyPage() {
  const framework = useFrameworkStore(s => s.framework);
  const loadFramework = useFrameworkStore(s => s.loadFramework);
  const userId = useAuthStore(s => s.profile?.id);
  const overlays = framework?.chart_overlays ?? EMPTY_OVERLAYS;
  const [drawerOpen, setDrawerOpen] = useState(false), [showFocus, setShowFocus] = useState(true);
  const [visibleRange, setVisibleRange] = useState<{from:string;to:string}|null>(null);
  useEffect(() => { if (!framework && userId) loadFramework(userId); }, [framework,userId,loadFramework]);
  const [url, setUrl] = useSearchParams();
  const setUrlRef = useRef(setUrl);
  setUrlRef.current = setUrl;
  const today = astroToday(), horizon = useAstroHorizon();
  const dateParam = url.get('date');
  const year = validStudyDate(dateParam) ? Number(dateParam.slice(0,4)) : Number(today.slice(0,4));
  const [yearsBack, setYearsBack] = useState(3), [olderDays, setOlderDays] = useState(0), [full, setFull] = useState(false);
  const fromYear = Math.max(1990, year - yearsBack);
  const throughYear = Math.max(year, Number(today.slice(0,4)));
  const events = useQuery({ placeholderData: keepPreviousData, queryKey: ['astro', 'study-events', fromYear, throughYear, horizon.cutoffIso], queryFn: async () => {
    const result = await Promise.all(Array.from({length: throughYear-fromYear+1}, (_,i) => fromYear+i).filter(y => `${y}-01-01` <= horizon.cutoffIso).map(y => fetchAstroEvents(`${y}-01-01`, [`${y}-12-31`,horizon.cutoffIso].sort()[0])));
    return result.flat().sort((a,b) => b.start_date.localeCompare(a.start_date) || a.event_key.localeCompare(b.event_key));
  }});
  const catalog = useQuery({ queryKey: ['active-indices'], queryFn: fetchActiveIndices });
  const all = events.data ?? [];
  const types = [...new Map(all.map(e => [e.event_type,e.display_name])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const requestedKey = url.get('event');
  const requested = all.find(e => e.event_key === requestedKey);
  const kind = url.get('type') ?? requested?.event_type ?? all.find(e => e.start_date <= today)?.event_type ?? all[0]?.event_type;
  const sign = url.get('sign') ?? '';
  const matches = all.filter(e => e.event_type === kind && (!sign || e.details.sign === sign));
  const event = requestedKey ? requested : matches.find(e => e.start_date <= today) ?? matches[0];
  const occurrenceIndex = matches.findIndex(e => e.event_key === event?.event_key);
  const selectedIndex = catalog.data?.find(i => i.id === Number(url.get('index'))) ?? catalog.data?.find(i => i.display_name === 'NIFTY 50');
  const anchor = event ? [event.start_date,today].sort()[0] : today;
  const replay = url.get('mode') !== 'after';
  const start = shiftStudyDate(anchor, -90-olderDays);
  const end = replay ? anchor : [shiftStudyDate(anchor,100),today].sort()[0];
  const prices = useQuery({ queryKey: ['astro-study-prices',event?.event_key,selectedIndex?.id,start,end], placeholderData: (previous, query) => query?.queryKey[1] === event?.event_key && query?.queryKey[2] === selectedIndex?.id ? previous : undefined, queryFn: () => fetchIndexStudyWindow(selectedIndex!.id,start,end), enabled: !!selectedIndex && !!event });
  const historyLoading = useRef(false);
  useEffect(() => { historyLoading.current = prices.isFetching; }, [prices.isFetching]);
  const loadHistory = useCallback(() => { if (historyLoading.current) return; historyLoading.current = true; setOlderDays(v => Math.min(14600,v+365)); }, []);
  const rows = useMemo(() => (prices.data ?? []).filter(r => r.trade_date >= start && r.trade_date <= end), [prices.data,start,end]);
  const sessionParam = url.get('session');
  const reading = studySession(rows, validStudyDate(sessionParam) ? (sessionParam > end ? end : sessionParam) : anchor);
  const selectedDate = reading?.trade_date;
  const cursor = rows.findIndex(r => r.trade_date === selectedDate);
  const overlayBands = useAstroOverlayBands(overlays,start,end);
  const bands = useMemo(() => {
    const inWindow = overlayBands.filter(b => b.from <= end && b.to >= start);
    if (showFocus && event && !inWindow.some(b => b.eventKey === event.event_key)) inWindow.push(studyEventBand(event));
    return inWindow;
  }, [overlayBands,start,end,showFocus,event]);
  const widgetRows = useMemo(() => visibleRange ? rows.filter(r => r.trade_date >= visibleRange.from && r.trade_date <= visibleRange.to) : rows, [rows,visibleRange]);
  const magicRows = useMemo(() => rows.map(r => ({trade_date:r.trade_date,magic_rs:r.magic_rs ?? null,magic_ma:r.magic_ma ?? null,magic_rs_zone:r.magic_rs_zone ?? null,chg5:r.magic_rs_chg_5d ?? null,chg22:r.magic_rs_chg_22d ?? null,chg66:r.magic_rs_chg_66d ?? null,align:r.magic_rs_align ?? null})), [rows]);
  const magicVisible = useMemo(() => visibleRange ? magicRows.filter(r => r.trade_date >= visibleRange.from && r.trade_date <= visibleRange.to) : magicRows,[magicRows,visibleRange]);
  const magicActiveIndex = magicVisible.findIndex(r => r.trade_date === selectedDate);
  const handleVisibleRange = useCallback((from:string,to:string) => setVisibleRange(prev => prev?.from===from && prev.to===to ? prev : {from,to}),[]);
  const update = useCallback((values: Record<string,string|null>) => setUrlRef.current(prev => { const next = new URLSearchParams(prev); Object.entries(values).forEach(([key,value])=>value === null ? next.delete(key) : next.set(key,value)); return next; }, {replace:true}), []);
  useEffect(() => {
    if (!requestedKey && event && selectedIndex) update({event:event.event_key,type:event.event_type,date:event.start_date,index:String(selectedIndex.id)});
  }, [requestedKey,event,selectedIndex,update]);
  const inspect = useCallback((_index: number, date: string) => update({session:date}),[update]);
  const choose = (e: AstroOccurrence) => { setOlderDays(0); const next = new URLSearchParams(astroStudyLink(e,selectedIndex?.id ?? 1).split('?')[1]); if(sign)next.set('sign',sign); next.set('mode',replay?'before':'after'); setUrl(next); trackEvent('astro_study_occurrence_selected',{event_type:e.event_type,index_id:selectedIndex?.id}); };
  useEffect(() => { trackEvent('astro_study_opened'); }, []);
  useEffect(() => { setOlderDays(0); setVisibleRange(null); }, [event?.event_key,selectedIndex?.id]);
  useEffect(() => { if (!full) return; const before = document.body.style.overflow; document.body.style.overflow = 'hidden'; const escape = (e: KeyboardEvent) => { if(e.key==='Escape')setFull(false); }; document.addEventListener('keydown',escape); return()=>{document.body.style.overflow=before;document.removeEventListener('keydown',escape);}; },[full]);
  const chart = <section className="as-card"><div className="as-controls"><strong>{selectedIndex?.display_name ?? 'Choose an index'} · daily</strong><span className="as-grow"/><button onClick={()=>setFull(v=>!v)}>{full?'Exit fullscreen':'Fullscreen'}</button></div>
    <div className="as-controls"><button aria-pressed={replay} onClick={()=>update({mode:'before',session:null})}>As of event</button><button aria-pressed={!replay} onClick={()=>update({mode:'after',session:null})}>Explore what followed</button><span className="as-grow"/><button disabled={cursor<=0} onClick={()=>update({session:rows[cursor-1].trade_date})}>← Session</button><button disabled={cursor<0 || cursor>=rows.length-1} onClick={()=>update({session:rows[cursor+1].trade_date})}>Session →</button></div>
    <div className="as-readings" aria-live="polite"><div><small>Selected session</small><strong>{selectedDate ? astroDate(selectedDate) : 'Unavailable'}</strong></div><div><small>Close</small><strong>{fmt(reading?.close)}</strong></div><div><small>MagicRS · CNX500 benchmark</small><strong>{fmt(reading?.magic_rs)}</strong></div><div><small>MagicMA</small><strong>{fmt(reading?.magic_ma)}</strong></div><div><small>RSI 14</small><strong>{fmt(reading?.rsi_14)}</strong></div></div>
    <p className="as-note">{event && event.start_date > today ? 'Upcoming event: only available market sessions up to today are shown.' : replay ? 'Later sessions are hidden. Event-day readings are end-of-day observations, not necessarily known at the event time.' : 'Retrospective view: later observations are visible.'} {event && selectedDate && selectedDate !== event.start_date && `The astronomical event remains on ${astroDate(event.start_date)}; you are inspecting ${astroDate(selectedDate)}.`}</p>
    {prices.isFetching && <p role="status" className="as-note">Loading historical prices and stored indicators…</p>}
    {prices.isError && <p role="alert" className="as-note">Historical prices could not be loaded. <button onClick={()=>prices.refetch()}>Retry</button></p>}
    {!prices.isFetching && !prices.isError && !rows.length && <p className="as-note">No price history in this window. Load earlier history or choose another occurrence.</p>}
    <div className="as-overlay-controls"><CockpitOverlayStrip onAdd={()=>setDrawerOpen(true)} /><button aria-pressed={showFocus} onClick={()=>setShowFocus(v=>!v)}>Study focus marker: {showFocus?'shown':'hidden'}</button><small>{bands.length} event records in this window. A line marks a point event; a shaded interval marks a period. Use + Overlay to combine planets and indicators.</small></div>
    {!!rows.length && <TradingChart key={`${event?.event_key}-${selectedIndex?.id}`} data={rows} workspaceMode studyMode selectedSession={selectedDate} height={480} overlays={overlays} astroBands={bands} onCrosshairMove={inspect} onHistoryEdge={loadHistory} onVisibleRangeChange={handleVisibleRange} />}
    {!!rows.length && <div className="as-widget-grid"><div><SignalFlipCard title="Magic RS" widget={magicActiveIndex>=0 ? <MagicRsSubchart data={magicVisible} activeIndex={magicActiveIndex} benchmarkLabel="NIFTY 500" variant="long" lookbackData={magicRows} cadence="D"/> : <p className="as-note">Selected session is outside the visible chart window. Pan to that date to read the widget.</p>} chart={<SignalLineChart data={magicVisible} series={[{key:'magic_rs',color:'var(--accent)',label:'Magic RS'},{key:'magic_ma',color:'var(--text-secondary)',label:'MA',dashed:true}]} refLines={[{y:0}]} activeDate={selectedDate} onSessionChange={date=>inspect(0,date)} />} /></div><div><CockpitIndicatorPanels rows={widgetRows} activeDate={selectedDate} onSessionChange={date=>inspect(0,date)} />{!widgetRows.some(r=>r.rsi_14 != null) && <p className="as-note">RSI is unavailable in this window.</p>}</div></div>}
    <CatalogDrawer isOpen={drawerOpen} onClose={()=>setDrawerOpen(false)} context="overlay" layer={full?500:200} />
    <div className="as-controls"><button disabled={prices.isFetching || olderDays>=14600} onClick={loadHistory}>← Load an earlier year</button><small>{rows.length ? `${astroDate(rows[0].trade_date)} – ${astroDate(rows.at(-1)!.trade_date)} · ${rows.length} recorded sessions` : 'Coverage is shown when records are available.'}</small></div>
    <p className="as-note">Hover or tap any pane to inspect a session. Pan past the left edge to load older history. The existing RSI panel and MagicRS widget follow the visible price window and selected session. Missing stored indicators remain unavailable.</p>
  </section>;
  return <div className="astro-study"><nav className="as-controls"><Link to="/astro">Calendar</Link><strong>Event Study</strong><span className="as-grow"/><Link to="/workspace">Back to Workspace</Link></nav><header><small>Astro · historical technical study</small><h1>{event?.display_name ?? 'Choose an event to study'}</h1>{event && <p>{boundary(event,'start')}{event.shape==='period' ? ` → ${boundary(event,'end')}` : ''}{event.details.sign ? ` · ${String(event.details.sign)}` : ''} · {event.precision}</p>}<p>Study what price and technical strength were doing around a published planetary event.</p></header>
    {(events.isPending || catalog.isPending) && <p role="status">Loading published events and indices…</p>}
    {events.isError && <p role="alert">Could not load events. <button onClick={()=>events.refetch()}>Retry</button></p>}
    {!catalog.isPending && !selectedIndex && <p role="alert">Index list unavailable or no NIFTY 50 record. <button onClick={()=>catalog.refetch()}>Retry index list</button></p>}
    {requestedKey && !events.isPending && !events.isError && !requested && <p role="alert">This occurrence is unavailable in the published calendar or your calendar horizon. Select a published occurrence below.</p>}
    <div className="as-layout"><aside className="as-card as-sidebar"><label>Event<select value={kind ?? ''} onChange={e=>{update({type:e.target.value,event:null,sign:null,session:null});setOlderDays(0);}}>{types.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Sign at event<select value={sign} onChange={e=>update({sign:e.target.value,event:null,session:null})}><option value="">All recorded signs</option>{[...new Set(all.filter(e=>e.event_type===kind).map(e=>e.details.sign).filter((s):s is string=>typeof s==='string'))].map(s=><option key={s}>{s}</option>)}</select></label><label>Index / curated basket<select value={selectedIndex?.id ?? ''} onChange={e=>update({index:e.target.value,session:null})}><option value="" disabled>Choose an index</option>{catalog.data?.map(i=><option key={i.id} value={i.id}>{i.display_name}</option>)}</select></label>
    <div className="as-controls"><button disabled={occurrenceIndex<0 || occurrenceIndex>=matches.length-1} onClick={()=>choose(matches[occurrenceIndex+1])}>← Previous</button><button disabled={occurrenceIndex<=0} onClick={()=>choose(matches[occurrenceIndex-1])}>Next →</button></div><div className="as-occurrences">{matches.map(e=><button key={e.event_key} aria-pressed={event?.event_key===e.event_key} onClick={()=>choose(e)}><strong>{astroDate(e.start_date)}</strong><small>{String(e.details.sign ?? 'Sign not recorded')} · {e.shape}</small></button>)}</div>{!events.isFetching && !matches.length && <p>No matching occurrences in this range.</p>}<button disabled={events.isFetching || fromYear<=1990} onClick={()=>setYearsBack(v=>v+3)}>Load earlier occurrences</button><small>Calendar coverage requested: {fromYear}–{throughYear}. Weekends are retained.</small></aside>
    <main>{event && (full ? createPortal(<div className="as-full">{chart}</div>,document.body) : chart)}<section className="as-card as-next"><h2>Read the sequence</h2><p>Start with the price structure before the event. Compare MagicRS with its moving average and inspect RSI. Reveal later sessions to see whether the change persisted.</p><small>A planetary date is a study reference. Price movement after it does not establish causation. Indicator values are the currently recorded historical series; later data corrections may change them.</small></section></main></div></div>;
}
