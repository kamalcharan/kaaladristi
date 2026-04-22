/* Astro Calendar — App shell */

const { useState: usS, useMemo: usM, useEffect: usE } = React;

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

function TopBar({ role, setRole, month }) {
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 0 20px', gap:16, flexWrap:'wrap'}}>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <Logo size={26}/>
        <div style={{lineHeight:1.1}}>
          <div className="serif" style={{fontSize:20, color:'var(--ink-1)', letterSpacing:'-0.01em'}}>Dristi<span style={{color:'var(--gold-1)'}}>Q</span></div>
          <div className="mono" style={{fontSize:9, letterSpacing:'.22em', color:'var(--ink-3)', textTransform:'uppercase'}}>Astro Calendar · v0.9β</div>
        </div>
      </div>
      <div style={{display:'flex', gap:6}}>
        {['Today','Screener','Scrips','Astro Calendar','VaNi'].map((t,i) => (
          <button key={t} className={`btn ${i===3?'active':''}`}>{t}</button>
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
        <div style={{display:'flex', alignItems:'center', gap:4}}>
          <button className="btn ghost" style={{fontSize:12, padding:'6px 10px'}}>‹</button>
          <div className="mono" style={{fontSize:11, color:'var(--ink-2)', letterSpacing:'.18em', textTransform:'uppercase', minWidth:120, textAlign:'center'}}>{month}</div>
          <button className="btn ghost" style={{fontSize:12, padding:'6px 10px'}}>›</button>
        </div>
        <button className="btn gold">VaNi · ⌘K</button>
      </div>
    </div>
  );
}

function UserView({ events, transits, filter, setFilter, picked, setPicked }) {
  return (
    <div>
      <MonthGrid transits={transits} events={events} onPick={setPicked} picked={picked}/>
      <div className="split-main" style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16, marginTop:16, alignItems:'flex-start'}}>
        <TransitRails transits={transits} events={events} onPick={setPicked} picked={picked} filter={filter} setFilter={setFilter}/>
        <div style={{position:'sticky', top:16}}>
          <Inspector picked={picked} onClose={() => setPicked(null)}/>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [role, setRole] = usS(() => localStorage.getItem('ac.role') || 'user');
  const [events, setEvents] = usS(AC.EVENTS_SEED);
  const [transits, setTransits] = usS(AC.TRANSITS_SEED);
  const [filter, setFilter] = usS('all');
  const [picked, setPicked] = usS(null);

  usE(() => localStorage.setItem('ac.role', role), [role]);

  return (
    <React.Fragment>
      <TopBar role={role} setRole={setRole} month={AC.MONTH.label}/>
      {role === 'user'
        ? <UserView events={events} transits={transits} filter={filter} setFilter={setFilter} picked={picked} setPicked={setPicked}/>
        : <AdminTable events={events} setEvents={setEvents} transits={transits} setTransits={setTransits}/>
      }
      <footer style={{marginTop:40, paddingTop:24, borderTop:'1px solid var(--rule-soft)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
        <div className="mono" style={{fontSize:10, letterSpacing:'.18em', color:'var(--ink-4)', textTransform:'uppercase'}}>DristiQ β · Astro Calendar · {role.toUpperCase()} VIEW</div>
        <div className="mono" style={{fontSize:10, letterSpacing:'.18em', color:'var(--ink-4)', textTransform:'uppercase'}}>Data platform only · not investment advice</div>
      </footer>
    </React.Fragment>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
