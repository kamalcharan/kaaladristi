import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MarketBreadthChart from '@/components/domain/MarketBreadthChart';
import BreadthRocChart from '@/components/domain/BreadthRocChart';
import MarketStructureHistory from '@/components/domain/MarketStructureHistory';
import { DristiQLoader } from '@/components/ui';
import { useMarketStructureReading } from '@/hooks/useMarketStructureReading';
import { useMarketStructureStore } from '@/stores/marketStructureStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import PersonalStoryCards from '@/components/domain/PersonalStoryCards';
import { momentumLabel } from '@/lib/structureStates';
import { participationBand, rocMomentumReading } from '@/lib/heatmapReading';

import './workspaceToday.css';


const fmt = (value: number | null | undefined, digits = 1) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

function posture(score: number | null | undefined, scoreDelta: number, roc13: number | null | undefined, signal: number | null | undefined) {
  const momentumImproving = roc13 != null && signal != null && roc13 > signal;
  if (score != null && score >= 55) return momentumImproving
    ? { label: 'Broad advance', exposure: 'Supportive', note: 'Normal exposure · manage extension', tone: 'green' }
    : { label: 'Broad but fading', exposure: 'Constructive', note: 'Protect gains · avoid late entries', tone: 'amber' };
  if (score != null && score < 35) return momentumImproving
    ? { label: 'Early recovery', exposure: 'Selective', note: 'Small entries · wait for breadth', tone: 'amber' }
    : { label: 'Broad decline', exposure: 'Defensive', note: 'Protect capital · defer new exposure', tone: 'red' };
  if (momentumImproving && scoreDelta > 0) return { label: 'Selective recovery', exposure: 'Measured', note: 'Selective entries · reduced initial size', tone: 'amber' };
  if (scoreDelta < 0) return { label: 'Selective and weakening', exposure: 'Cautious', note: 'Prefer leaders · reduce new exposure', tone: 'red' };
  return { label: 'Selective market', exposure: 'Measured', note: 'Focus on confirmed leaders', tone: 'amber' };
}

