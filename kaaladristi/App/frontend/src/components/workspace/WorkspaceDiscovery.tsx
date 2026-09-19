import SectorPulse from '@/components/domain/DashboardV3/SectorPulse';
import VaNiHighlightsBoard from '@/components/domain/VaNiHighlightsBoard';
import './workspaceDiscovery.css';

export default function WorkspaceDiscovery() {
  return <main className="workspace-discovery">
    <header className="wd-heading">
      <div><p>DISCOVERY</p><h1>Where is activity appearing now?</h1><span>Start with recent sector flow, then inspect the stocks confirming that activity.</span></div>
      <div className="wd-horizons" aria-label="Discovery horizon">
        <button className="active" aria-pressed="true"><i />Short-term flow<small>Current · recent activity</small></button>
        <button disabled aria-disabled="true"><i />Longer-term strength<small>Next · sustained structure</small></button>
      </div>
    </header>
    <section className="wd-section" data-tour="sector-pulse">
      <header className="wd-section-heading"><div><span>STEP 1 · SECTORS</span><h2>Short-term sector flow</h2><p>5D activity is foregrounded; 22D is retained as context so a recent move is not read in isolation.</p></div><em>Observation window · 5 sessions</em></header>
      <div className="wd-panel"><SectorPulse /></div>
    </section>
    <section className="wd-section" data-tour="vani-highlights">
      <header className="wd-section-heading"><div><span>STEP 2 · STOCKS</span><h2>Stocks confirming the flow</h2><p>Strength and caution remain visible together. Multiple scanner flags indicate agreement for research, not a trade call.</p></div><em>Ranked by scanner agreement</em></header>
      <div className="wd-panel"><VaNiHighlightsBoard /></div>
    </section>
  </main>;
}
