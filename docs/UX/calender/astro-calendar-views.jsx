/* Astro Calendar — User View: Week-row bias grid + Transit rails + Inspector
   Admin: CRUD table (events + transits) */

const { useState: uS, useMemo: uM, useEffect: uE, useRef: uR } = React;

/* ============ LEGEND ============ */
function BiasLegend() {
  const order = ['bullish','mild-bullish','neutral','volatile','mild-bearish','bearish','closed'];
  return (
    <div style={{display:'flex', gap:18, alignItems:'center', flexWrap:'wrap'}}>
      {order.map(k => {
        const m = AC.BIAS_META[k];
        return (
          <div key={k} style={{display:'flex', alignItems:'center', gap:7}}>
            <span style={{display:'inline-block', width:16, height:10, background:m.fill, border:`1px solid ${m.color}`, opacity:.95}}/>
            <span className="mono" style={{fontSize:9, letterSpacing:'.16em', color:'var(--ink-3)', textTransform:'uppercase'}}>{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ============ DAY CELL (3 segments) ============ */
function DayCell({ day, transits, events, onPick, picked, hoverRef }) {
  const ctx = uM(() => AC.getDayContext(day, transits, events, AC.DAY_BIAS), [day, transits, events]);
  const dow = AC.DOW[(AC.MONTH.firstDow + day - 1) % 7];
  const hasMajor = ctx.activeE.some(e => e.sig === 'major');
  const hasEvent = ctx.activeE.length > 0;
  const isToday = day === 22;

  const onEnter = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    hoverRef.current?.show(day, ctx, { x: r.left + r.width/2, y: r.top });
  };
  const onLeave = () => hoverRef.current?.hide();
  const onClick = () => {
    if (ctx.activeE[0]) onPick({kind:'event', data: ctx.activeE[0]});
    else if (ctx.activeT[0]) onPick({kind:'transit', data: ctx.activeT[0]});
  };

  return (
    <button onClick={onClick} onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{
        position:'relative', padding:'10px 10px 12px', minHeight:96, textAlign:'left',
        background: ctx.isClosed ? 'rgba(255,255,255,0.015)' : isToday ? 'rgba(226,185,111,0.04)' : 'transparent',
        border: isToday ? '1px solid rgba(226,185,111,0.5)' : '1px solid var(--rule-soft)',
        cursor: ctx.isClosed ? 'default' : 'pointer',
        transition:'background .15s ease',
        opacity: ctx.isClosed ? .55 : 1,
      }}
      onMouseOver={e => { if(!ctx.isClosed && !isToday) e.currentTarget.style.background='rgba(255,255,255,0.025)'; }}
      onMouseOut={e => { if(!ctx.isClosed && !isToday) e.currentTarget.style.background='transparent'; }}
    >
      {/* header row */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8}}>
        <div style={{display:'flex', alignItems:'baseline', gap:5}}>
          <span className="num-display" style={{fontSize:16, color: isToday ? 'var(--gold-1)' : 'var(--ink-1)', lineHeight:1}}>{day}</span>
          <span className="mono" style={{fontSize:8.5, letterSpacing:'.16em', color:'var(--ink-4)', textTransform:'uppercase'}}>{dow}</span>
        </div>
        <div style={{display:'flex', gap:4, alignItems:'center'}}>
          {hasMajor && <span style={{color:'var(--gold-1)', fontSize:11, lineHeight:1}}>★</span>}
          {hasEvent && !hasMajor && <span style={{color:'var(--ink-3)', fontSize:8}}>●</span>}
          {isToday && <span className="mono" style={{fontSize:7.5, letterSpacing:'.18em', color:'var(--gold-1)', padding:'1px 4px', border:'1px solid var(--gold-3)'}}>NOW</span>}
        </div>
      </div>

      {/* 3 segments */}
      {ctx.isClosed ? (
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', height:32,
          background:'repeating-linear-gradient(45deg, rgba(46,42,34,0.15) 0 6px, transparent 6px 12px)',
          border:'1px solid var(--rule-soft)'
        }}>
          <span className="mono" style={{fontSize:8.5, letterSpacing:'.22em', color:'var(--ink-4)'}}>CLOSED</span>
        </div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:2, height:32}}>
          {ctx.batches.map((b,i) => {
            const m = AC.BIAS_META[b.bias];
            return (
              <div key={i} style={{
                background: m.fill, position:'relative',
                border: `1px solid ${m.color}`, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <span style={{fontSize:9, color:'rgba(0,0,0,0.5)', fontWeight:700, letterSpacing:'.1em'}}>{m.symbol}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* batch labels */}
      {!ctx.isClosed && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:2, marginTop:3}}>
          {AC.BATCH_SHORT.map((s,i) => (
            <span key={i} className="mono" style={{fontSize:7, letterSpacing:'.1em', color:'var(--ink-4)', textAlign:'center'}}>{s}</span>
          ))}
        </div>
      )}

      {/* event label if any */}
      {hasEvent && (
        <div style={{marginTop:8, fontSize:10, color: hasMajor ? 'var(--gold-1)' : 'var(--ink-3)', lineHeight:1.3, letterSpacing:'-0.005em'}}>
          {ctx.activeE[0].name}{ctx.activeE.length > 1 ? ` +${ctx.activeE.length-1}` : ''}
        </div>
      )}
    </button>
  );
}

/* ============ TOOLTIP ============ */
function useHoverTip() {
  const ref = uR(null);
  const [state, setState] = uS(null);
  ref.current = {
    show: (day, ctx, pos) => setState({ day, ctx, pos }),
    hide: () => setState(null),
  };
  return { ref, state };
}

function HoverTip({ state }) {
  if (!state) return null;
  const { day, ctx, pos } = state;
  const dow = AC.DOW[(AC.MONTH.firstDow + day - 1) % 7];
  // position above the cell; clamp horizontally
  const W = 300;
  const left = Math.max(12, Math.min(window.innerWidth - W - 12, pos.x - W/2));
  const top = Math.max(12, pos.y - 12);
  return (
    <div style={{
      position:'fixed', left, top, width:W, zIndex:100, pointerEvents:'none',
      background:'rgba(7,7,12,0.96)', border:'1px solid var(--gold-3)', padding:14,
      transform:'translateY(-100%)', backdropFilter:'blur(6px)',
      boxShadow:'0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(226,185,111,0.08)'
    }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10, paddingBottom:8, borderBottom:'1px solid var(--rule-soft)'}}>
        <div style={{display:'flex', alignItems:'baseline', gap:6}}>
          <span className="num-display" style={{fontSize:18, color:'var(--ink-1)'}}>{day}</span>
          <span className="mono" style={{fontSize:9, letterSpacing:'.18em', color:'var(--gold-2)', textTransform:'uppercase'}}>{dow} · {AC.MONTH.label}</span>
        </div>
        {ctx.isClosed && <span className="mono" style={{fontSize:8.5, letterSpacing:'.2em', color:'var(--ink-4)'}}>CLOSED</span>}
      </div>

      {!ctx.isClosed && (
        <div style={{marginBottom:12}}>
          <div className="eyebrow eyebrow-dim" style={{marginBottom:6}}>INTRADAY SHAPE</div>
          {ctx.batches.map((b,i) => {
            const m = AC.BIAS_META[b.bias];
            return (
              <div key={i} style={{display:'grid', gridTemplateColumns:'72px 14px 1fr', gap:8, alignItems:'center', padding:'3px 0'}}>
                <span className="mono" style={{fontSize:9.5, letterSpacing:'.1em', color:'var(--ink-3)'}}>{b.label}</span>
                <span style={{width:10, height:10, background:m.fill, border:`1px solid ${m.color}`}}/>
                <span style={{fontSize:11, color:m.color, letterSpacing:'-0.005em'}}>{m.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {ctx.activeE.length > 0 && (
        <div style={{marginBottom:12}}>
          <div className="eyebrow" style={{marginBottom:6, color:'var(--gold-1)'}}>◈ EVENTS · {ctx.activeE.length}</div>
          {ctx.activeE.map(e => (
            <div key={e.id} style={{padding:'3px 0', fontSize:11.5, color:'var(--ink-1)', lineHeight:1.35, display:'flex', gap:8, alignItems:'baseline'}}>
              <span className="pill" style={{fontSize:8, padding:'1px 5px', letterSpacing:'.1em'}}>{e.tag}</span>
              <span>{e.name}</span>
              {e.sig==='major' && <span style={{color:'var(--gold-1)'}}>★</span>}
            </div>
          ))}
        </div>
      )}

      {ctx.activeT.length > 0 && (
        <div>
          <div className="eyebrow eyebrow-dim" style={{marginBottom:6}}>ACTIVE TRANSITS · {ctx.activeT.length}</div>
          {ctx.activeT.map(t => {
            const m = AC.BIAS_META[t.bias];
            return (
              <div key={t.id} style={{padding:'3px 0', fontSize:11, color:'var(--ink-2)', lineHeight:1.3, display:'flex', gap:8, alignItems:'baseline'}}>
                <span style={{width:6, height:6, background:m.color, marginTop:3}}/>
                <span style={{flex:1}}>{t.name}</span>
                <span className="mono" style={{fontSize:8.5, color:'var(--ink-4)', letterSpacing:'.1em'}}>{t.start}–{t.end}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============ MONTH GRID (week-rows × bias cells) ============ */
function MonthGrid({ transits, events, onPick, picked }) {
  const rows = uM(() => AC.buildWeekRows(), []);
  const { ref: hoverRef, state: hoverState } = useHoverTip();

  return (
    <div className="card" style={{padding:'18px 22px 20px'}}>
      <div style={{marginBottom:16}}>
        <div className="eyebrow" style={{marginBottom:4}}>{AC.MONTH.label.toUpperCase()} · INTRADAY BIAS GRID</div>
        <div className="serif" style={{fontSize:22, color:'var(--ink-1)', letterSpacing:'-0.01em', maxWidth:780, marginBottom:14}}>
          Each day is three <em style={{color:'var(--gold-1)'}}>two-hour sessions</em>. Hover a day for the weather behind it.
        </div>
        <div style={{paddingTop:12, borderTop:'1px solid var(--rule-soft)'}}>
          <BiasLegend/>
        </div>
      </div>

      {/* DoW header */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6, marginBottom:4}}>
        {AC.DOW_ORDER.map(d => (
          <div key={d} className="mono" style={{fontSize:9, letterSpacing:'.22em', color:'var(--ink-4)', padding:'4px 10px', textTransform:'uppercase'}}>{d}</div>
        ))}
      </div>

      {/* Week rows */}
      <div style={{display:'flex', flexDirection:'column', gap:6}}>
        {rows.map((row, ri) => (
          <div key={`wk-${ri}`} style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6}}>
            {row.map((day, ci) => day == null
              ? <div key={`empty-${ri}-${ci}`} style={{minHeight:96, border:'1px dashed var(--rule-soft)', opacity:.2}}/>
              : <DayCell key={`day-${day}`} day={day} transits={transits} events={events} onPick={onPick} picked={picked} hoverRef={hoverRef}/>
            )}
          </div>
        ))}
      </div>

      <HoverTip state={hoverState}/>
    </div>
  );
}

/* ============ TRANSIT RAILS ============ */
function TransitRails({ transits, events, onPick, picked, filter, setFilter }) {
  const N = AC.MONTH.days;
  const filtered = transits;

  return (
    <div className="card" style={{marginTop:16}}>
      <div className="card-head">
        <div className="card-title">Active Transits · {filtered.length} rails</div>
        <div style={{display:'flex', gap:14, alignItems:'center'}}>
          <div style={{display:'flex', gap:4}}>
            {[
              {k:'all', l:'ALL'},
              {k:'events', l:'EVENTS'},
              {k:'transits', l:'TRANSITS'},
            ].map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)} className={`btn ${filter===f.k?'active':''}`} style={{fontSize:10, padding:'5px 10px'}}>{f.l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* axis */}
      <div style={{padding:'16px 20px 10px'}}>
        <div style={{display:'grid', gridTemplateColumns:'220px 1fr 82px', gap:14, alignItems:'center', marginBottom:8, paddingBottom:6, borderBottom:'1px solid var(--rule-soft)'}}>
          <span className="mono eyebrow-dim" style={{fontSize:9, letterSpacing:'.18em', color:'var(--ink-4)', textTransform:'uppercase'}}>Transit</span>
          <div style={{position:'relative', height:14}}>
            {[1,5,10,15,20,22,25,30].map(d => {
              const left = ((d-0.5)/N)*100;
              const isToday = d === 22;
              return (
                <span key={d} className="mono" style={{
                  position:'absolute', left:`${left}%`, transform:'translateX(-50%)',
                  fontSize:9, color: isToday ? 'var(--gold-1)' : 'var(--ink-4)', letterSpacing:'.14em', whiteSpace:'nowrap'
                }}>{isToday?`${d} · NOW`:d}</span>
              );
            })}
          </div>
          <span className="mono eyebrow-dim" style={{fontSize:9, letterSpacing:'.18em', color:'var(--ink-4)', textTransform:'uppercase', textAlign:'right'}}>Span</span>
        </div>

        {(filter === 'all' || filter === 'transits') && filtered.map(t => {
          const m = AC.BIAS_META[t.bias];
          const x1 = ((t.start-1)/N)*100;
          const w = ((t.end-t.start+1)/N)*100;
          const active = picked && picked.data && picked.data.id === t.id;
          return (
            <button key={t.id} onClick={() => onPick({kind:'transit', data:t})} style={{
              display:'grid', gridTemplateColumns:'220px 1fr 82px', gap:14, alignItems:'center',
              width:'100%', padding:'9px 0', textAlign:'left', background: active ? 'rgba(226,185,111,0.04)' : 'transparent',
              borderBottom:'1px solid var(--rule-soft)', cursor:'pointer', transition:'background .15s ease'
            }}
            onMouseOver={e => { if(!active) e.currentTarget.style.background='rgba(255,255,255,0.02)'; }}
            onMouseOut={e => { if(!active) e.currentTarget.style.background='transparent'; }}>
              <div>
                <div style={{fontSize:11.5, color:'var(--ink-1)', letterSpacing:'-0.005em', lineHeight:1.3}}>{t.name}</div>
                <div style={{display:'flex', gap:6, marginTop:3, alignItems:'center'}}>
                  <span className="pill" style={{fontSize:8, padding:'1px 5px'}}>{t.tag}</span>
                  <span className="mono" style={{fontSize:9, color:m.color, letterSpacing:'.1em'}}>{m.label.toUpperCase()}</span>
                </div>
              </div>
              <div style={{position:'relative', height:14, background:'rgba(255,255,255,0.02)'}}>
                {/* today line */}
                <div style={{position:'absolute', left:`${((22-0.5)/N)*100}%`, top:-3, bottom:-3, width:1, background:'var(--gold-1)', opacity:.4}}/>
                <div style={{position:'absolute', left:`${x1}%`, width:`${w}%`, top:0, bottom:0, background:m.fill, borderLeft:`2px solid ${m.color}`, borderRight:`2px solid ${m.color}`}}/>
              </div>
              <span className="mono" style={{fontSize:10.5, color:'var(--ink-2)', letterSpacing:'.1em', textAlign:'right'}}>{t.start}–{t.end}</span>
            </button>
          );
        })}

        {/* Events rail */}
        {(filter === 'all' || filter === 'events') && (
          <div style={{
            display:'grid', gridTemplateColumns:'220px 1fr 82px', gap:14, alignItems:'center',
            padding:'12px 0 4px', borderTop: filter==='all' ? '1px solid var(--rule-soft)' : 'none', marginTop: filter==='all'?8:0
          }}>
            <div>
              <div className="eyebrow">DISCRETE EVENTS</div>
              <div style={{fontSize:10.5, color:'var(--ink-3)', marginTop:3}}>Yogas · Tithis · Conjunctions</div>
            </div>
            <div style={{position:'relative', height:24, background:'rgba(255,255,255,0.02)'}}>
              <div style={{position:'absolute', left:`${((22-0.5)/N)*100}%`, top:-3, bottom:-3, width:1, background:'var(--gold-1)', opacity:.4}}/>
              {events.map(e => {
                const left = ((e.day-0.5)/N)*100;
                const isMajor = e.sig === 'major';
                const active = picked && picked.data && picked.data.id === e.id;
                return (
                  <button key={e.id} onClick={() => onPick({kind:'event', data:e})} title={e.name}
                    style={{
                      position:'absolute', left:`${left}%`, top:'50%', transform:'translate(-50%,-50%)',
                      width: isMajor?14:10, height: isMajor?14:10, padding:0,
                      background: isMajor ? 'var(--gold-1)' : 'var(--ink-2)',
                      border: active ? '2px solid #fff' : isMajor ? '1px solid var(--gold-2)' : '1px solid var(--ink-3)',
                      cursor:'pointer', transition:'transform .15s ease'
                    }}
                    onMouseEnter={ev => ev.currentTarget.style.transform='translate(-50%,-50%) scale(1.25)'}
                    onMouseLeave={ev => ev.currentTarget.style.transform='translate(-50%,-50%) scale(1)'}
                  />
                );
              })}
            </div>
            <span className="mono" style={{fontSize:10, color:'var(--ink-4)', letterSpacing:'.1em', textAlign:'right'}}>{events.length} total</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ INSPECTOR ============ */
function Inspector({ picked, onClose }) {
  if (!picked) return (
    <div className="card" style={{padding:'40px 24px', textAlign:'center', color:'var(--ink-4)'}}>
      <div className="serif" style={{fontSize:18, color:'var(--ink-3)', marginBottom:8, fontStyle:'italic'}}>Select a day, event, or transit</div>
      <div style={{fontSize:12}}>Click any day cell, major event ★, or transit rail to see VaNi's read and the technical correlation.</div>
    </div>
  );
  const { kind, data } = picked;
  const isTransit = kind === 'transit';
  const col = isTransit ? AC.BIAS_META[data.bias].color : (data.sig==='major' ? 'var(--gold-1)' : 'var(--ink-2)');
  const headerLabel = isTransit
    ? `Transit · Day ${data.start}–${data.end}`
    : `Event · Day ${data.day} · ${AC.DOW[(AC.MONTH.firstDow + data.day - 1) % 7]}, ${AC.MONTH.label}`;

  return (
    <div className="card drawer-in" key={data.id}>
      <div className="card-head">
        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          <span style={{width:10, height:10, background:col, boxShadow:`0 0 10px ${col}`, display:'inline-block'}}/>
          <div>
            <div className="eyebrow">VaNi's Read</div>
            <div style={{fontSize:15, color:'var(--ink-1)', marginTop:3}}>{data.name}</div>
          </div>
        </div>
        <button onClick={onClose} className="btn ghost" style={{fontSize:11}}>× CLOSE</button>
      </div>
      <div style={{padding:'18px 20px'}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:18}}>
          <div>
            <div className="eyebrow eyebrow-dim" style={{marginBottom:4}}>WHEN</div>
            <div style={{fontSize:13, color:'var(--ink-1)'}}>{headerLabel.split(' · ').slice(1).join(' · ')}</div>
          </div>
          <div>
            <div className="eyebrow eyebrow-dim" style={{marginBottom:4}}>{isTransit?'BIAS':'SIGNIFICANCE'}</div>
            <div style={{fontSize:13, color: col, textTransform: isTransit?'capitalize':'none'}}>
              {isTransit ? AC.BIAS_META[data.bias].label : (data.sig==='major' ? '★ Major' : 'Minor')}
            </div>
          </div>
          <div>
            <div className="eyebrow eyebrow-dim" style={{marginBottom:4}}>CATEGORY</div>
            <div style={{display:'flex', gap:6, alignItems:'center'}}>
              <span className="pill">{data.tag}</span>
              <span className="pill" style={{color: isTransit?'var(--ink-2)':'var(--gold-1)', borderColor: isTransit?'var(--rule)':'var(--gold-3)'}}>{isTransit?'TRANSIT':'EVENT'}</span>
            </div>
          </div>
        </div>

        <div style={{marginBottom:18, padding:'14px 16px', borderLeft:`2px solid ${col}`, background:'rgba(10,10,18,0.5)'}}>
          <div className="eyebrow" style={{color:col, marginBottom:6}}>◈ VANI INTERPRETATION</div>
          <p className="serif" style={{margin:0, fontSize:16, fontStyle:'italic', color:'var(--ink-1)', lineHeight:1.45, letterSpacing:'-0.005em'}}>
            {data.note}
          </p>
        </div>

        {/* Technical correlation / historical analogue stats (categorical, not scored) */}
        <div className="eyebrow" style={{marginBottom:10}}>HISTORICAL ANALOGUES · 8Y BASE</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:14, marginBottom:14}}>
          {[
            {k:'SAMPLES', v:'n = 24'},
            {k:'TREND BIAS', v: isTransit ? AC.BIAS_META[data.bias].label : (data.sig==='major'?'Strongly positive':'Positive lean'), c:col},
            {k:'HIT RATE', v: isTransit ? (data.bias.includes('bear')?'58%':'69%') : (data.sig==='major'?'75%':'64%')},
            {k:'REALIZED VOL', v: isTransit?'1.1× avg' : data.sig==='major'?'2.1× avg':'1.3× avg'},
          ].map((s,i) => (
            <div key={i}>
              <div className="mono" style={{fontSize:9, color:'var(--ink-4)', letterSpacing:'.14em'}}>{s.k}</div>
              <div style={{fontSize:13.5, color: s.c || 'var(--ink-1)', marginTop:3, letterSpacing:'-0.005em'}}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{display:'flex', gap:8, paddingTop:12, borderTop:'1px solid var(--rule-soft)'}}>
          <button className="btn gold" style={{flex:1, justifyContent:'center'}}>Ask VaNi about this →</button>
          <button className="btn" style={{flex:1, justifyContent:'center'}}>Open in Dashboard</button>
        </div>
      </div>
    </div>
  );
}

/* ============ ADMIN ============ */
function AdminTable({ events, setEvents, transits, setTransits }) {
  const [editing, setEditing] = uS(null);
  const [tab, setTab] = uS('events'); // 'events' | 'transits'
  const [q, setQ] = uS('');

  const list = tab === 'events' ? events : transits;
  const filtered = list.filter(x => !q || x.name.toLowerCase().includes(q.toLowerCase()) || x.tag.toLowerCase().includes(q.toLowerCase()));

  const save = (obj) => {
    const setter = tab==='events' ? setEvents : setTransits;
    const src = tab==='events' ? events : transits;
    if (editing === 'new') setter([...src, { ...obj, id: tab[0] + Date.now() }]);
    else setter(src.map(x => x.id===obj.id ? obj : x));
    setEditing(null);
  };
  const del = (id) => {
    if (!confirm('Delete this item?')) return;
    const setter = tab==='events' ? setEvents : setTransits;
    const src = tab==='events' ? events : transits;
    setter(src.filter(x => x.id !== id));
    setEditing(null);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div style={{display:'flex', gap:4, alignItems:'center'}}>
          <div className="card-title" style={{marginRight:16}}>Registry · Admin</div>
          <div style={{display:'inline-flex', border:'1px solid var(--rule)', padding:2}}>
            {[
              {k:'events', l:`EVENTS · ${events.length}`},
              {k:'transits', l:`TRANSITS · ${transits.length}`}
            ].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} className="mono" style={{
                padding:'5px 12px', fontSize:9.5, letterSpacing:'.16em', textTransform:'uppercase',
                background: tab===t.k ? 'rgba(226,185,111,0.12)' : 'transparent',
                color: tab===t.k ? 'var(--gold-1)' : 'var(--ink-3)'
              }}>{t.l}</button>
            ))}
          </div>
        </div>
        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          <input className="fld" placeholder="Filter…" value={q} onChange={e=>setQ(e.target.value)} style={{width:200, padding:'6px 10px', fontSize:12}}/>
          <button className="btn gold" onClick={() => setEditing('new')}>+ NEW {tab==='events'?'EVENT':'TRANSIT'}</button>
        </div>
      </div>

      <div>
        <div className="crud-row mono" style={{
          display:'grid',
          gridTemplateColumns: tab==='events' ? '90px 1fr 80px 80px 90px 90px' : '90px 1fr 100px 130px 90px',
          gap:12, padding:'10px 20px', fontSize:9.5, letterSpacing:'.16em', color:'var(--ink-4)', textTransform:'uppercase',
          borderBottom:'1px solid var(--rule-soft)'
        }}>
          <div>TAG</div><div>NAME</div>
          {tab==='events' ? (<><div>DAY</div><div>SIG</div><div>NOTE LEN</div><div style={{textAlign:'right'}}>ACTIONS</div></>)
                         : (<><div>SPAN</div><div>BIAS</div><div style={{textAlign:'right'}}>ACTIONS</div></>)}
        </div>
        {filtered.map(x => (
          <div key={x.id} className="crud-row" style={{
            display:'grid',
            gridTemplateColumns: tab==='events' ? '90px 1fr 80px 80px 90px 90px' : '90px 1fr 100px 130px 90px',
            gap:12, padding:'12px 20px', alignItems:'center',
            borderBottom:'1px solid var(--rule-soft)'
          }}>
            <span className="mono" style={{fontSize:10, color:'var(--ink-2)', letterSpacing:'.12em'}}>{x.tag}</span>
            <span style={{fontSize:12.5, color:'var(--ink-1)'}}>{x.name}</span>
            {tab==='events' ? (
              <>
                <span className="num-display" style={{fontSize:13, color:'var(--ink-1)'}}>{x.day}</span>
                <span className="mono" style={{fontSize:10, color: x.sig==='major'?'var(--gold-1)':'var(--ink-4)', letterSpacing:'.14em'}}>{x.sig==='major'?'★ MAJOR':'MINOR'}</span>
                <span className="mono" style={{fontSize:10, color:'var(--ink-4)'}}>{x.note.length}ch</span>
              </>
            ) : (
              <>
                <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{x.start}→{x.end}</span>
                <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
                  <span style={{width:10, height:10, background:AC.BIAS_META[x.bias].fill, border:`1px solid ${AC.BIAS_META[x.bias].color}`}}/>
                  <span className="mono" style={{fontSize:10, color:AC.BIAS_META[x.bias].color, letterSpacing:'.1em'}}>{AC.BIAS_META[x.bias].label.toUpperCase()}</span>
                </span>
              </>
            )}
            <div style={{display:'flex', gap:4, justifyContent:'flex-end'}}>
              <button className="btn ghost" onClick={() => setEditing(x)} style={{fontSize:10, padding:'4px 8px'}}>EDIT</button>
              <button className="btn ghost danger" onClick={() => del(x.id)} style={{fontSize:10, padding:'4px 8px'}}>DEL</button>
            </div>
          </div>
        ))}
      </div>
      {editing && <ItemModal item={editing==='new'?null:editing} kind={tab} onSave={save} onCancel={() => setEditing(null)}/>}
    </div>
  );
}

function ItemModal({ item, kind, onSave, onCancel }) {
  const defaultItem = kind==='events'
    ? { name:'', tag:'YOG', day:1, sig:'minor', note:'' }
    : { name:'', tag:'SIGN', start:1, end:30, bias:'neutral', note:'' };
  const [f, setF] = uS(item || defaultItem);
  const set = (k,v) => setF({...f, [k]:v});

  const save = () => {
    if (!f.name.trim()) return alert('Name required');
    onSave(f);
  };

  return (
    <div style={{position:'fixed', inset:0, zIndex:200, background:'rgba(7,7,12,0.85)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, animation:'backdrop-in .2s ease forwards'}} onClick={onCancel}>
      <div className="card drawer-in" style={{maxWidth:560, width:'100%', background:'var(--bg-1)'}} onClick={e => e.stopPropagation()}>
        <div className="card-head">
          <div className="card-title">{item?'Edit':'New'} {kind==='events'?'Event':'Transit'}</div>
          <button onClick={onCancel} className="btn ghost">× CLOSE</button>
        </div>
        <div style={{padding:'20px 22px', display:'grid', gap:14}}>
          <div>
            <label className="flbl">NAME</label>
            <input className="fld" value={f.name} onChange={e => set('name', e.target.value)} placeholder={kind==='events'?'e.g. Neptune Conjunction Mercury':'e.g. Mars in Kṛttikā'}/>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
            <div>
              <label className="flbl">TAG</label>
              <select className="fld" value={f.tag} onChange={e => set('tag', e.target.value)}>
                {(kind==='events'
                  ? ['YOG','TITHI','KARAN','CONJ','NAKSH']
                  : ['SIGN','INGRESS','VEDH','RETRO']
                ).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {kind==='events' ? (
              <div>
                <label className="flbl">SIGNIFICANCE</label>
                <select className="fld" value={f.sig} onChange={e => set('sig', e.target.value)}>
                  <option value="minor">Minor</option>
                  <option value="major">Major ★</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="flbl">BIAS</label>
                <select className="fld" value={f.bias} onChange={e => set('bias', e.target.value)}>
                  {Object.entries(AC.BIAS_META).filter(([k]) => k!=='closed').map(([k,m]) => <option key={k} value={k}>{m.label}</option>)}
                </select>
              </div>
            )}
          </div>
          {kind==='events' ? (
            <div>
              <label className="flbl">DAY OF MONTH</label>
              <input type="number" min="1" max="30" className="fld" value={f.day} onChange={e => set('day', +e.target.value)}/>
            </div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
              <div>
                <label className="flbl">START DAY</label>
                <input type="number" min="1" max="30" className="fld" value={f.start} onChange={e => set('start', +e.target.value)}/>
              </div>
              <div>
                <label className="flbl">END DAY</label>
                <input type="number" min="1" max="30" className="fld" value={f.end} onChange={e => set('end', +e.target.value)}/>
              </div>
            </div>
          )}
          <div>
            <label className="flbl">VANI NOTE</label>
            <textarea className="fld" rows="3" value={f.note} onChange={e => set('note', e.target.value)} placeholder="One-line interpretation shown to users"/>
          </div>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid var(--rule-soft)'}}>
            <button className="btn" onClick={onCancel}>Cancel</button>
            <button className="btn gold" onClick={save}>{item?'Save Changes':'Create'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MonthGrid, TransitRails, Inspector, AdminTable, BiasLegend });
