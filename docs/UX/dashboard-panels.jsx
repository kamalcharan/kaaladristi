/* Dashboard panels — hero, pings, transits, outlook, ambient, sectors, breadth */

const { useState: useSp, useEffect: useEp, useRef: useRp, useMemo: useMp } = React;

/* ============ TOP BAR ============ */
function TopBar({ density, setDensity, onReplayTour }) {
  const subtitle = density==='calm' ? 'Calm View' : density==='terminal' ? 'Atmospheric Terminal' : 'Standard View';
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 0 20px', gap:16, flexWrap:'wrap'}}>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <Logo size={26}/>
        <div style={{lineHeight:1.1}}>
          <div className="serif" style={{fontSize:20, color:'var(--ink-1)', letterSpacing:'-0.01em'}}>Dristi<span style={{color:'var(--gold-1)'}}>Q</span></div>
          <div className="mono" style={{fontSize:9, letterSpacing:'.22em', color:'var(--ink-3)', textTransform:'uppercase'}}>{subtitle} · v0.8β</div>
        </div>
      </div>
      <div style={{display:'flex', gap:6}}>
        {['Today','Screener','Scrips','Astro Calendar','VaNi'].map((t,i) => (
          <button key={t} className={`btn ${i===0?'active':''}`}>{t}</button>
        ))}
      </div>
      <div style={{display:'flex', alignItems:'center', gap:14}}>
        <DensityToggle density={density} setDensity={setDensity}/>
        <button className="btn ghost" onClick={onReplayTour} data-tip="Replay VaNi tour" style={{fontSize:10, color:'var(--ink-3)'}}>?</button>
        <div className="mono" style={{fontSize:10, letterSpacing:'.2em', color:'var(--ink-3)', textAlign:'right', lineHeight:1.4}}>
          <div>{DASH.today.date}</div>
          <div style={{color:'var(--gold-2)'}}><span className="pulse-dot" style={{display:'inline-block', width:6, height:6, borderRadius:'50%', background:'var(--gold-1)', marginRight:6, boxShadow:'0 0 8px var(--gold-glow)'}}/>{DASH.today.ist} · NSE OPEN</div>
        </div>
        <button className="btn gold">VaNi · Ask ⌘K</button>
      </div>
    </div>
  );
}

function DensityToggle({ density, setDensity }) {
  const modes = [
    { k:'calm', label:'CALM', tip:'Just today\u2019s read' },
    { k:'standard', label:'STANDARD', tip:'Read + context' },
    { k:'terminal', label:'TERMINAL', tip:'Full cockpit' },
  ];
  return (
    <div style={{display:'inline-flex', border:'1px solid var(--rule)', padding:2}}>
      {modes.map(m => (
        <button key={m.k} data-tip={m.tip} onClick={() => setDensity(m.k)} className="mono" style={{
          padding:'6px 10px', fontSize:9.5, letterSpacing:'.18em',
          background: density===m.k ? 'rgba(226,185,111,0.12)' : 'transparent',
          color: density===m.k ? 'var(--gold-1)' : 'var(--ink-3)',
          transition:'all .15s ease'
        }}>{m.label}</button>
      ))}
    </div>
  );
}

