/* Market Floor (ambient gauges + breadth drawer) + Sector Rotation + App */

const { useState: usS, useEffect: usE, useMemo: usM } = React;

/* ============ AMBIENT GAUGES ============ */
function AmbientGauges({ onExpand, expanded }) {
  return (
    <div className="card" style={{marginTop:16}}>
      <div className="card-head">
        <div className="card-title">The Market Floor · Ambient Context</div>
        <div style={{display:'flex', gap:6}}>
          {['22D','44D','66D'].map((t,i) => (
            <button key={t} className={`btn ${i===2?'active':''}`} style={{fontSize:10, padding:'5px 10px'}}>{t}</button>
          ))}
        </div>
      </div>
      <div className="ambient-grid" style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', borderBottom: expanded>=0?'1px solid var(--rule-soft)':'none'}}>
        {DASH.ambient.map((g,i) => {
          const col = g.color==='gold'?'#e2b96f':g.color==='red'?'#d97a6c':g.color==='green'?'#6ecf9a':'#d9cfb6';
          const active = expanded===i;
          return (
            <button key={i} onClick={() => onExpand(active?-1:i)} style={{
              padding:'18px 20px', textAlign:'left', borderRight:i<3?'1px solid var(--rule-soft)':'none',
              background: active?'rgba(226,185,111,0.04)':'transparent', transition:'background .2s ease', cursor:'pointer',
              borderBottom: active ? `2px solid ${col}` : '2px solid transparent'
            }}>
              <div className="eyebrow eyebrow-dim" style={{marginBottom:8}}>{g.k}</div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:6}}>
                <div className="num-display" style={{fontSize:28, color: col, lineHeight:1}}>{g.v}</div>
                <Spark data={g.trend} color={col} w={80} h={28} fill={false}/>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                <span className="mono" style={{fontSize:10, color: g.sign==='neg'?'var(--red)':'var(--ink-3)', letterSpacing:'.14em', textTransform:'uppercase'}}>{g.sub}</span>
                <span style={{color:'var(--ink-4)', fontSize:10}}>{active ? '▾' : '▸'}</span>
              </div>
              <div style={{fontSize:11.5, color:'var(--ink-2)', lineHeight:1.4, fontStyle:'italic'}}>{g.note}</div>
            </button>
          );
        })}
      </div>
      <div className={`drawer ${expanded>=0?'open':''}`}>
        {expanded>=0 && <GaugeDrawer which={expanded}/>}
      </div>
    </div>
  );
}

function GaugeDrawer({ which }) {
  if (which === 0 || which === 1) return <BreadthDetail which={which}/>;
  if (which === 2) return <RotationDetailMini/>;
  return <LeadershipDetail/>;
}

