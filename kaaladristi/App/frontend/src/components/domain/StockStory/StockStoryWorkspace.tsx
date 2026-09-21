import { useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StoryVisualSummary, StoryEventExplorer, StoryReferenceDistance } from './StoryVisuals';
import type { IndicatorRow } from '@/services/indicatorData';
import type { StoryEvent, StoryJourney } from '@/services/storyEvents';
import type { BigMoneyEvent } from '@/services/bigMoney';
import { positiveNumber, relation, validNumber, watchReferences } from './stockStoryFacts';
import './stockStory.css';

interface Props {
  name: string; equityId: number; search: string;
  latest: (IndicatorRow & { delivery_pct?: number | null; w52_high?: number | null; w52_low?: number | null }) | null;
  setupContent: ReactNode; dataContent: ReactNode; positionContent?: ReactNode;
  scanCount: number; scansLoading: boolean; pulseDate?: string;
  context: ReactNode; stats: ReactNode; leadership: ReactNode; participation: ReactNode;
  chart: ReactNode; lensPicker: ReactNode; actions: ReactNode; loading: boolean; error: boolean;
  mcapCr?: number | null; events: StoryEvent[]; fromDate?: string; barCount: number;
  bigMoney: BigMoneyEvent[]; journeys?: StoryJourney[] | null;
  selectedEvent: StoryEvent | null; onSelectEvent: (event: StoryEvent | null) => void;
}
const n = (v: number | null | undefined, digits = 2) => validNumber(v)
  ? v.toLocaleString('en-IN', { maximumFractionDigits: digits }) : 'Unavailable';
const rupee = (v: number | null | undefined) => positiveNumber(v) ? `₹${n(v)}` : 'Unavailable';
const delta = (v: number | null | undefined) => validNumber(v) ? `${v > 0 ? '+' : ''}${n(v)} pts` : 'Unavailable';
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="story-fact"><span>{label}</span><strong>{children}</strong></div>;
}