/* ============ HERO VERDICT ============ */
function TodaysSky() {
  const t = DASH.today;
  return (
    <div className="card" style={{marginBottom:16, background:'linear-gradient(180deg, rgba(226,185,111,0.04), rgba(10,10,18,0.3))', borderColor:'var(--rule-hard)'}}>
      <div style={{padding:'22px 26px', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:32, alignItems:'center'}}>
        <div>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
            <span className="eyebrow">◉ Today's Sky</span>
            <span className="pill gold">● ● {t.label} · DAY {t.day}</span>
          </div>
          <div className="serif" style={{fontSize:34, color:'var(--ink-1)', letterSpacing:'-0.02em', lineHeight:1.05, marginBottom:8}}>
            Today reads as <em style={{color:'var(--gold-1)'}}>{t.atmo.toLowerCase()}.</em>
          </div>
          <p style={{margin:0, color:'var(--ink-2)', fontSize:13.5, maxWidth:'60ch', lineHeight:1.55}}>{t.verdict}</p>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:24, justifyContent:'flex-end'}}>
          <div style={{textAlign:'right'}}>
            <div className="eyebrow eyebrow-dim" style={{marginBottom:4}}>VaNi Confidence</div>
            <div className="num-display" style={{fontSize:32, color:'var(--gold-1)', lineHeight:1}}>{t.confidence}<span style={{color:'var(--ink-3)', fontSize:16}}>/100</span></div>
          </div>
          <div style={{width:1, height:56, background:'var(--rule)'}}/>
          <Donut pct={t.confidence} size={72}/>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:4, borderLeft:'1px solid var(--rule)', paddingLeft:24}}>
          <div className="eyebrow eyebrow-dim">Two Lenses · Agreement</div>
          <div style={{display:'flex', gap:10, alignItems:'center'}}>
            <span className="pill green">LENS I · BEARISH</span>
          </div>
          <div style={{display:'flex', gap:10, alignItems:'center'}}>
            <span className="pill green">LENS II · DEFENSIVE</span>
          </div>
          <div className="mono" style={{fontSize:10, color:'var(--gold-2)', marginTop:4, letterSpacing:'.14em'}}>⊕ CONVERGENCE</div>
        </div>
      </div>

      {/* Panchangam + live ticker strip */}
      <div style={{borderTop:'1px solid var(--rule-soft)', padding:'12px 26px', display:'flex', gap:28, alignItems:'center', flexWrap:'wrap', background:'rgba(0,0,0,0.2)'}}>
        <div className="eyebrow">◇ Panchāṅgam</div>
        {Object.entries(t.panchangam).map(([k,v]) => (
          <div key={k} style={{display:'flex', gap:8, alignItems:'baseline'}}>
            <span className="mono" style={{fontSize:9.5, letterSpacing:'.16em', color:'var(--ink-4)', textTransform:'uppercase'}}>{k}</span>
            <span style={{fontSize:12, color:'var(--ink-1)'}}>{v}</span>
          </div>
        ))}
        <div style={{flex:1}}/>
        <div className="mono" style={{fontSize:10, color:'var(--ink-3)', letterSpacing:'.14em'}}>Historically neutral for banking · mildly negative for IT</div>
      </div>
    </div>
  );
}