/* === BREADTH DETAIL (shared for both breadth + momentum) === */
function BreadthDetail({ which }) {
  const [tf, setTf] = usS('66D');
  const isMomentum = which === 1;
  const series = DASH.breadth.series;
  const w = 1600, h = 200;
  const N = series.length;
  const xFor = i => (i/(N-1))*w;
  const yFor = v => h - ((v)/100)*h*0.9 - 6;
  const path = series.map((v,i) => `${i===0?'M':'L'} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ');
  const fillPath = path + ` L ${w} ${h} L 0 ${h} Z`;
  const current = series[series.length-1];

  return (
    <div style={{padding:'22px 22px 24px'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18, gap:20, flexWrap:'wrap'}}>
        <div>
          <div className="eyebrow" style={{marginBottom:6}}>{isMomentum ? 'BREADTH MOMENTUM · ROC' : 'MARKET BREADTH · EMA STACK'}</div>
          <div className="serif" style={{fontSize:20, color:'var(--ink-1)', letterSpacing:'-0.01em'}}>
            {isMomentum
              ? <>ROC is flattening. <em style={{color:'var(--red)'}}>Rollover possible in 3–5 sessions.</em></>
              : <>Breadth widening, <em style={{color:'var(--gold-1)'}}>but thin at the top.</em></>}
          </div>
          <div className="mono" style={{fontSize:10.5, color:'var(--ink-3)', letterSpacing:'.14em', marginTop:4}}>
            {isMomentum ? '876+ stocks · GroupAvg ROC oscillator' : '1,121+ stocks analyzed · % above EMA'}
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:20}}>
          {(isMomentum
            ? [{k:'ROC 13', v:'+1.47', sign:'pos'},{k:'ROC 55', v:'+0.10', sign:'pos'},{k:'SMA 5', v:'+1.11', sign:'pos'}]
            : DASH.breadth.emas.map(e=>({k:e.k, v:e.v+'%', sign:'pos'}))
          ).map((e,i) => (
            <div key={i}>
              <div className="mono" style={{fontSize:9.5, letterSpacing:'.14em', color:'var(--ink-3)'}}>{e.k}</div>
              <div className="num-display" style={{fontSize:18, color:signColor(e.sign)}}>{e.v}</div>
            </div>
          ))}
          <div style={{padding:'6px 12px', border:`1px solid ${isMomentum?'var(--green-dim)':'var(--gold-3)'}`, color: isMomentum?'var(--green)':'var(--gold-1)'}} className="mono">{isMomentum?'BULL ✓':'GREED'}</div>
          <div style={{display:'flex', gap:4}}>
            {['22D','44D','66D'].map(t => (
              <button key={t} className={`btn ${tf===t?'active':''}`} style={{fontSize:10, padding:'5px 10px'}} onClick={() => setTf(t)}>{t}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{position:'relative', background:'rgba(0,0,0,0.3)', border:'1px solid var(--rule-soft)', padding:'14px 18px 10px'}}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{width:'100%', height:200, display:'block'}}>
          {/* gridlines */}
          {[20,40,60,80].map(y => (
            <g key={y}>
              <line x1="0" y1={h - (y/100)*h*0.9 - 6} x2={w} y2={h - (y/100)*h*0.9 - 6} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="3 6"/>
            </g>
          ))}
          {/* zones */}
          <rect x="0" y={yFor(55)} width={w} height={Math.max(0,yFor(100)-yFor(55))*-1} fill="rgba(110,207,154,0.04)"/>
          <line x1="0" y1={yFor(55)} x2={w} y2={yFor(55)} stroke="rgba(110,207,154,0.3)" strokeWidth="0.6" strokeDasharray="4 6"/>
          <line x1="0" y1={yFor(35)} x2={w} y2={yFor(35)} stroke="rgba(217,122,108,0.3)" strokeWidth="0.6" strokeDasharray="4 6"/>
          <path d={fillPath} fill="url(#breadthFill)" opacity="0.6"/>
          <defs>
            <linearGradient id="breadthFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={isMomentum?'#6ecf9a':'#e2b96f'} stopOpacity="0.3"/>
              <stop offset="100%" stopColor={isMomentum?'#6ecf9a':'#e2b96f'} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={path} fill="none" stroke={isMomentum?'#6ecf9a':'#e2b96f'} strokeWidth="1.5"/>
          {/* current marker */}
          <circle cx={xFor(N-1)} cy={yFor(current)} r="4" fill={isMomentum?'#6ecf9a':'#e2b96f'}/>
          <circle cx={xFor(N-1)} cy={yFor(current)} r="8" fill="none" stroke={isMomentum?'#6ecf9a':'#e2b96f'} strokeWidth="0.6" opacity="0.4"/>
        </svg>
        <div style={{position:'absolute', top:14, right:18, textAlign:'right'}}>
          <div className="mono" style={{fontSize:9, letterSpacing:'.18em', color:'var(--ink-4)'}}>CURRENT</div>
          <div className="num-display" style={{fontSize:20, color: isMomentum?'var(--green)':'var(--gold-1)'}}>{isMomentum?'+0.91':current.toFixed(1)}</div>
        </div>
        <div style={{position:'absolute', bottom:6, left:18, right:18, display:'flex', justifyContent:'space-between'}}>
          {['13 Jan','10 Feb','10 Mar','14 Apr','21 Apr'].map(d => (
            <span key={d} className="mono" style={{fontSize:9, color:'var(--ink-4)', letterSpacing:'.1em'}}>{d}</span>
          ))}
        </div>
      </div>
      <div style={{marginTop:14, display:'flex', gap:24, flexWrap:'wrap'}}>
        {[
          {c:'var(--green)', l:'Greed (>55)'},{c:'var(--gold-1)', l:'Neutral (35–55)'},{c:'var(--red)', l:'Fear (<35)'}
        ].map(({c,l}) => (
          <span key={l} className="mono" style={{fontSize:10, letterSpacing:'.12em', color:'var(--ink-3)', display:'flex', alignItems:'center', gap:6}}>
            <span className="dot" style={{background:c}}/>{l}
          </span>
        ))}
      </div>
    </div>
  );
}

function RotationDetailMini() {
  return (
    <div style={{padding:'20px 22px'}}>
      <div className="eyebrow" style={{marginBottom:10}}>6 INDUSTRIES ROTATING IN · 3D</div>
      <div style={{fontSize:13.5, color:'var(--ink-2)', lineHeight:1.6, maxWidth:'80ch'}}>
        Defensive concentration forming — Pharma and Commodities absorbing capital from consumer discretionary. Rotation score crosses historical 80th percentile, a signature that precedes cautious-trend regimes in <em style={{color:'var(--gold-1)'}}>72% of post-2018 occurrences.</em>
      </div>
    </div>
  );
}

function LeadershipDetail() {
  return (
    <div style={{padding:'20px 22px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}}>
      <div>
        <div className="eyebrow" style={{marginBottom:10}}>TOP 10 · STRONGEST (VS CNX500)</div>
        <table style={{width:'100%', fontSize:12, borderCollapse:'collapse'}}>
          <tbody>
            {DASH.leadership.map((s,i) => (
              <tr key={i} style={{borderBottom:'1px solid var(--rule-soft)'}}>
                <td style={{padding:'8px 0', color:'var(--ink-1)', fontWeight:500}}>{s.sym}{s.new && <span className="pill gold" style={{marginLeft:8, padding:'1px 6px', fontSize:8}}>NEW</span>}</td>
                <td className="num-display" style={{color:'var(--gold-1)'}}>{s.rs}</td>
                <td className="num-display" style={{color: s.d.startsWith('-')?'var(--red)':'var(--green)'}}>{s.d}</td>
                <td className="mono" style={{fontSize:9, color:'var(--ink-3)', letterSpacing:'.1em'}}>{s.sector}</td>
                <td><span className="pill">{s.flag}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className="eyebrow" style={{marginBottom:10, color:'var(--red)'}}>BOTTOM 10 · WEAKEST</div>
        <table style={{width:'100%', fontSize:12, borderCollapse:'collapse'}}>
          <tbody>
            {DASH.weakness.map((s,i) => (
              <tr key={i} style={{borderBottom:'1px solid var(--rule-soft)'}}>
                <td style={{padding:'8px 0', color:'var(--ink-2)'}}>{s.sym}</td>
                <td className="num-display" style={{color:'var(--red)'}}>{s.rs}</td>
                <td className="num-display" style={{color:'var(--red)'}}>{s.d}</td>
                <td className="mono" style={{fontSize:9, color:'var(--ink-3)', letterSpacing:'.1em'}}>{s.sector}</td>
                <td><span className="pill red">{s.flag}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============ SECTOR ROTATION FLOW ============ */
function SectorRotation() {
  const lanes = [
    { k:'LEADING', data: DASH.sectors.leading, col:'var(--gold-1)', glyph:'◆', sub:'holding position' },
    { k:'ROTATING IN', data: DASH.sectors.rotating_in, col:'var(--green)', glyph:'↗', sub:'capital inflow' },
    { k:'ROTATING OUT', data: DASH.sectors.rotating_out, col:'var(--red)', glyph:'↘', sub:'capital outflow' }
  ];
  return (
    <div className="card" style={{marginTop:16}}>
      <div className="card-head">
        <div className="card-title">Sector Rotation · Industry Flow</div>
        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          <span className="mono" style={{fontSize:10, letterSpacing:'.14em', color:'var(--ink-3)'}}>167 INDUSTRIES · 3D LOOKBACK</span>
          <button className="btn ghost" style={{color:'var(--gold-1)', fontSize:10}}>FULL MAP →</button>
        </div>
      </div>
      <div className="rotation-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr'}}>
        {lanes.map((lane,i) => (
          <div key={i} style={{padding:'18px 20px', borderRight: i<2?'1px solid var(--rule-soft)':'none'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:16}}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{color:lane.col, fontSize:14}}>{lane.glyph}</span>
                <span className="eyebrow" style={{color:lane.col}}>{lane.k}</span>
              </div>
              <span className="mono" style={{fontSize:9, letterSpacing:'.12em', color:'var(--ink-4)'}}>{lane.sub}</span>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:2}}>
              {lane.data.map((s,j) => (
                <div key={j} style={{display:'grid', gridTemplateColumns:'1fr auto auto', gap:10, alignItems:'center', padding:'9px 10px', background: j===0?'rgba(226,185,111,0.03)':'transparent', borderLeft: j===0?`2px solid ${lane.col}`:'2px solid transparent', transition:'all .15s ease', cursor:'pointer'}}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = j===0?'rgba(226,185,111,0.03)':'transparent'}>
                  <span style={{fontSize:12.5, color:'var(--ink-1)'}}>{s.name}</span>
                  <span className="num-display" style={{fontSize:11.5, color: lane.col}}>{s.rs}</span>
                  <span className="mono" style={{fontSize:9, letterSpacing:'.1em', color:'var(--ink-4)', minWidth:56, textAlign:'right'}}>{s.delta || `held ${s.held}`}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* flow visual below */}
      <div style={{padding:'16px 20px 20px', borderTop:'1px solid var(--rule-soft)'}}>
        <RotationFlowGraph/>
      </div>
    </div>
  );
}

function RotationFlowGraph() {
  // Simple 3-stage flow with connector arcs
  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        <span className="eyebrow eyebrow-dim">CAPITAL FLOW · LAST 3 SESSIONS</span>
        <span className="mono" style={{fontSize:9, letterSpacing:'.14em', color:'var(--ink-4)'}}>width ∝ rotation score</span>
      </div>
      <svg viewBox="0 0 1600 110" preserveAspectRatio="none" style={{width:'100%', height:110, display:'block'}}>
        {/* three columns of nodes */}
        {[
          { x: 120, col:'#d97a6c', label:'ROTATING OUT', items: ['Beverages','MedDev','Drug Mfrs','Regional Banks'] },
          { x: 800, col:'#e2b96f', label:'IN TRANSIT', items: ['Capital rotating through defensives'] },
          { x: 1480, col:'#6ecf9a', label:'ROTATING IN', items: ['Speciality Retail','E-Retail','TV Broadcasting','Pharma'] }
        ].map((node,i) => (
          <g key={i}>
            {node.items.map((it,j) => {
              const y = 20 + j*20;
              return (
                <g key={j}>
                  <circle cx={node.x} cy={y} r="4" fill={node.col}/>
                  <text x={i===2?node.x-12:i===0?node.x+12:node.x} y={y+4} fill="var(--ink-2)"
                    textAnchor={i===2?'end':i===0?'start':'middle'}
                    fontSize="11" fontFamily="DM Sans">{it}</text>
                </g>
              );
            })}
          </g>
        ))}
        {/* connectors */}
        {[0,1,2,3].map(j => {
          const y = 20+j*20;
          return <path key={`l${j}`} d={`M 124 ${y} C 400 ${y}, 500 55, 796 55`} fill="none" stroke="#d97a6c" strokeWidth="1" opacity={0.35 + (3-j)*0.1}/>;
        })}
        {[0,1,2,3].map(j => {
          const y = 20+j*20;
          return <path key={`r${j}`} d={`M 804 55 C 1100 55, 1200 ${y}, 1476 ${y}`} fill="none" stroke="#6ecf9a" strokeWidth="1.3" opacity={0.4 + (3-j)*0.12}/>;
        })}
        <text x="120" y="106" fill="var(--ink-4)" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle" letterSpacing="1.2">OUT</text>
        <text x="800" y="106" fill="var(--gold-2)" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle" letterSpacing="1.2">⊕ CAPITAL PROTECTION · DAY 3</text>
        <text x="1480" y="106" fill="var(--ink-4)" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle" letterSpacing="1.2">IN</text>
      </svg>
    </div>
  );
}

/* ============ APP ============ */
function App() {
  const [gauge, setGauge] = usS(-1);

  return (
    <React.Fragment>
      <TopBarV1/>
      <TodaysSky/>

      <div className="main-grid" style={{display:'grid', gridTemplateColumns:'320px 1fr 320px', gap:16}}>
        <CurrentSky/>
        <div>
          <PingsColumn/>
        </div>
        <div className="outlook-col">
          <SixDayOutlook/>
          <PanchangamSide/>
        </div>
      </div>

      <AmbientGauges expanded={gauge} onExpand={setGauge}/>
      <SectorRotation/>

      <footer style={{marginTop:40, paddingTop:24, borderTop:'1px solid var(--rule-soft)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
        <div className="mono" style={{fontSize:10, letterSpacing:'.18em', color:'var(--ink-4)', textTransform:'uppercase'}}>
          DristiQ β · by Vikuna Technologies · Hyderabad
        </div>
        <div className="mono" style={{fontSize:10, letterSpacing:'.18em', color:'var(--ink-4)', textTransform:'uppercase'}}>
          Data platform only · not investment advice
        </div>
      </footer>
    </React.Fragment>
  );
}

function TopBarV1() {
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 0 20px'}}>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <Logo size={26}/>
        <div style={{lineHeight:1.1}}>
          <div className="serif" style={{fontSize:20, color:'var(--ink-1)', letterSpacing:'-0.01em'}}>Dristi<span style={{color:'var(--gold-1)'}}>Q</span></div>
          <div className="mono" style={{fontSize:9, letterSpacing:'.22em', color:'var(--ink-3)', textTransform:'uppercase'}}>Atmospheric Terminal · v0.8β</div>
        </div>
      </div>
      <div style={{display:'flex', gap:6}}>
        {['Today','Screener','Scrips','Astro Calendar','VaNi'].map((t,i) => (
          <button key={t} className={`btn ${i===0?'active':''}`}>{t}</button>
        ))}
      </div>
      <div style={{display:'flex', alignItems:'center', gap:16}}>
        <div className="mono" style={{fontSize:10, letterSpacing:'.2em', color:'var(--ink-3)', textAlign:'right', lineHeight:1.4}}>
          <div>{DASH.today.date}</div>
          <div style={{color:'var(--gold-2)'}}><span className="pulse-dot" style={{display:'inline-block', width:6, height:6, borderRadius:'50%', background:'var(--gold-1)', marginRight:6, boxShadow:'0 0 8px var(--gold-glow)'}}/>{DASH.today.ist} · NSE OPEN</div>
        </div>
        <button className="btn gold">VaNi · Ask ⌘K</button>
      </div>
    </div>
  );
}

function CollapsedRevealer({ label, note, onOpen }) {
  return (
    <button onClick={onOpen} style={{
      width:'100%', marginTop:16, padding:'16px 22px',
      border:'1px dashed var(--rule)', background:'rgba(10,10,18,0.4)',
      display:'flex', justifyContent:'space-between', alignItems:'center',
      cursor:'pointer', transition:'all .2s ease'
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold-2)'; e.currentTarget.style.background = 'rgba(226,185,111,0.03)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--rule)'; e.currentTarget.style.background = 'rgba(10,10,18,0.4)'; }}>
      <div style={{display:'flex', alignItems:'baseline', gap:14}}>
        <span className="mono" style={{fontSize:11, letterSpacing:'.22em', color:'var(--gold-1)'}}>+ {label}</span>
        <span className="mono" style={{fontSize:10, letterSpacing:'.14em', color:'var(--ink-3)'}}>{note}</span>
      </div>
      <span className="mono" style={{fontSize:10, letterSpacing:'.18em', color:'var(--ink-3)'}}>OPEN ▾</span>
    </button>
  );
}

/* ============ VaNi ONBOARDING TOUR ============ */
function VaNiTour({ step, setStep, onEnd, density, setDensity }) {
  const steps = [
    {
      title: 'Namaste. I am VaNi.',
      body: 'DristiQ is not a buy/sell engine. Think of it as a weather report for markets — I read the atmospheric conditions through Panchāṅgam time-cycles and market data. You decide how to trade.',
      hint: 'Let me walk you through what you\u2019re seeing. 30 seconds.',
      cta: 'Begin →'
    },
    {
      title: 'Today\u2019s Sky.',
      body: 'Every day opens with one verdict — today reads as charged, in a Capital Protection regime (Day 3). My confidence sits at 68/100 because two independent lenses (Panchāṅgam + market technicals) agree.',
      hint: 'When both lenses converge, pay attention.',
      cta: 'Next →'
    },
    {
      title: 'Three zones of context.',
      body: 'The Current Sky rail tracks live planetary transits. Today\u2019s Read surfaces 3 pings — opportunities and heads-ups VaNi has flagged. The Six-day Outlook projects forward from time-cycle patterns.',
      hint: 'Click any ping or outlook day to expand the full reasoning.',
      cta: 'Next →'
    },
    {
      title: 'Density is your choice.',
      body: 'CALM shows just today\u2019s read. STANDARD adds context. TERMINAL is the full cockpit with breadth, momentum, and sector rotation. Change it anytime in the top-right.',
      hint: 'Starting you in Standard. Switch to Terminal when you\u2019re ready.',
      cta: 'Open the dashboard'
    }
  ];
  const s = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:100,
      background:'radial-gradient(800px 500px at 50% 50%, rgba(10,10,18,0.85), rgba(7,7,12,0.96))',
      backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:24,
      animation:'slide-down .35s ease forwards'
    }}>
      <div style={{maxWidth:560, width:'100%', textAlign:'center'}}>
        {/* VaNi orb */}
        <div style={{margin:'0 auto 28px', width:88, height:88, position:'relative'}}>
          <svg viewBox="0 0 88 88" width="88" height="88" style={{animation:'breathe 3.5s ease-in-out infinite'}}>
            <defs>
              <radialGradient id="vaniOrb" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#e2b96f" stopOpacity="0.9"/>
                <stop offset="60%" stopColor="#c9a84c" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#8a6f28" stopOpacity="0"/>
              </radialGradient>
            </defs>
            <circle cx="44" cy="44" r="40" fill="url(#vaniOrb)"/>
            <circle cx="44" cy="44" r="24" fill="none" stroke="#e2b96f" strokeWidth="0.6" opacity="0.6"/>
            <circle cx="44" cy="44" r="14" fill="none" stroke="#e2b96f" strokeWidth="0.4" opacity="0.4"/>
            {[0,60,120,180,240,300].map(d => {
              const a = (d-90)*Math.PI/180;
              return <line key={d} x1={44+20*Math.cos(a)} y1={44+20*Math.sin(a)} x2={44+28*Math.cos(a)} y2={44+28*Math.sin(a)} stroke="#e2b96f" strokeWidth="0.5" opacity="0.7"/>;
            })}
            <circle cx="44" cy="44" r="3" fill="#e2b96f"/>
          </svg>
        </div>

        <div className="mono" style={{fontSize:10, letterSpacing:'.24em', color:'var(--gold-2)', marginBottom:10}}>VaNi AI · STEP {step+1} OF {steps.length}</div>

        <h2 className="serif" style={{fontSize:38, color:'var(--ink-1)', letterSpacing:'-0.02em', margin:'0 0 16px', lineHeight:1.1, fontWeight:500}}>
          {s.title}
        </h2>

        <p style={{margin:'0 0 12px', fontSize:15, color:'var(--ink-2)', lineHeight:1.6, maxWidth:'52ch', marginLeft:'auto', marginRight:'auto'}}>
          {s.body}
        </p>

        <p className="mono" style={{margin:'0 0 28px', fontSize:11, letterSpacing:'.12em', color:'var(--gold-2)', fontStyle:'italic'}}>
          {s.hint}
        </p>

        {/* Step-3 density preview */}
        {step === 3 && (
          <div style={{margin:'0 auto 24px', maxWidth:320, display:'flex', justifyContent:'center'}}>
            <DensityToggle density={density} setDensity={setDensity}/>
          </div>
        )}

        <div style={{display:'flex', justifyContent:'center', gap:10, marginBottom:18}}>
          <button className="btn" onClick={onEnd} style={{fontSize:10}}>Skip</button>
          {step > 0 && <button className="btn" onClick={() => setStep(step-1)} style={{fontSize:10}}>← Back</button>}
          <button className="btn gold" onClick={() => isLast ? onEnd() : setStep(step+1)}>{s.cta}</button>
        </div>

        <div style={{display:'flex', justifyContent:'center', gap:8}}>
          {steps.map((_,i) => (
            <span key={i} style={{
              width:i===step?24:6, height:2, background: i===step?'var(--gold-1)':'var(--rule)',
              transition:'width .3s ease'
            }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

function PanchangamSide() {
  const p = DASH.today.panchangam;
  return (
    <div className="card" style={{marginTop:16}}>
      <div className="card-head">
        <div className="card-title">Panchāṅgam · Today</div>
        <button className="btn ghost" style={{fontSize:10, color:'var(--gold-1)'}}>DETAILS →</button>
      </div>
      <div style={{padding:'14px 20px'}}>
        {[['VARA',p.vara],['TITHI',p.tithi],['NAKSHATRA',p.nakshatra],['YOGA',p.yoga],['KARANA',p.karana]].map(([k,v],i) => (
          <div key={k} style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'7px 0', borderBottom: i<4?'1px solid var(--rule-soft)':'none'}}>
            <span className="mono" style={{fontSize:9.5, letterSpacing:'.18em', color:'var(--ink-4)'}}>{k}</span>
            <span style={{fontSize:12.5, color:'var(--ink-1)'}}>{v}</span>
          </div>
        ))}
        <div style={{marginTop:12, padding:'10px 12px', background:'rgba(10,10,18,0.5)', borderLeft:'2px solid var(--gold-2)'}}>
          <p style={{margin:0, fontSize:11.5, color:'var(--ink-2)', fontStyle:'italic', lineHeight:1.5}}>
            Historically neutral for banking, mildly negative for IT.
          </p>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
