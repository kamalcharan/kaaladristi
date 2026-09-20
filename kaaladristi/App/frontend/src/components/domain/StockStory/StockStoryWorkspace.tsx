import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { SetupData } from '@/services/thesis/setupAdapter';
import type { IndicatorRow } from '@/services/indicatorData';
import './stockStory.css';

interface Props {
  name: string;
  equityId: number;
  search: string;
  latest: (IndicatorRow & { delivery_pct?: number | null; w52_high?: number | null; w52_low?: number | null }) | null;
  setup: SetupData | null;
  setupLoading: boolean;
  setupError: boolean;
  inferredLens: boolean;
  scanCount: number;
  scansLoading: boolean;
  pulseDate?: string;
  context: ReactNode;
  stats: ReactNode;
  leadership: ReactNode;
  participation: ReactNode;
  chart: ReactNode;
  setupDetail: ReactNode;
  lensPicker: ReactNode;
  actions: ReactNode;
  loading: boolean;
  error: boolean;
}

function number(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? 'Unavailable' : value.toFixed(digits);
}

/** Presentation only: observations come from the same rows and setup adapter as ChartView. */
export default function StockStoryWorkspace(p: Props) {
  const row = p.latest;
  const rs = row?.magic_rs;
  const momentum = row?.magic_rs_chg_5d;
  const leadership = rs == null ? 'Relative strength is unavailable for this reading.'
    : `Relative strength is ${rs >= 0 ? 'above' : 'below'} NIFTY 500 on the MagicRS measure.`;
  const change = momentum == null ? 'Its stored five-session change is unavailable.'
    : `The five-session change is ${number(momentum)} points: ${momentum > 0 ? 'improving' : momentum < 0 ? 'weakening' : 'unchanged'}.`;
  const participation = row?.rvol == null ? 'Relative-volume evidence is unavailable.'
    : row.rvol < 0.5 ? `Volume is thin (${number(row.rvol, 2)}× its reference). Treat participation signals cautiously.`
    : `Relative volume is ${number(row.rvol, 2)}× its reference. Read its direction alongside the flow and signature widgets below.`;
  const delivery = row?.delivery_pct == null ? 'Delivery data is unavailable; this is an evidence gap, not a failed condition.'
    : `Delivery is ${number(row.delivery_pct)}%; compare it with traded activity below.`;
  const alignedDates = !p.pulseDate || !row || p.pulseDate === row.trade_date;
  const oldUrl = `/chart/equity/${p.equityId}${p.search ? `?${p.search}` : ''}`;
  const dataSearch = new URLSearchParams(p.search);
  dataSearch.set('tab', 'data');
  const dataUrl = `/chart/equity/${p.equityId}?${dataSearch}`;
  return (
    <div className="stock-story">
      <div className="story-preview-bar"><span>Stock story · Phase 1 preview</span><Link to={oldUrl}>Compare existing page →</Link></div>
      <header className="story-identity">
        <div><p className="story-kicker">The story so far</p><h1>{p.name}</h1><p className="story-muted">{row ? `Price data · ${row.trade_date} · daily` : p.loading ? 'Loading market evidence…' : 'Price data unavailable'}</p></div>
        <div><strong className="story-price">{row?.close != null ? `₹${number(row.close, 2)}` : '—'}</strong><div className="story-actions">{p.actions}</div></div>
      </header>
      <div className="story-facts" aria-label="Immediate stock context">
        <div><span>Flow · 5 sessions</span><strong>{number(row?.score_5d)}</strong></div>
        <div><span>Flow · 22 sessions</span><strong>{number(row?.score_22d)}</strong></div>
        <div><span>Price return · 5 sessions</span><strong>{row?.ret_5d == null ? 'Unavailable' : `${number(row.ret_5d)}%`}</strong></div>
        <div><span>Price return · 22 sessions</span><strong>{row?.ret_22d == null ? 'Unavailable' : `${number(row.ret_22d)}%`}</strong></div>
        <div><span>Current scanner matches</span><strong>{p.scansLoading ? 'Checking…' : p.scanCount}</strong></div>
      </div>
      <div className="story-context">{p.context}</div>
      <nav className="story-jumps" aria-label="Explore the stock story">
        <a href="#story-leadership">Leadership</a><a href="#story-participation">Participation</a><a href="#story-price">Price & MagicRS</a><a href="#story-conditions">Setup conditions</a><Link to={dataUrl}>Underlying data</Link>
      </nav>
      {p.error && <div className="story-warning" role="alert">Price data could not be loaded. Retry in the price section below; no complete stock interpretation is available.</div>}
      {!alignedDates && <div className="story-warning">Price evidence is dated {row?.trade_date}; participation and rotation widgets are dated {p.pulseDate}. These sources are not a same-session confirmation.</div>}
      <section className="story-intro" aria-label="Current setup interpretation">
        {p.lensPicker}
        <p className="story-kicker">{p.setup?.setupLabel ?? 'Setup context'}{p.inferredLens ? ' · suggested lens' : ''}</p>
        <h2>{p.setup?.currentSituation.verdict ?? (p.setupLoading ? 'Reading the setup…' : 'Setup interpretation unavailable')}</h2>
        <p>{p.setup?.currentSituation.narrative ?? (p.setupError ? 'The setup data could not be loaded. The available widgets remain visible below.' : 'Use the evidence below while the setup context is resolved.')}</p>
        {p.inferredLens && <p className="story-muted">This lens comes from current scanner presence or structural stage. It is not a saved personal thesis.</p>}
      </section>
      <section id="story-leadership" className="story-section">
        <div className="story-section-heading"><p className="story-kicker">01 · Leadership</p><h2>Is the stock leading—and is that changing?</h2><p>{leadership} {change}</p><p className="story-muted">The quadrant shows level and recent direction. MagicRS history and stored 5/22/66-bar momentum remain visible with the price chart below. Industry context is separate from long-term sector confirmation.</p></div>
        {p.leadership}
        {p.stats}
      </section>
      <section id="story-participation" className="story-section">
        <div className="story-section-heading"><p className="story-kicker">02 · Participation</p><h2>What participation accompanies the move?</h2><p>{participation} {delivery}</p><p className="story-muted">These widgets describe related aspects of participation; they are not independent votes for a direction.</p></div>
        {p.participation}
      </section>
      <section id="story-price" className="story-section">
        <div className="story-section-heading"><p className="story-kicker">03 · Price and relative strength</p><h2>Where did these observations occur?</h2><p>Read the existing event markers and reference levels alongside price and MagicRS. Changing the chart range does not change the date of the current setup reading.</p></div>
        {p.chart}
      </section>
      <section id="story-conditions" className="story-section">
        <div className="story-section-heading"><p className="story-kicker">04 · Conditions and opposing evidence</p><h2>What supports this setup—and what remains unresolved?</h2><p>Read each condition individually. A missing observation is different from an observed failure. The selected playbook supplies these references; they are not guaranteed outcomes.</p></div>
        {p.setupDetail}
      </section>
    </div>
  );
}