/** Uses the shared chart event stream and existing evidence widgets, not a second story engine. */
export default function StockStoryWorkspace(p: Props) {
  const [params, setParams] = useSearchParams();
  const tabs = ['analysis', 'chart', 'data'] as const;
  const tab = params.get('tab') === 'thesis' ? 'position' : params.get('tab') === 'data' ? 'data' : params.get('tab') === 'chart' ? 'chart' : 'analysis';
  const selectTab = (next: typeof tabs[number]) => setParams(previous => {
    const updated = new URLSearchParams(previous);
    updated.set('tab', next);
    return updated;
  });
  useEffect(() => {
    if (tab !== 'chart' || !p.selectedEvent) return;
    const frame = requestAnimationFrame(() => document.getElementById('story-price')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start',
    }));
    return () => cancelAnimationFrame(frame);
  }, [tab, p.selectedEvent]);
  const row = p.latest;
  const watch = watchReferences(row);
  const footprint = [...p.bigMoney].sort((a, b) => b.trade_date.localeCompare(a.trade_date))[0];
  const alignedDates = !p.pulseDate || !row || p.pulseDate === row.trade_date;
  const setupRead = <section id="story-conditions" className="story-section story-setup-shell" aria-label="Setup Read">
    {p.lensPicker}
    <div className="story-original">{p.setupContent}</div>
  </section>;
  return <div className="stock-story">
    <div className="story-preview-bar"><span>Stock story</span></div>
    <header className="story-identity">
      <div><p className="story-kicker">The story so far</p><h1>{p.name}</h1>
        <p className="story-muted">{row ? `Daily observations · ${row.trade_date}` : p.loading ? 'Loading market evidence…' : 'Price data unavailable'}</p></div>
      <div className="story-header-values"><strong className="story-price">{rupee(row?.close)}</strong>
        {positiveNumber(p.mcapCr) && <Fact label="Current market cap">₹{n(p.mcapCr)} Cr</Fact>}
        <div className="story-actions">{p.actions}</div></div>
    </header>
    <div className="story-facts">
      <Fact label="Session low / high">{rupee(row?.low)} / {rupee(row?.high)}</Fact>
      <Fact label="52-week low / high">{rupee(row?.w52_low)} / {rupee(row?.w52_high)}</Fact>
      <Fact label="Price return · 5 / 22 sessions">{validNumber(row?.ret_5d) ? `${n(row.ret_5d, 1)}%` : '—'} / {validNumber(row?.ret_22d) ? `${n(row.ret_22d, 1)}%` : '—'}</Fact>
      <Fact label="Current scanner matches">{p.scansLoading ? 'Checking…' : p.scanCount}</Fact>
    </div>
    <div className="story-context">{p.context}</div>
    <div className="story-tabs" role="tablist" aria-label="Stock view">
      {tabs.map(value => <button key={value} id={`story-tab-${value}`} role="tab"
        aria-selected={tab === value} aria-controls={`story-panel-${value}`} tabIndex={tab === value ? 0 : -1}
        onClick={() => selectTab(value)} onKeyDown={e => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
          e.preventDefault();
          const next = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : tabs[(tabs.indexOf(value) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
          selectTab(next); document.getElementById(`story-tab-${next}`)?.focus();
        }}>{value === 'analysis' ? 'Analysis' : value === 'chart' ? 'Chart & Replay' : 'Data'}</button>)}
    </div>
    {p.error && <div className="story-warning" role="alert">Price data could not be loaded. Available widgets remain visible; missing data is not a negative signal.</div>}
    {!alignedDates && <div className="story-warning">Chart data: {row?.trade_date}. Rotation / participation: {p.pulseDate}. These are different observation dates.</div>}
    {tab === 'analysis' && <div id="story-panel-analysis" role="tabpanel" aria-labelledby="story-tab-analysis">
    <nav className="story-jumps" aria-label="Analysis sections"><a href="#story-events">Events</a><a href="#story-watch">Events to watch</a><a href="#story-conditions">Setup Read</a></nav>
    <StoryVisualSummary row={row}/>
    <div className="story-event-grid">
      <section id="story-events" className="story-panel story-section">
        <p className="story-kicker">01 · What changed</p><h2>Turning points, in time</h2>
        <p className="story-muted">{p.fromDate ?? '—'} → {row?.trade_date ?? '—'} · {p.barCount} daily bars · {p.events.length} events. Select a date to connect observations.</p>
        <StoryEventExplorer key={p.equityId} events={p.events} loading={p.loading} onLocate={event => { p.onSelectEvent(event); selectTab('chart'); }}/>
      </section>
      <aside id="story-watch" className="story-panel story-section">
        <p className="story-kicker">02 · What to observe</p><h2>Events to watch</h2>
        <p className="story-muted">Current references · {row?.trade_date ?? 'unavailable'}. Observe either direction, not a predicted next move.</p>
        <p className="story-muted">Distance bars share a −15% to +15% scale; longer distances are capped visually, exact values remain visible.</p>
        {watch.map(ref => <div className="story-reference" key={ref.id}>
          <div><strong>{ref.label}</strong><span>{rupee(ref.value)}</span></div>
          <StoryReferenceDistance close={row?.close} value={ref.value}/>
          <p><span className="story-state">{ref.state}</span>{ref.value == null ? 'Reference not available.' : 'Latest daily close'}</p>
        </div>)}
        <p className="story-muted">Observe daily closes crossing either side. Weekly and monthly references reset each period.</p>
        <div className="story-reference"><strong>MagicRS momentum · 5 / 22 / 66 sessions</strong><p>{delta(row?.magic_rs_chg_5d)} / {delta(row?.magic_rs_chg_22d)} / {delta(row?.magic_rs_chg_66d)}</p><p className="story-muted">Observe each stored change crossing zero; missing history stays unknown.</p></div>
        <div className="story-reference"><strong>SBD / SVD at the Golden Line</strong><p>SBD: {row?.dot_sbd === true ? 'Recorded' : row?.dot_sbd === false ? 'Not recorded' : 'Unavailable'} · SVD: {row?.dot_svd === true ? 'Recorded' : row?.dot_svd === false ? 'Not recorded' : 'Unavailable'}</p><p className="story-muted">Compare the signal date with the GL event date. Nearby events are context, not proof of causation.</p></div>
        <p className="story-muted">Observation list only. No alerts or notifications are enabled here.</p>
      </aside>
    </div>
    {setupRead}
    <section className="story-panel story-structure">
      <p className="story-kicker">Where price sits</p>
      <div className="story-summary-grid"><Fact label="Golden Line · daily 150 SMA">{rupee(row?.sma_150)} · {relation(row?.close, row?.sma_150)}</Fact>
        <Fact label="Latest Big Money footprint in chart window">{footprint ? `${footprint.trade_date} · ${rupee(footprint.low)}–${rupee(footprint.high)}` : 'None recorded in loaded window'}</Fact>
        {footprint && <Fact label="Close relative to footprint range">{!validNumber(row?.close) ? 'Unavailable' : row.close < footprint.low ? 'Below range' : row.close > footprint.high ? 'Above range' : 'Inside range'}</Fact>}
      </div>
    </section>
    {!!p.journeys?.length && <section className="story-panel story-journeys"><p className="story-kicker">Recorded journeys · not a future roadmap</p>
      {p.journeys.map((j, i) => <div key={`${j.base_start}-${i}`}><p>{j.is_current ? 'Current record' : 'Archived record'} · {j.state ?? 'State unavailable'}</p>
        <ol>{([
          ['Base recorded', j.base_start], ['Stirring recorded', j.stir_first_date], ['Turn recorded', j.turn_date],
          ['Wake recorded', j.wake_date], ['Confirmation recorded', j.confirm_date], ['Sleep recorded', j.sleep_date],
        ] as Array<[string, string | null | undefined]>).filter((entry): entry is [string, string] => !!entry[1]).sort((a, b) => a[1].localeCompare(b[1])).map(([label, date]) => <li key={`${label}-${date}`}><time>{date}</time><strong>{label}</strong></li>)}</ol>
      </div>)}
    </section>}
    </div>}
    {tab === 'chart' && <div id="story-panel-chart" role="tabpanel" aria-labelledby="story-tab-chart">
    <nav className="story-jumps" aria-label="Chart study sections"><a href="#story-price">Price & MagicRS</a><a href="#story-leadership">RS & rotation</a><a href="#story-participation">Participation</a></nav>
    <section id="story-price" className="story-section"><p className="story-kicker">Chart & Replay · Locate the evidence</p><h2>Price & MagicRS</h2>
      {p.selectedEvent && <div className="story-selection"><span>Chart focus · {p.selectedEvent.date} · {p.selectedEvent.title}</span><button onClick={() => p.onSelectEvent(null)}>Clear focus</button></div>}
      <p className="story-muted">Chart focus does not backdate the current overview or setup references. Changing the range also changes the event window.</p>{p.chart}
    </section>
    <section id="story-leadership" className="story-section"><p className="story-kicker">Relative strength evidence</p><h2>RS rotation & momentum</h2>{p.leadership}{p.stats}</section>
    <section id="story-participation" className="story-section"><p className="story-kicker">Participation evidence</p><h2>Flow, volume & delivery</h2>{p.participation}</section>
    </div>}
    {tab === 'data' && <div id="story-panel-data" className="story-section story-original" role="tabpanel" aria-labelledby="story-tab-data">{p.dataContent}</div>}
    {tab === 'position' && <section className="story-section story-original" aria-label="My position"><button className="story-more" onClick={() => selectTab('analysis')}>← Back to Analysis</button>{p.positionContent}</section>}
  </div>;
}
