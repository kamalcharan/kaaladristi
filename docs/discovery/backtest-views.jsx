/* Rule Backtest — Views */

const { useState: uS, useMemo: uM, useRef: uR } = React;

/* ============ RULE HEADER ============ */
function RuleHeader({ rule, role, onRun }) {
  return (
    <div className="card" style={{padding:'18px 22px', marginBottom:16}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:20, flexWrap:'wrap'}}>
        <div style={{flex:'1 1 auto', minWidth:300}}>
          <div style={{display:'flex', gap:10, alignItems:'center', marginBottom:6, flexWrap:'wrap'}}>
            <span className="pill gold" style={{fontSize:10}}>{rule.id}</span>
            <span className="pill indigo" style={{fontSize:10}}>{rule.type.toUpperCase()}</span>
            <span className="pill green" style={{fontSize:10}}>● {rule.bias.toUpperCase()}</span>
            <span className="mono" style={{fontSize:9.5, color:'var(--ink-4)', letterSpacing:'.14em'}}>BENCHMARK · {rule.benchmark}</span>
          </div>
          <div className="serif" style={{fontSize:32, color:'var(--ink-1)', letterSpacing:'-0.015em', lineHeight:1.05, marginBottom:4}}>{rule.name}</div>
          <div style={{fontSize:12.5, color:'var(--ink-3)', fontStyle:'italic'}}>{rule.remarks}</div>
        </div>
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          <button className="btn gold" onClick={onRun}>▶ Run Discovery</button>
          {role === 'admin' && <>
            <button className="btn">⚑ Drop Signals</button>
            <button className="btn">⧉ Clone</button>
            <button className="btn">✎ Edit</button>
            <button className="btn danger">🗑 Delete</button>
          </>}
        </div>
      </div>

      {/* Conditions inline */}
      <div style={{display:'flex', gap:10, marginTop:14, paddingTop:14, borderTop:'1px solid var(--rule-soft)', flexWrap:'wrap', alignItems:'center'}}>
        <span className="eyebrow eyebrow-dim">CONDITIONS</span>
        {rule.conditions.map(c => (
          <span key={c.k} style={{display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', border:'1px solid var(--rule-soft)', background:'rgba(255,255,255,0.01)'}}>
            <span className="mono" style={{fontSize:9, letterSpacing:'.14em', color:'var(--ink-4)'}}>{c.k}</span>
            <span style={{fontSize:12, color:'var(--ink-1)'}}>{c.v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============ EQUITY CURVE + SCATTER (hero) ============ */
function EquityHero({ transits, stats, highlight, setHighlight }) {
  const W = 1100, H = 340;
  const PAD = { l:56, r:20, t:16, b:40 };
  const curve = uM(() => BT.buildEquityCurve(transits), [transits]);
  const xs = curve.map(p => new Date(p.date).getTime());
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const allYs = curve.flatMap(p => [p.rule, p.bench]);
  const minY = Math.min(...allYs) * 0.95;
  const maxY = Math.max(...allYs) * 1.05;
  const xFor = t => PAD.l + ((t-minX)/(maxX-minX))*(W-PAD.l-PAD.r);
  const yFor = v => PAD.t + (1-(v-minY)/(maxY-minY))*(H-PAD.t-PAD.b);

  const rulePath = curve.map((p,i) => `${i===0?'M':'L'} ${xFor(new Date(p.date).getTime()).toFixed(1)} ${yFor(p.rule).toFixed(1)}`).join(' ');
  const benchPath = curve.map((p,i) => `${i===0?'M':'L'} ${xFor(new Date(p.date).getTime()).toFixed(1)} ${yFor(p.bench).toFixed(1)}`).join(' ');
  const ruleFill = `M ${PAD.l} ${H-PAD.b} L ${curve.map(p => `${xFor(new Date(p.date).getTime()).toFixed(1)} ${yFor(p.rule).toFixed(1)}`).join(' L ')} L ${xFor(maxX).toFixed(1)} ${H-PAD.b} Z`;

  // Years for axis
  const years = [];
  for (let y = new Date(minX).getFullYear(); y <= new Date(maxX).getFullYear(); y+=2) years.push(y);

  const done = transits.filter(t => t.return !== null);
  const maxRet = Math.max(...done.map(t => Math.abs(t.return)));

  return (
    <div className="card" style={{padding:'18px 22px'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14, flexWrap:'wrap', gap:12}}>
        <div>
          <div className="eyebrow" style={{marginBottom:4}}>BACKTEST · AS OF 2026-04-24 · 17Y WINDOW</div>
          <div className="serif" style={{fontSize:22, color:'var(--ink-1)', letterSpacing:'-0.01em'}}>
            <em style={{color:'var(--gold-1)'}}>+{((curve[curve.length-1].rule-1)*100).toFixed(1)}%</em> compounded vs NIFTY <span style={{color:'var(--indigo-light)'}}>+{((curve[curve.length-1].bench-1)*100).toFixed(1)}%</span> across <span className="num-display">{stats.scored}</span> completed transits.
          </div>
        </div>
        <div className="mono" style={{fontSize:10, color:'var(--ink-3)', letterSpacing:'.14em', display:'flex', gap:16}}>
          <span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:14, height:2, background:'var(--gold-1)'}}/>RULE EQUITY</span>
          <span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:14, height:2, background:'var(--indigo-light)', opacity:.7}}/>NIFTY</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{width:'100%', height:H, display:'block'}}>
        <defs>
          <linearGradient id="ruleGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2b96f" stopOpacity="0.28"/>
            <stop offset="100%" stopColor="#e2b96f" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* gridlines */}
        {[1, 1.5, 2, 2.5, 3, 3.5].filter(v => v>=minY && v<=maxY).map(v => (
          <g key={v}>
            <line x1={PAD.l} y1={yFor(v)} x2={W-PAD.r} y2={yFor(v)} stroke={v===1?'rgba(226,185,111,0.25)':'rgba(255,255,255,0.04)'} strokeWidth={v===1?0.7:0.5} strokeDasharray={v===1?'none':'3 6'}/>
            <text x={PAD.l-8} y={yFor(v)+3} fill="var(--ink-4)" fontFamily="JetBrains Mono" fontSize="9" textAnchor="end" letterSpacing="1">{(v*100-100 >= 0 ? '+':'') + Math.round((v-1)*100) + '%'}</text>
          </g>
        ))}
        {/* year axis */}
        {years.map(y => {
          const x = xFor(new Date(`${y}-01-01`).getTime());
          return (<g key={y}>
            <line x1={x} y1={H-PAD.b} x2={x} y2={H-PAD.b+4} stroke="rgba(255,255,255,0.12)"/>
            <text x={x} y={H-PAD.b+18} fill="var(--ink-4)" fontFamily="JetBrains Mono" fontSize="9.5" textAnchor="middle" letterSpacing="1">{y}</text>
          </g>);
        })}

        {/* Rule area fill */}
        <path d={ruleFill} fill="url(#ruleGrad)"/>
        {/* Benchmark line */}
        <path d={benchPath} fill="none" stroke="#a89dff" strokeWidth="1" strokeDasharray="3 4" opacity="0.75"/>
        {/* Rule line */}
        <path d={rulePath} fill="none" stroke="#e2b96f" strokeWidth="1.8"/>

        {/* Transit dots on the curve — scatter */}
        {curve.slice(1).map((p,i) => {
          const tr = p.tr;
          const x = xFor(new Date(p.date).getTime());
          const y = yFor(p.rule);
          const col = tr.return >= 0 ? '#6ecf9a' : '#d97a6c';
          const r = 3 + (Math.abs(tr.return)/maxRet)*5;
          const isActive = highlight === tr.id;
          const dim = highlight && highlight !== tr.id;
          return (
            <g key={tr.id} style={{cursor:'pointer'}} onClick={() => setHighlight(isActive ? null : tr.id)}>
              {isActive && <circle cx={x} cy={y} r={r+6} fill={col} opacity="0.2"/>}
              <circle cx={x} cy={y} r={r} fill={tr.matched ? col : 'none'} stroke={col} strokeWidth={tr.matched ? 0 : 1.5} opacity={dim ? 0.25 : 1}/>
              {isActive && (
                <g>
                  <line x1={x} y1={PAD.t} x2={x} y2={H-PAD.b} stroke="#e2b96f" strokeWidth="0.6" strokeDasharray="2 3" opacity="0.6"/>
                  <text x={x} y={PAD.t+10} fill="var(--gold-1)" fontFamily="JetBrains Mono" fontSize="10" textAnchor="middle">{tr.start.slice(0,7)} · {tr.return>0?'+':''}{tr.return}%</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <div style={{marginTop:4, paddingTop:10, borderTop:'1px solid var(--rule-soft)', display:'flex', gap:18, alignItems:'center', flexWrap:'wrap'}}>
        <span className="mono" style={{fontSize:9.5, color:'var(--ink-3)', letterSpacing:'.18em'}}>LEGEND</span>
        <span style={{display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--ink-3)'}}><span style={{width:10, height:10, borderRadius:50, background:'#6ecf9a'}}/>Matched · gain</span>
        <span style={{display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--ink-3)'}}><span style={{width:10, height:10, borderRadius:50, background:'#d97a6c'}}/>Matched · loss</span>
        <span style={{display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--ink-3)'}}><span style={{width:10, height:10, borderRadius:50, border:'1.5px solid #d97a6c'}}/>Unmatched (hollow)</span>
        <span style={{fontSize:11, color:'var(--ink-4)', fontStyle:'italic'}}>Dot size ∝ magnitude of return · Click any dot to highlight</span>
      </div>
    </div>
  );
}

/* ============ STAT GRID ============ */
function StatGrid({ stats }) {
  const confidence = (stats.matchRate*100).toFixed(1);
  const confTag = stats.scored < 20 ? 'MODERATE' : stats.scored < 50 ? 'STRONG' : 'VERY STRONG';
  const confColor = stats.matchRate > 0.65 ? 'var(--green)' : stats.matchRate > 0.5 ? 'var(--gold-1)' : 'var(--red)';
  const items = [
    { k:'CONFIDENCE', v:`${confidence}%`, sub:`${confTag} · n=${stats.scored}`, c: confColor, big:true },
    { k:'HISTORICAL', v:`${stats.total}`, sub:`${stats.scored} scored`, c:'var(--ink-1)' },
    { k:'MATCHED', v:`${stats.matchedCount}/${stats.scored}`, sub:`${(stats.matchedCount/stats.scored*100).toFixed(0)}% hit rate`, c:'var(--gold-1)' },
    { k:'AVG RETURN', v:`${stats.avgReturn>0?'+':''}${stats.avgReturn.toFixed(1)}%`, sub:'All transits', c: stats.avgReturn>=0?'var(--green)':'var(--red)' },
    { k:'AVG WHEN MATCHED', v:`+${stats.avgMatched.toFixed(1)}%`, sub:`${stats.matchedCount} transits`, c:'var(--green)' },
    { k:'AVG WHEN NOT', v:`${stats.avgUnmatched.toFixed(1)}%`, sub:`${stats.scored-stats.matchedCount} transits`, c:'var(--red)' },
    { k:'BEST TRANSIT', v:`+${stats.best.return}%`, sub:stats.best.start, c:'var(--green)' },
    { k:'WORST TRANSIT', v:`${stats.worst.return}%`, sub:stats.worst.start, c:'var(--red)' },
    { k:'AVG DURATION', v:`${stats.avgDuration.toFixed(1)}d`, sub:'Window length', c:'var(--ink-1)' },
  ];
  return (
    <div className="card stats-strip" style={{display:'grid', gridTemplateColumns:'1.2fr repeat(4, 1fr)', gap:0, marginTop:16}}>
      {items.slice(0, 5).map((s,i) => (
        <div key={i} style={{padding:'18px 20px', borderRight: i<4 ? '1px solid var(--rule-soft)' : 'none'}}>
          <div className="eyebrow eyebrow-dim" style={{marginBottom:6}}>{s.k}</div>
          <div className="num-display" style={{fontSize: s.big?30:22, color:s.c, lineHeight:1, letterSpacing:'-0.01em'}}>{s.v}</div>
          <div style={{fontSize:10.5, color:'var(--ink-4)', marginTop:5, fontFamily:'JetBrains Mono', letterSpacing:'.08em'}}>{s.sub}</div>
        </div>
      ))}
      {items.slice(5).map((s,i) => (
        <div key={'b'+i} style={{padding:'14px 20px', borderTop:'1px solid var(--rule-soft)', borderRight: i<3 ? '1px solid var(--rule-soft)' : 'none', gridColumn: i===0?'1':'auto'}}>
          <div className="eyebrow eyebrow-dim" style={{marginBottom:4}}>{s.k}</div>
          <div className="num-display" style={{fontSize:17, color:s.c, lineHeight:1}}>{s.v}</div>
          <div style={{fontSize:10, color:'var(--ink-4)', marginTop:3, fontFamily:'JetBrains Mono', letterSpacing:'.08em'}}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ============ REGIME ANALYSIS ============ */
function RegimeAnalysis({ transits }) {
  const regs = BT.regimeStats(transits);
  const maxCount = Math.max(...regs.map(r => r.count));
  const label = { bull:'Bull Regime', side:'Sideways', bear:'Bear Regime' };
  const color = { bull:'var(--green)', side:'var(--gold-1)', bear:'var(--red)' };
  return (
    <div className="card" style={{padding:'16px 20px', marginTop:16}}>
      <div className="card-title" style={{marginBottom:14}}>Performance by Market Regime</div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16}}>
        {regs.map(r => (
          <div key={r.regime} style={{padding:'12px 14px', border:'1px solid var(--rule-soft)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
              <span className="mono" style={{fontSize:10, letterSpacing:'.16em', color: color[r.regime], textTransform:'uppercase'}}>{label[r.regime]}</span>
              <span className="mono" style={{fontSize:10, color:'var(--ink-4)'}}>n={r.count}</span>
            </div>
            <div className="num-display" style={{fontSize:22, color: r.avg>=0?'var(--green)':'var(--red)', marginTop:6, letterSpacing:'-0.01em'}}>{r.avg>0?'+':''}{r.avg.toFixed(1)}%</div>
            <div style={{fontSize:10.5, color:'var(--ink-3)', marginTop:3, fontFamily:'JetBrains Mono'}}>{r.matched}/{r.count} matched · {r.count?((r.matched/r.count)*100).toFixed(0):0}% hit</div>
            <div style={{marginTop:8, height:4, background:'rgba(255,255,255,0.04)', position:'relative'}}>
              <div style={{height:4, width:`${r.count?(r.count/maxCount)*100:0}%`, background: color[r.regime], opacity:.5}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ TABBED DETAIL TABLES ============ */
function DetailTabs({ transits, upcoming, occurrences, nextFires, highlight, setHighlight }) {
  const [tab, setTab] = uS('transits');
  const [page, setPage] = uS(1);
  const perPage = 10;

  const tabs = [
    { k:'transits',    l:`Historical Transits · ${transits.length}` },
    { k:'upcoming',    l:`Upcoming · ${upcoming.length}` },
    { k:'occurrences', l:`Daily Occurrences · ${occurrences.length}` },
    { k:'signals',     l:`Next Firings · ${nextFires.length}` },
  ];

  return (
    <div className="card" style={{marginTop:16}}>
      <div className="card-head" style={{padding:'0 20px'}}>
        <div style={{display:'flex', gap:0}}>
          {tabs.map(t => (
            <button key={t.k} onClick={() => { setTab(t.k); setPage(1); }} style={{
              padding:'14px 16px', fontSize:11, letterSpacing:'.14em', textTransform:'uppercase',
              borderBottom: tab===t.k ? '2px solid var(--gold-1)' : '2px solid transparent',
              color: tab===t.k ? 'var(--gold-1)' : 'var(--ink-3)',
              fontFamily:'JetBrains Mono'
            }}>{t.l}</button>
          ))}
        </div>
        <div style={{display:'flex', gap:6}}>
          <button className="btn ghost" style={{fontSize:10}}>⇩ EXPORT CSV</button>
        </div>
      </div>

      {tab === 'transits' && <TransitsTable transits={transits} highlight={highlight} setHighlight={setHighlight}/>}
      {tab === 'upcoming' && <UpcomingTable upcoming={upcoming}/>}
      {tab === 'occurrences' && <OccurrencesTable occurrences={occurrences} page={page} setPage={setPage} perPage={perPage}/>}
      {tab === 'signals' && <NextFiresTable fires={nextFires}/>}
    </div>
  );
}

function TransitsTable({ transits, highlight, setHighlight }) {
  return (
    <div>
      <div className="mono" style={{display:'grid', gridTemplateColumns:'110px 110px 80px 100px 100px 100px 1fr', gap:10, padding:'10px 20px', fontSize:9.5, letterSpacing:'.16em', color:'var(--ink-4)', textTransform:'uppercase', borderBottom:'1px solid var(--rule-soft)'}}>
        <div>START</div><div>END</div><div>DAYS</div><div>RETURN</div><div>NIFTY</div><div>MATCHED</div><div>NOTE / REGIME</div>
      </div>
      {transits.map(t => {
        const active = highlight === t.id;
        const isLive = t.return === null;
        return (
          <div key={t.id} className="row-hover" onClick={() => setHighlight(active ? null : t.id)} style={{
            display:'grid', gridTemplateColumns:'110px 110px 80px 100px 100px 100px 1fr', gap:10, padding:'11px 20px', alignItems:'center',
            borderBottom:'1px solid var(--rule-soft)', cursor:'pointer',
            background: active ? 'rgba(226,185,111,0.06)' : 'transparent',
            borderLeft: active ? '2px solid var(--gold-1)' : '2px solid transparent'
          }}>
            <span className="num-display" style={{fontSize:12, color:'var(--ink-1)'}}>{t.start}</span>
            <span className="num-display" style={{fontSize:12, color:'var(--ink-2)'}}>{t.end}</span>
            <span className="num-display" style={{fontSize:12, color:'var(--ink-3)'}}>{t.days}</span>
            <span className="num-display" style={{fontSize:13, color: isLive?'var(--gold-1)':(t.return>=0?'var(--green)':'var(--red)')}}>
              {isLive ? '◉ LIVE' : (t.return>0?'+':'') + t.return + '%'}
            </span>
            <span className="num-display" style={{fontSize:11, color:'var(--ink-4)'}}>{isLive?'—':(t.nifty>0?'+':'')+t.nifty+'%'}</span>
            <span className="mono" style={{fontSize:11, color: isLive?'var(--gold-1)':(t.matched ? 'var(--green)' : 'var(--red)'), letterSpacing:'.14em'}}>
              {isLive?'◉':(t.matched ? '✓' : '✕')} {isLive?'ACTIVE':(t.matched?'MATCH':'MISS')}
            </span>
            <span style={{fontSize:11, color:'var(--ink-3)', display:'flex', gap:8, alignItems:'center'}}>
              <span className="pill" style={{fontSize:8.5, padding:'1px 5px'}}>{t.regime.toUpperCase()}</span>
              {t.note && <em style={{color:'var(--ink-2)'}}>{t.note}</em>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function UpcomingTable({ upcoming }) {
  const agingColor = (d) => d < 30 ? 'var(--gold-1)' : d < 180 ? 'var(--ink-2)' : 'var(--ink-4)';
  return (
    <div>
      <div className="mono" style={{display:'grid', gridTemplateColumns:'130px 130px 90px 130px 100px 1fr', gap:10, padding:'10px 20px', fontSize:9.5, letterSpacing:'.16em', color:'var(--ink-4)', textTransform:'uppercase', borderBottom:'1px solid var(--rule-soft)'}}>
        <div>START</div><div>END</div><div>DAYS</div><div>AGING</div><div>STRENGTH</div><div>NOTE</div>
      </div>
      {upcoming.map(u => (
        <div key={u.id} className="row-hover" style={{display:'grid', gridTemplateColumns:'130px 130px 90px 130px 100px 1fr', gap:10, padding:'12px 20px', alignItems:'center', borderBottom:'1px solid var(--rule-soft)'}}>
          <span className="num-display" style={{fontSize:12.5, color:'var(--ink-1)'}}>{u.start}</span>
          <span className="num-display" style={{fontSize:12.5, color:'var(--ink-2)'}}>{u.end}</span>
          <span className="num-display" style={{fontSize:12, color:'var(--ink-3)'}}>{u.days}d</span>
          <span style={{display:'flex', alignItems:'center', gap:8}}>
            <span className="num-display" style={{fontSize:13, color: agingColor(u.inDays)}}>in {u.inDays}d</span>
            <div style={{flex:1, height:3, background:'rgba(255,255,255,0.03)', position:'relative'}}>
              <div style={{height:3, width:`${Math.max(5, 100-Math.min(100, u.inDays/12))}%`, background: agingColor(u.inDays), opacity:.7}}/>
            </div>
          </span>
          <span className="num-display" style={{fontSize:13, color:'var(--gold-1)'}}>{'★'.repeat(u.signalStrength)}</span>
          <span style={{fontSize:11, color:'var(--ink-3)', fontStyle: u.note ? 'italic' : 'normal'}}>{u.note || (u.inDays<7?'Imminent — watch':'Future window')}</span>
        </div>
      ))}
    </div>
  );
}

function OccurrencesTable({ occurrences, page, setPage, perPage }) {
  const total = occurrences.length;
  const pages = Math.ceil(total / perPage);
  const slice = occurrences.slice((page-1)*perPage, page*perPage);
  return (
    <div>
      <div className="mono" style={{display:'grid', gridTemplateColumns:'130px 110px 90px 1fr 100px', gap:10, padding:'10px 20px', fontSize:9.5, letterSpacing:'.16em', color:'var(--ink-4)', textTransform:'uppercase', borderBottom:'1px solid var(--rule-soft)'}}>
        <div>DATE</div><div>SIGNAL</div><div>STRENGTH</div><div>DETAILS</div><div>MATCHED</div>
      </div>
      {slice.map(o => (
        <div key={o.id} className="row-hover" style={{display:'grid', gridTemplateColumns:'130px 110px 90px 1fr 100px', gap:10, padding:'10px 20px', alignItems:'center', borderBottom:'1px solid var(--rule-soft)'}}>
          <span className="num-display" style={{fontSize:12, color:'var(--ink-1)'}}>{o.date}</span>
          <span className="mono" style={{fontSize:11, color:'var(--green)', letterSpacing:'.14em'}}>{o.signal.toUpperCase()}</span>
          <span className="num-display" style={{fontSize:12, color:'var(--gold-1)'}}>{o.strength}</span>
          <span style={{fontSize:11.5, color:'var(--ink-2)'}}>{o.details}</span>
          <span style={{color:'var(--ink-4)'}}>—</span>
        </div>
      ))}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', borderTop:'1px solid var(--rule-soft)'}}>
        <button className="btn ghost" disabled={page<=1} onClick={() => setPage(Math.max(1, page-1))} style={{opacity: page<=1 ? 0.3 : 1}}>‹ Prev</button>
        <span className="mono" style={{fontSize:10.5, color:'var(--ink-3)', letterSpacing:'.14em'}}>Page {page} of {pages} · Showing {(page-1)*perPage+1}–{Math.min(page*perPage, total)} of {total}</span>
        <button className="btn ghost" disabled={page>=pages} onClick={() => setPage(Math.min(pages, page+1))} style={{opacity: page>=pages ? 0.3 : 1}}>Next ›</button>
      </div>
    </div>
  );
}

function NextFiresTable({ fires }) {
  const today = new Date('2026-04-24');
  return (
    <div style={{padding:'16px 20px'}}>
      <div style={{display:'flex', gap:14, flexWrap:'wrap'}}>
        {fires.map((d,i) => {
          const dt = new Date(d);
          const diff = Math.round((dt-today)/(86400000));
          const isNext = i === 0;
          return (
            <div key={d} style={{
              padding:'14px 18px', border: isNext ? '1px solid var(--gold-2)' : '1px solid var(--rule-soft)',
              background: isNext ? 'rgba(226,185,111,0.05)' : 'transparent',
              minWidth:140
            }}>
              <div className="mono" style={{fontSize:9, letterSpacing:'.18em', color: isNext?'var(--gold-1)':'var(--ink-4)'}}>{isNext?'NEXT · in '+diff+'d':'T+'+diff+'d'}</div>
              <div className="num-display" style={{fontSize:18, color:'var(--ink-1)', marginTop:4}}>{d}</div>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:2, letterSpacing:'.1em'}}>{dt.toLocaleDateString('en-US',{weekday:'long'}).toUpperCase()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { RuleHeader, EquityHero, StatGrid, RegimeAnalysis, DetailTabs });