export default function WorkspaceToday() {
  const navigate = useNavigate();
  const data = useMarketStructureReading();
  const { setPeriod, setDate } = useMarketStructureStore();
  const bookmarks = useBookmarkStore(s => s.bookmarks);
  const hasLoaded = useBookmarkStore(s => s.hasLoaded);
  const loadBookmarks = useBookmarkStore(s => s.load);

  useEffect(() => { if (!hasLoaded) void loadBookmarks(); }, [hasLoaded, loadBookmarks]);

  const latest = data.breadth.at(-1);
  const previous = data.breadth.at(-2);
  const threeBack = data.breadth.at(-4) ?? previous;
  const latestRoc = data.roc.at(-1);
  const score = latest?.breadth_score ?? null;
  const scoreDelta = score != null && threeBack?.breadth_score != null ? score - threeBack.breadth_score : 0;
  const state = posture(score, scoreDelta, latestRoc?.roc_13, latestRoc?.sma_breadth);
  const dailyBuyer = (latest?.up_5pct ?? 0) > (latest?.down_5pct ?? 0);
  const fiveDayBuyer = (latest?.up_20pct_5d ?? 0) > (latest?.down_20pct_5d ?? 0);
  const rocImproving = latestRoc?.roc_13 != null && latestRoc?.sma_breadth != null && latestRoc.roc_13 > latestRoc.sma_breadth;
  const breadthImproving = latest?.breadth_score != null && previous?.breadth_score != null && latest.breadth_score > previous.breadth_score;
  const agreement = [breadthImproving, rocImproving, dailyBuyer, fiveDayBuyer].filter(Boolean).length;
  const direction = scoreDelta > 1 ? 'Improving' : scoreDelta < -1 ? 'Deteriorating' : 'Stable';
  const rocReading = rocMomentumReading(latestRoc?.roc_13, latestRoc?.sma_breadth);

  if (data.isLoading && !latest) return <DristiQLoader message="Reading market structure…" />;

  return <div className="workspace-today">
    <header className="wt-heading">
      <div><p>YOUR DECISION WORKSPACE</p><h1>Today</h1><span>All NSE · data through {data.breadthDate ?? 'unavailable'}</span></div>
    </header>

    <section className={`wt-posture wt-${state.tone}`} data-tour="today-posture">
      <div className="wt-posture-copy">
        <div className="wt-kicker"><i /> Market posture <b>{direction === 'Improving' ? '↑' : direction === 'Deteriorating' ? '↓' : '→'} {direction}</b></div>
        <h2>{state.label}</h2>
        <p>Participation is {participationBand(latest?.pct_above_20, 20).toLowerCase()}; breadth momentum is {momentumLabel(latestRoc?.roc_13, latestRoc?.sma_breadth).toLowerCase()}.</p>
        <div className="wt-exposure"><span>Exposure posture</span><strong>{state.exposure}</strong><em>{state.note}</em></div>
        <button onClick={() => document.getElementById('workspace-market-structure')?.scrollIntoView({ behavior: 'smooth' })}>Inspect Market Structure ↓</button>
      </div>
      <div className="wt-gauge-panel">
        <div className="wt-gauge" aria-label={`Market breadth score ${fmt(score)} out of 100`}>
          <svg viewBox="0 0 260 150" role="img"><defs><linearGradient id="wtGauge" x1="0" x2="1"><stop offset="0" stopColor="var(--risk-red)"/><stop offset=".5" stopColor="var(--risk-amber)"/><stop offset="1" stopColor="var(--risk-green)"/></linearGradient></defs><path pathLength="100" d="M30 130A100 100 0 0 1 230 130"/><path className="wt-gauge-value" pathLength="100" d="M30 130A100 100 0 0 1 230 130" style={{ strokeDasharray: `${Math.max(0, Math.min(100, score ?? 0))} 100` }}/></svg>
          <div><strong>{fmt(score)}</strong><span>/100</span></div>
        </div>
        <div className="wt-gauge-scale"><span>Risk-off</span><span>Selective</span><span>Risk-on</span></div>
        <p><b>{scoreDelta >= 0 ? '+' : ''}{fmt(scoreDelta)}</b> over three sessions</p>
        <small>{agreement} of 4 improvement signals are active</small>
      </div>
    </section>

    <section className="wt-evidence" data-tour="today-evidence" aria-label="Evidence behind today's posture">
      <article><header>Participation <b className="bad">{participationBand(latest?.pct_above_20, 20)}</b></header><strong>{fmt(latest?.pct_above_20)}%</strong><span>above 20 EMA</span><div className="wt-horizons"><i style={{ width: `${latest?.pct_above_20 ?? 0}%` }}/><i style={{ width: `${latest?.pct_above_50 ?? 0}%` }}/><i style={{ width: `${latest?.pct_above_150 ?? 0}%` }}/></div><p>{fmt(latest?.pct_above_50)}% above 50 EMA · {fmt(latest?.pct_above_150)}% above 150 EMA</p></article>
      <article><header>Breadth momentum <b className="good">{rocReading.shortLabel}</b></header><strong>{fmt(latestRoc?.roc_13, 4)}</strong><span>ROC 13</span><div className="wt-roc-lines"><i/><b/></div><p>Signal {fmt(latestRoc?.sma_breadth, 4)} · ROC 55 {fmt(latestRoc?.roc_55, 4)}</p></article>
      <article><header>Daily pressure <b className={dailyBuyer ? 'good' : 'bad'}>{dailyBuyer ? 'Buyers' : 'Sellers'}</b></header><div className="wt-pair"><strong>{latest?.up_5pct ?? '—'}<span>Up &gt;5%</span></strong><strong>{latest?.down_5pct ?? '—'}<span>Down &gt;5%</span></strong></div><p>{dailyBuyer ? 'Buying pressure improved this session.' : 'Selling pressure dominated this session.'}</p></article>
      <article><header>Five-day extremes <b>{fiveDayBuyer ? 'Positive' : 'Defensive'}</b></header><div className="wt-pair"><strong>{latest?.up_20pct_5d ?? '—'}<span>Up &gt;20%</span></strong><strong>{latest?.down_20pct_5d ?? '—'}<span>Down &gt;20%</span></strong></div><p>Shows whether the move is broadening into an extreme cluster.</p></article>
    </section>

    <section className="wt-bookmarks" data-tour="today-bookmarks">
      <header><div><p>PERSONAL RELEVANCE</p><h2>Your stocks today</h2><span>Recorded events in the latest market session—not an overall stock verdict.</span></div><button onClick={() => navigate('/bookmarks')}>View all {bookmarks.length} stocks →</button></header>
      <PersonalStoryCards compact />
    </section>

    <section className="wt-boundaries">
      <header><p>DECISION BOUNDARIES</p><h2>What would change the posture?</h2></header>
      <article><h3>↑ Stronger recovery</h3><ul><li>Above-20-EMA participation continues to rebuild</li><li>ROC 13 remains above its signal</li><li>Buying pressure persists beyond one session</li></ul></article>
      <article className="risk"><h3>↓ Renewed deterioration</h3><ul><li>Buying pressure reverses sharply</li><li>Above-50-EMA participation breaks lower</li><li>ROC 13 falls back below its signal</li></ul></article>
    </section>

    <section id="workspace-market-structure" className="wt-structure" data-tour="today-market-structure">
      <header><div><p>SUPPORTING EVIDENCE</p><h2>Market Structure</h2><span>The full participation and momentum evidence behind today’s posture.</span></div><div>{([22, 44, 66] as const).map(period => <button key={period} className={data.period === period ? 'active' : ''} onClick={() => setPeriod(period)}>{period}D</button>)}</div></header>
      <div className="wt-structure-block"><h3>Participation</h3><MarketBreadthChart data={data.breadth} niftyData={data.niftyData} isLoading={data.isLoading} isError={data.isError} indexName="All NSE" maBasis="market" researchMode periodDays={data.period} onPeriodChange={setPeriod}/><MarketStructureHistory breadth={data.breadth} roc={data.roc} mode="breadth" onSelectDate={setDate} coverageContext={data.coverageContext} rocCoverageContext={data.rocCoverageContext}/></div>
      <div className="wt-structure-block"><h3>Momentum</h3><BreadthRocChart data={data.roc} isLoading={data.isLoading} isError={data.isError} researchMode periodDays={data.period} onPeriodChange={setPeriod}/><MarketStructureHistory breadth={data.breadth} roc={data.roc} mode="roc" onSelectDate={setDate} coverageContext={data.coverageContext} rocCoverageContext={data.rocCoverageContext}/></div>
    </section>
  </div>;
}
