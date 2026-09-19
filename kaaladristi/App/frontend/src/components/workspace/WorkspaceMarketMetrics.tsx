import TickerRail from '@/components/domain/DashboardV3/TickerRail';
import { dashboardDate } from '@/stores/appStore';
import './workspaceMarketMetrics.css';

export default function WorkspaceMarketMetrics() {
  return <main className="workspace-market-metrics" data-tour="market-metrics">
    <header className="wmm-heading">
      <p>MARKET CONTEXT</p>
      <h1>Market Metrics</h1>
      <span>Headline indices and volatility that add context to the market posture shown in Today.</span>
    </header>

    <section className="wmm-rail" aria-label="Index and volatility metrics">
      <TickerRail date={dashboardDate()} />
    </section>

    <section className="wmm-reading">
      <header><p>READ THE RELATIONSHIPS</p><h2>What should confirm the market story?</h2></header>
      <article><i>01</i><div><h3>Broad market</h3><p>Compare NIFTY 50 with NIFTY 500. Similar direction suggests the headline move has wider participation.</p></div></article>
      <article><i>02</i><div><h3>Financial confirmation</h3><p>NIFTY Bank helps show whether a major market driver is confirming or diverging from the headline indices.</p></div></article>
      <article><i>03</i><div><h3>Risk expectations</h3><p>India VIX adds the market’s volatility context. Read it alongside breadth rather than as a standalone direction signal.</p></div></article>
    </section>

    <section className="wmm-astro" aria-label="Astro market context coming soon">
      <div className="wmm-orbit" aria-hidden="true"><i/><i/><b>✶</b></div>
      <div><p>ASTRO CONTEXT</p><h2>A second lens is being prepared</h2><span>Planetary regimes and historical confluence will appear here once the evidence layer is integrated and ready to interpret responsibly.</span></div>
      <strong>COMING SOON</strong>
    </section>
  </main>;
}