/* ============ CURRENT SKY (transits rail) ============ */
function CurrentSky() {
  const [hover, setHover] = useSp(null);
  return (
    <div className="card" style={{height:'100%'}}>
      <div className="card-head">
        <div className="card-title">Current Sky</div>
        <span className="pill">LIVE</span>
      </div>
      <div style={{padding:'8px 0 12px'}}>
        {DASH.transits.map((t,i) => (
          <TransitRow key={t.id} t={t} active={hover===t.id} onHover={() => setHover(t.id)} last={i===DASH.transits.length-1}/>
        ))}
      </div>
      <div style={{padding:'10px 16px', borderTop:'1px solid var(--rule-soft)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <span className="mono" style={{fontSize:9, letterSpacing:'.2em', color:'var(--ink-4)'}}>5 TRACKED · ḶAHIRI AYANĀṂŚA</span>
        <button className="btn ghost" style={{fontSize:10, color:'var(--gold-1)'}}>FULL CHART →</button>
      </div>
    </div>
  );
}

function TransitRow({ t, active, onHover, last }) {
  const colorMap = { pos:'var(--green)', neg:'var(--red)', neu:'var(--gold-1)' };
  const col = colorMap[t.sign];
  return (
    <div onMouseEnter={onHover} style={{
      padding:'12px 16px', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:12, alignItems:'start',
      borderBottom: last?'none':'1px solid var(--rule-soft)',
      background: active ? 'rgba(226,185,111,0.04)':'transparent',
      transition:'background .2s ease', cursor:'pointer'
    }}>
      <div style={{textAlign:'center', paddingTop:2}}>
        <div style={{width:8, height:8, borderRadius:'50%', background:col, margin:'0 auto 4px', boxShadow:t.sig==='major'?`0 0 10px ${col}`:'none'}}/>
        <div className="mono" style={{fontSize:8, letterSpacing:'.14em', color:'var(--ink-4)'}}>{t.sig==='major'?'MAJ':'min'}</div>
      </div>
      <div>
        <div style={{display:'flex', gap:6, alignItems:'baseline', marginBottom:3}}>
          <span className="serif" style={{fontSize:15, color:'var(--ink-1)', letterSpacing:'-0.01em'}}>{t.body}</span>
          <span style={{color:'var(--gold-2)', fontSize:13}}>{t.aspect}</span>
          <span className="serif" style={{fontSize:15, color:'var(--ink-1)'}}>{t.body2}</span>
          <span className="mono" style={{fontSize:9.5, color:'var(--ink-4)', marginLeft:2}}>{t.deg}</span>
        </div>
        <div className="mono" style={{fontSize:9.5, letterSpacing:'.14em', color:'var(--ink-3)', marginBottom:6, textTransform:'uppercase'}}>
          {t.when} · <span style={{color: t.countdown==='active'?'var(--green)':'var(--gold-2)'}}>{t.countdown}</span>
        </div>
        <div style={{fontSize:11.5, color:'var(--ink-2)', lineHeight:1.45}}>{t.note}</div>
      </div>
      <div style={{color:'var(--ink-4)', fontSize:14, paddingTop:2}}>→</div>
    </div>
  );
}

/* ============ PINGS (center column) ============ */
function PingsColumn() {
  const [open, setOpen] = useSp(1); // second ping open by default
  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, gap:12, flexWrap:'wrap'}}>
        <div style={{display:'flex', alignItems:'baseline', gap:14, flexWrap:'wrap'}}>
          <span className="serif" style={{fontSize:22, color:'var(--ink-1)', letterSpacing:'-0.01em'}}>Today's <em style={{color:'var(--gold-1)'}}>Read</em></span>
          <span className="eyebrow">VaNi's read · 3 pings</span>
        </div>
        <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
          <button className="btn active" style={{fontSize:10}}>ALL</button>
          <button className="btn" style={{fontSize:10}}>OPPORTUNITY</button>
          <button className="btn" style={{fontSize:10}}>HEADS-UP</button>
        </div>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        {DASH.pings.map((p,i) => <PingRow key={i} p={p} open={open===i} onToggle={() => setOpen(open===i?-1:i)}/>)}
      </div>
      <div style={{marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', border:'1px solid var(--rule-soft)', background:'rgba(10,10,18,0.5)'}}>
        <div className="mono" style={{fontSize:10, letterSpacing:'.16em', color:'var(--ink-3)', textTransform:'uppercase'}}>
          <span className="pulse-dot" style={{display:'inline-block', width:6, height:6, borderRadius:'50%', background:'var(--gold-1)', marginRight:8}}/>
          VaNi is watching 8 setups · 1 just pinged
        </div>
        <button className="btn gold">Review the ping →</button>
      </div>
    </div>
  );
}

function PingRow({ p, open, onToggle }) {
  const colBorder = { gold:'var(--gold-2)', green:'var(--green-dim)', indigo:'#4a3f8a' }[p.color] || 'var(--rule)';
  const dotCol = { gold:'var(--gold-1)', green:'var(--green)', indigo:'#a89dff' }[p.color];
  const chartData = p.chart==='up-sharp' ? [30,32,33,35,38,44,55,66,78] : [50,48,52,55,58,60,65,72,80];
  return (
    <div className="card" style={{borderColor: open ? colBorder : 'var(--rule)', background: open ? 'linear-gradient(180deg, rgba(226,185,111,0.03), rgba(10,10,18,0.4))' : undefined}}>
      <div onClick={onToggle} style={{padding:'18px 22px', display:'grid', gridTemplateColumns:'auto 1fr auto auto', gap:22, alignItems:'center', cursor:'pointer'}}>
        <div style={{width:14, height:14, borderRadius:'50%', background:dotCol, boxShadow:`0 0 14px ${dotCol}80`}}/>
        <div>
          <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap'}}>
            <span className="eyebrow" style={{color: p.color==='indigo'?'#a89dff':'var(--gold-2)'}}>◆ {p.kind}</span>
            <span style={{color:'var(--ink-4)', fontSize:10}}>·</span>
            <span className="mono" style={{fontSize:10, letterSpacing:'.14em', color:'var(--ink-3)', textTransform:'uppercase'}}>{p.scope}</span>
            <span className="pill">{p.tag}</span>
          </div>
          <div className="serif" style={{fontSize:18, color: dotCol, letterSpacing:'-0.01em', marginBottom:3, display:'inline'}}>{p.title} </div>
          <span style={{fontSize:13.5, color:'var(--ink-2)', lineHeight:1.55}}>{p.body}</span>
          <div style={{display:'flex', gap:14, marginTop:10, flexWrap:'wrap'}}>
            {p.kpis.map((k,j) => (
              <div key={j} className="mono" style={{fontSize:10, letterSpacing:'.12em', color:'var(--ink-3)', textTransform:'uppercase'}}>
                {k.k && <span>{k.k} </span>}
                {k.v && <span style={{color: signColor(k.sign), fontWeight:500}}>{k.v}</span>}
              </div>
            ))}
          </div>
        </div>
        <div style={{opacity:0.9}}>
          {p.chart==='bars'
            ? <MiniBars data={[-1,1,-1,-1,-1,1,-1,-1]} w={110} h={40}/>
            : <Spark data={chartData} color={dotCol} w={110} h={40}/>
          }
        </div>
        <div style={{textAlign:'right'}}>
          <div className="num-display" style={{fontSize:32, color:dotCol, lineHeight:1}}>{p.score}</div>
          <div className="mono" style={{fontSize:9, letterSpacing:'.18em', color:'var(--ink-4)'}}>{p.scoreLabel}</div>
        </div>
      </div>
      <div className={`drawer ${open?'open':''}`}>
        <PingDrawer p={p} color={dotCol}/>
      </div>
    </div>
  );
}

function PingDrawer({ p, color }) {
  return (
    <div style={{padding:'0 22px 18px', borderTop:'1px solid var(--rule-soft)', marginTop:0}}>
      <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr', gap:24, padding:'18px 0'}}>
        <div>
          <div className="eyebrow" style={{marginBottom:10}}>VaNi's Reasoning</div>
          <ol style={{margin:0, padding:0, listStyle:'none', color:'var(--ink-2)', fontSize:12.5, lineHeight:1.6}}>
            <li style={{padding:'6px 0', borderBottom:'1px solid var(--rule-soft)'}}><span className="mono" style={{color:'var(--gold-2)', marginRight:8}}>L1</span>Panchāṅgam cycle matches 5Y reversal signature (p=0.032)</li>
            <li style={{padding:'6px 0', borderBottom:'1px solid var(--rule-soft)'}}><span className="mono" style={{color:'var(--gold-2)', marginRight:8}}>L2</span>Volume / price divergence in top 6 scrips (3.4× avg)</li>
            <li style={{padding:'6px 0'}}><span className="mono" style={{color:'var(--gold-2)', marginRight:8}}>⊕</span>Both lenses convergent — atmospheric attention warranted</li>
          </ol>
        </div>
        <div>
          <div className="eyebrow" style={{marginBottom:10}}>Historical Analogues · 8Y</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
            {[['n=','24'],['median 5D','+2.1%'],['hit rate','71%'],['max DD','−4.3%']].map(([k,v],i) => (
              <div key={i}>
                <div className="mono" style={{fontSize:9.5, letterSpacing:'.14em', color:'var(--ink-4)'}}>{k}</div>
                <div className="num-display" style={{fontSize:16, color:'var(--ink-1)'}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{marginBottom:10}}>Constituents</div>
          <div style={{fontSize:12, color:'var(--ink-2)'}}>
            {['PAGE IND','KPR MILL','WELSPUN LIV','RAYMOND','VARDHMAN','TRIDENT'].map(s => (
              <div key={s} style={{padding:'5px 0', borderBottom:'1px solid var(--rule-soft)', display:'flex', justifyContent:'space-between'}}>
                <span>{s}</span>
                <span className="mono" style={{color:'var(--gold-1)'}}>+{(Math.random()*5+1).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ SIX-DAY OUTLOOK ============ */
function SixDayOutlook() {
  const [sel, setSel] = useSp(4);
  const colMap = {
    'Caution': { c:'#d9a76c', bg:'rgba(226,185,111,.08)', b:'var(--gold-3)' },
    'Negative': { c:'var(--red)', bg:'rgba(217,122,108,.08)', b:'var(--red-dim)' },
    'Positive': { c:'var(--green)', bg:'rgba(110,207,154,.08)', b:'var(--green-dim)' },
    'Neutral': { c:'var(--ink-3)', bg:'rgba(255,255,255,.02)', b:'var(--rule-soft)' }
  };
  return (
    <div className="card">
      <div className="card-head">
        <div style={{display:'flex', alignItems:'center', gap:14}}>
          <div className="card-title">Six-day Outlook</div>
          <span className="mono" style={{fontSize:10, color:'var(--ink-4)', letterSpacing:'.14em'}}>FORWARD READ · TIME-CYCLE PROJECTION</span>
        </div>
        <button className="btn ghost" style={{fontSize:10, color:'var(--gold-1)'}}>PLANETARY INTEL →</button>
      </div>
      <div style={{padding:'18px 20px'}}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:8}}>
          {DASH.outlook.map((d,i) => {
            const m = colMap[d.state];
            const active = sel===i;
            return (
              <button key={i} onClick={() => setSel(i)} style={{
                padding:'16px 12px', textAlign:'left',
                border:`1px solid ${active? m.c : m.b}`,
                background: active ? m.bg : 'transparent',
                transition:'all .2s ease', cursor:'pointer'
              }}>
                <div className="mono" style={{fontSize:9.5, letterSpacing:'.22em', color:'var(--ink-4)', marginBottom:4}}>{d.d}</div>
                <div className="num-display" style={{fontSize:24, color: active ? m.c : 'var(--ink-1)', lineHeight:1}}>{d.n}</div>
                <div className="mono" style={{fontSize:9, letterSpacing:'.16em', color: m.c, marginTop:8, textTransform:'uppercase'}}>{d.state}</div>
              </button>
            );
          })}
        </div>
        <div style={{marginTop:14, padding:'12px 16px', borderLeft:`2px solid ${colMap[DASH.outlook[sel].state].c}`, background:'rgba(10,10,18,0.5)'}}>
          <div className="mono" style={{fontSize:10, letterSpacing:'.18em', color:'var(--ink-3)', textTransform:'uppercase', marginBottom:4}}>
            {DASH.outlook[sel].d} {DASH.outlook[sel].n} APR · {DASH.outlook[sel].state}
          </div>
          <div style={{fontSize:13, color:'var(--ink-1)', lineHeight:1.5}}>{DASH.outlook[sel].why}</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TopBar, TodaysSky, CurrentSky, PingsColumn, SixDayOutlook });
