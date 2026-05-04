/* Rule Backtest — App */
const { useState: usS, useEffect: usE, useMemo: usM } = React;

function Logo({ size=22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="none" stroke="#c9a84c" strokeWidth="0.8"/>
      <circle cx="16" cy="16" r="9" fill="none" stroke="#c9a84c" strokeWidth="0.5" opacity=".7"/>
      {[0,45,90,135,180,225,270,315].map(d => {
        const a = (d-90)*Math.PI/180;
        return <line key={d} x1={16+12*Math.cos(a)} y1={16+12*Math.sin(a)} x2={16+14*Math.cos(a)} y2={16+14*Math.sin(a)} stroke="#e2b96f" strokeWidth="0.8"/>;
      })}
      <circle cx="16" cy="16" r="1.5" fill="#e2b96f"/>
    </svg>
  );
}

function TopBar({ role, setRole }) {
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 0 20px', gap:16, flexWrap:'wrap'}}>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <button className="btn ghost" style={{fontSize:11}}>‹ Rule Engine</button>
        <Logo size={22}/>
        <div className="mono" style={{fontSize:10, letterSpacing:'.22em', color:'var(--ink-3)', textTransform:'uppercase'}}>DRISTIQ · BACKTEST</div>
      </div>
      <div style={{display:'flex', gap:6}}>
        {['Today','Screener','Scrips','Astro Calendar','Rule Engine','VaNi'].map((t,i) => (
          <button key={t} className={`btn ${i===4?'active':''}`}>{t}</button>
        ))}
      </div>
      <div style={{display:'flex', alignItems:'center', gap:14}}>
        <div style={{display:'inline-flex', border:'1px solid var(--rule)', padding:2}}>
          {['user','admin'].map(r => (
            <button key={r} onClick={() => setRole(r)} className="mono" style={{
              padding:'6px 12px', fontSize:9.5, letterSpacing:'.2em', textTransform:'uppercase',
              background: role===r ? 'rgba(226,185,111,0.12)' : 'transparent',
              color: role===r ? 'var(--gold-1)' : 'var(--ink-3)'
            }}>{r}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [role, setRole] = usS(() => localStorage.getItem('bt.role') || 'user');
  const [highlight, setHighlight] = usS(null);
  usE(() => localStorage.setItem('bt.role', role), [role]);
  const stats = usM(() => BT.computeStats(BT.TRANSITS), []);

  return (
    <React.Fragment>
      <TopBar role={role} setRole={setRole}/>
      <RuleHeader rule={BT.RULE} role={role} onRun={() => alert('Running discovery…')}/>
      <div className="hero-split" style={{display:'grid', gridTemplateColumns:'1fr', gap:16}}>
        <EquityHero transits={BT.TRANSITS} stats={stats} highlight={highlight} setHighlight={setHighlight}/>
      </div>
      <StatGrid stats={stats}/>
      <RegimeAnalysis transits={BT.TRANSITS}/>
      <DetailTabs transits={BT.TRANSITS} upcoming={BT.UPCOMING} occurrences={BT.OCCURRENCES} nextFires={BT.NEXT_FIRES} highlight={highlight} setHighlight={setHighlight}/>
      <footer style={{marginTop:40, paddingTop:24, borderTop:'1px solid var(--rule-soft)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
        <div className="mono" style={{fontSize:10, letterSpacing:'.18em', color:'var(--ink-4)', textTransform:'uppercase'}}>DristiQ β · Rule Backtest · {role.toUpperCase()} VIEW · Benchmark: NIFTY (extendable to indices + stocks)</div>
        <div className="mono" style={{fontSize:10, letterSpacing:'.18em', color:'var(--ink-4)', textTransform:'uppercase'}}>Data platform only · not investment advice</div>
      </footer>
    </React.Fragment>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
