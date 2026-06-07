/* Major page sections for DristiQ */

const { useEffect: useEffS, useState: useStateS, useRef: useRefS } = React;

/* ============ HERO ============ */
function Hero() {
  const [heroMode, setHeroMode] = useStateS(window.__tweaks?.hero || 'merged');
  useEffS(() => {
    const h = e => setHeroMode(e.detail.hero);
    window.addEventListener('tweaks-changed', h);
    return () => window.removeEventListener('tweaks-changed', h);
  }, []);

  return (
    <section id="hero" style={{paddingTop: 160, paddingBottom: 80, minHeight: '100vh', display:'flex', alignItems:'center'}}>
      <div className="wrap" style={{width:'100%'}}>
        {/* instrument marker line at top */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:40, gap:20}}>
          <div className="mono" style={{fontSize:10, letterSpacing:'.24em', textTransform:'uppercase', color:'var(--ink-3)'}}>
            <span style={{color:'var(--gold-2)'}}>◉</span>&nbsp;&nbsp;Śaka 1948 · Vaiśākha · Kṛṣṇa Pakṣa · Trayodaśī
          </div>
          <div className="mono" style={{fontSize:10, letterSpacing:'.24em', textTransform:'uppercase', color:'var(--ink-3)'}}>
            NSE · BSE · BETA — EST. HYD 2026
          </div>
        </div>
        <hr className="hair-soft" style={{marginBottom: 60}}/>

        <div style={{display:'grid', gridTemplateColumns: heroMode==='chart' ? '1fr 1fr' : '1.15fr 1fr', gap: 60, alignItems:'center'}} className="hero-grid">
          <div>
            <FadeUp>
              <div className="section-label"><span className="idx">§ 00</span><span>Prologue</span></div>
            </FadeUp>
            <FadeUp delay={80}>
              <h1 className="display">
                Where Bharat's<br/>
                <span style={{fontStyle:'italic', color:'var(--gold-1)'}}>ancient sky</span><br/>
                meets the<br/>
                <span style={{fontStyle:'italic'}}>modern market.</span>
              </h1>
            </FadeUp>
            <FadeUp delay={180}>
              <p className="lede" style={{marginTop:36, maxWidth:'48ch'}}>
                Panchāṅgam time-cycles and Vedic astronomical rhythms — fused with classical market technicals: RSI, breakouts, volume patterns — reveal the atmospheric conditions ahead. <em style={{color:'var(--gold-1)', fontStyle:'italic'}}>What the ancient sky and modern data agree on, pay attention to.</em>
              </p>
            </FadeUp>
            <FadeUp delay={260}>
              <p className="serif" style={{marginTop: 28, fontSize: 28, fontStyle:'italic', color: 'var(--gold-1)', lineHeight:1.2, letterSpacing:'-0.01em'}}>
                "We read the sky.<br/>You read the market."
              </p>
            </FadeUp>
            <FadeUp delay={340}>
              <div style={{display:'flex', gap:16, marginTop:40, flexWrap:'wrap'}}>
                <a href="#beta" className="btn filled">Explore Beta <span className="arrow">→</span></a>
                <a href="#insight" className="btn">Read the thesis</a>
              </div>
            </FadeUp>
            <FadeUp delay={420}>
              <div className="mono" style={{marginTop:28, fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--ink-3)'}}>
                Built for NSE · BSE · Indian market rhythms
              </div>
            </FadeUp>
          </div>

          {/* Right column — merged mandala + chart + atmospheric card */}
          <div style={{position:'relative', aspectRatio: '1/1', width:'100%', maxWidth: 560, justifySelf: heroMode==='chart'?'start':'end'}}>
            <div style={{position:'absolute', inset:0}}>
              <PanchangamMandala size={560} variant={heroMode}/>
            </div>
            {/* atmospheric reading card — overlays lower-left */}
            <AtmosphericCard/>
            {/* convergence label */}
            <div className="mono" style={{position:'absolute', top: '8%', right: '-8%', fontSize:9, letterSpacing:'.2em', textTransform:'uppercase', color:'var(--gold-2)', textAlign:'left', lineHeight:1.6}}>
              <div>CONVERGENCE ZONE</div>
              <div style={{color:'var(--ink-4)'}}>ancient ⟶ modern</div>
            </div>
            <div className="mono" style={{position:'absolute', bottom: '4%', right: '-2%', fontSize:9, letterSpacing:'.2em', textTransform:'uppercase', color:'var(--ink-4)'}}>
              Fig. I — Kāla Yantra
            </div>
          </div>
        </div>

        {/* disclaimer band — designed as part of narrative */}
        <FadeUp delay={500}>
          <div style={{marginTop:80, padding:'24px 32px', border:'1px solid var(--rule)', background:'rgba(10,10,18,0.4)', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:28, alignItems:'center'}} className="disclaimer-band">
            <div className="mono" style={{fontSize:10, letterSpacing:'.24em', color:'var(--gold-2)'}}>◇ NON-ADVISORY</div>
            <p style={{margin:0, fontSize:13, color:'var(--ink-2)', lineHeight:1.55}}>
              DristiQ is a market data and time-cycle intelligence platform. It does <em style={{color:'var(--gold-1)', fontStyle:'italic'}}>not</em> provide investment advice or buy/sell recommendations. Like a weather report — we show you the conditions. You make the call.
            </p>
            <div className="mono" style={{fontSize:10, letterSpacing:'.24em', color:'var(--ink-4)', textAlign:'right'}}>ref. §§ 1–10</div>
          </div>
        </FadeUp>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .disclaimer-band { grid-template-columns: 1fr !important; gap: 12px !important; }
        }
      `}</style>
    </section>
  );
}

/* Atmospheric card — interactive, driven by tweak */
function AtmosphericCard() {
  const [atmo, setAtmo] = useStateS(window.__tweaks?.atmo || 'charged');
  useEffS(() => {
    const h = e => setAtmo(e.detail.atmo);
    window.addEventListener('tweaks-changed', h);
    return () => window.removeEventListener('tweaks-changed', h);
  }, []);

  const readings = {
    calm: {
      label: 'CALM',
      tithi: 'Pañcamī — Śukla Pakṣa',
      nakshatra: 'Rohiṇī',
      yoga: 'Siddhi',
      score: 32,
      note: 'Low historical volatility cluster. Trending continuations more common.',
      color: '#e2b96f',
    },
    charged: {
      label: 'CHARGED',
      tithi: 'Trayodaśī — Kṛṣṇa Pakṣa',
      nakshatra: 'Jyeṣṭhā',
      yoga: 'Vyāghāta',
      score: 68,
      note: 'Elevated reversal signature on NIFTY historicals. Atmospheric attention high.',
      color: '#f4ecd6',
    },
    volatile: {
      label: 'VOLATILE',
      tithi: 'Amāvāsyā',
      nakshatra: 'Mūla',
      yoga: 'Vajra',
      score: 87,
      note: 'Historical whipsaw cluster across 8Y of NIFTY/BANKNIFTY data.',
      color: '#ff9d4a',
    }
  };
  const r = readings[atmo];

  return (
    <div style={{
      position:'absolute', left:'-10%', bottom:'-6%',
      width: 300,
      background: 'rgba(10,10,18,0.9)',
      border: '1px solid var(--rule)',
      backdropFilter: 'blur(16px)',
      padding: '18px 20px',
      fontSize: 12,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(226,185,111,0.08)',
    }} className="atmo-card">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:12}}>
        <span className="mono" style={{fontSize:9, letterSpacing:'.24em', color:'var(--ink-3)'}}>ATMOSPHERIC READING</span>
        <span className="mono" style={{fontSize:9, letterSpacing:'.14em', color: r.color}}>● LIVE</span>
      </div>
      <div className="serif" style={{fontSize:28, color:'var(--ink-1)', lineHeight:1, marginBottom:4, letterSpacing:'-0.02em'}}>{r.label}</div>
      <div className="mono" style={{fontSize:10, letterSpacing:'.14em', color:'var(--ink-3)', marginBottom:14}}>today · 21 apr 2026 · 09:15 IST</div>
      <hr className="hair-soft" style={{margin:'0 0 14px'}}/>
      <div style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:'6px 14px', fontSize:11.5}}>
        <span className="muted mono" style={{fontSize:9.5, letterSpacing:'.14em'}}>TITHI</span><span style={{color:'var(--ink-1)'}}>{r.tithi}</span>
        <span className="muted mono" style={{fontSize:9.5, letterSpacing:'.14em'}}>NAKṢ.</span><span style={{color:'var(--ink-1)'}}>{r.nakshatra}</span>
        <span className="muted mono" style={{fontSize:9.5, letterSpacing:'.14em'}}>YOGA</span><span style={{color:'var(--ink-1)'}}>{r.yoga}</span>
      </div>
      <hr className="hair-soft" style={{margin:'14px 0'}}/>
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
        <span className="mono" style={{fontSize:9, letterSpacing:'.14em', color:'var(--ink-3)'}}>ATTN</span>
        <div style={{flex:1, height:4, background:'rgba(255,255,255,0.05)', position:'relative'}}>
          <div style={{position:'absolute', left:0, top:0, bottom:0, width: `${r.score}%`, background: `linear-gradient(90deg, var(--gold-3), ${r.color})`, transition:'width .6s ease'}}/>
        </div>
        <span className="mono" style={{fontSize:11, color: r.color}}>{r.score}</span>
      </div>
      <p style={{margin:0, fontSize:11.5, color:'var(--ink-2)', lineHeight:1.5, fontStyle:'italic'}}>
        {r.note}
      </p>
      <div className="mono" style={{marginTop:12, fontSize:9, letterSpacing:'.2em', color:'var(--ink-4)'}}>
        TRY TWEAKS → Atmospheric preview
      </div>
      <style>{`
        @media (max-width: 900px) {
          .atmo-card { position: relative !important; left: auto !important; bottom: auto !important; margin: 24px auto !important; width: 100% !important; max-width: 420px; }
        }
      `}</style>
    </div>
  );
}

/* ============ INSIGHT + WEATHER REPORT (merged) ============ */
function InsightSection() {
  return (
    <section id="insight">
      <SectionHeader
        idx="§ 01"
        label="The Insight"
        title={<>The market moves.<br/><em style={{color:'var(--gold-1)'}}>Time</em> governs the market.</>}
        lede="Ancient Indian astronomers tracked planetary cycles with extraordinary precision — not for prophecy, but because they observed that time has patterns. Markets do too. Time cycles repeat."
      />
      <div className="wrap" style={{marginTop:80}}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:1, background:'var(--rule)', border:'1px solid var(--rule)'}} className="insight-grid">
          {[
            {
              n: '01',
              t: 'Same pattern, different sky.',
              b: 'The same chart pattern behaves differently on an Amāvāsyā versus a Śukla Pakṣa. Modern technicals have no framework for this. Panchāṅgam does.'
            },
            {
              n: '02',
              t: 'A layer no one has built.',
              b: 'No data platform connects Vedic astronomical cycles to live Indian market data — giving serious traders the atmospheric layer they have been missing.'
            },
            {
              n: '03',
              t: 'Conditions, not commands.',
              b: 'A weather forecast does not tell you to carry an umbrella — it gives you probability of rain. Markets need the same: atmospheric awareness, not more buy/sell noise.'
            },
            {
              n: '04',
              t: 'What the price is doing. When conditions are favorable.',
              b: 'Classical technicals tell you WHAT the price is doing. Panchāṅgam tells you WHEN the conditions are favorable. DristiQ is the only platform that shows you both — simultaneously, in Indian market context.'
            }
          ].map((c,i) => (
            <FadeUp key={i} delay={i*80}>
              <div style={{background:'var(--bg-1)', padding:'42px 36px', height:'100%'}}>
                <div className="mono" style={{fontSize:11, letterSpacing:'.22em', color:'var(--gold-2)', marginBottom:22}}>◇ {c.n}</div>
                <h3 className="serif" style={{fontSize:28, color:'var(--ink-1)', margin:'0 0 16px', lineHeight:1.15, letterSpacing:'-0.01em'}}>{c.t}</h3>
                <p style={{margin:0, color:'var(--ink-2)', fontSize:14, lineHeight:1.6}}>{c.b}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>

      {/* Weather report contrast */}
      <div className="wrap" style={{marginTop:120}}>
        <FadeUp>
          <div className="section-label"><span className="idx">§ 01.b</span><span>Not a signal. An atmosphere.</span></div>
        </FadeUp>
        <div style={{display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:40, alignItems:'stretch'}} className="compare-grid">
          <FadeUp>
            <div style={{padding:'40px 36px', border:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.01)', height:'100%'}}>
              <div className="mono" style={{fontSize:11, letterSpacing:'.22em', color:'var(--ink-4)', marginBottom:18}}>✗ WHAT WE ARE NOT</div>
              <ul style={{listStyle:'none', padding:0, margin:0}}>
                {['Buy / Sell recommendations','Target prices','Trading alerts','Investment advice'].map((x,i)=>(
                  <li key={i} style={{padding:'14px 0', borderBottom:i<3?'1px solid rgba(255,255,255,0.04)':'none', color:'var(--ink-3)', fontSize:15, display:'flex', alignItems:'center', gap:14}}>
                    <span style={{color:'#50493c', fontFamily:'monospace', width:16}}>×</span>
                    <span style={{textDecoration:'line-through', textDecorationColor:'rgba(138,131,114,0.4)'}}>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12}} className="compare-divider">
            <div style={{width:1, flex:1, background:'var(--rule)'}}/>
            <div className="mono" style={{fontSize:10, letterSpacing:'.24em', color:'var(--gold-2)', writingMode:'vertical-rl', transform:'rotate(180deg)', padding:'8px 0'}}>· vs ·</div>
            <div style={{width:1, flex:1, background:'var(--rule)'}}/>
          </div>
          <FadeUp delay={120}>
            <div style={{padding:'40px 36px', border:'1px solid var(--rule)', background:'linear-gradient(180deg, rgba(226,185,111,0.04), rgba(226,185,111,0.01))', height:'100%', boxShadow:'inset 0 0 40px rgba(226,185,111,0.03)'}}>
              <div className="mono" style={{fontSize:11, letterSpacing:'.22em', color:'var(--gold-2)', marginBottom:18}}>✓ WHAT WE ARE</div>
              <ul style={{listStyle:'none', padding:0, margin:0}}>
                {[
                  'Atmospheric conditions of the market in time',
                  'Panchāṅgam cycle intelligence mapped to market data',
                  'Historical pattern awareness across time cycles',
                  'A weather report — you decide how to dress'
                ].map((x,i)=>(
                  <li key={i} style={{padding:'14px 0', borderBottom:i<3?'1px solid rgba(226,185,111,0.08)':'none', color:'var(--ink-1)', fontSize:15, display:'flex', alignItems:'center', gap:14}}>
                    <span style={{color:'var(--gold-1)', fontFamily:'monospace', width:16}}>◆</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>
        </div>

        <FadeUp delay={200}>
          <div style={{marginTop:80, padding:'48px 0', borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)', textAlign:'center'}}>
            <div className="mono" style={{fontSize:10, letterSpacing:'.24em', color:'var(--gold-2)', marginBottom:20}}>THE ANALOGY</div>
            <p className="serif" style={{margin:'0 auto', maxWidth:'26ch', fontSize:'clamp(28px, 3.6vw, 44px)', lineHeight:1.18, color:'var(--ink-1)', letterSpacing:'-0.015em'}}>
              The IMD tells you a cyclone is forming.<br/>
              <span style={{color:'var(--ink-3)'}}>It does not tell you whether to travel.</span><br/>
              <em style={{color:'var(--gold-1)'}}>DristiQ gives you the same clarity — for markets.</em>
            </p>
          </div>
        </FadeUp>
      </div>
      <style>{`
        @media (max-width: 820px) {
          .insight-grid { grid-template-columns: 1fr !important; }
          .compare-grid { grid-template-columns: 1fr !important; }
          .compare-divider { flex-direction: row !important; height: auto; padding: 0 !important; }
          .compare-divider > div:first-child, .compare-divider > div:last-child { display: none; }
        }
      `}</style>
    </section>
  );
}

Object.assign(window, { Hero, InsightSection });
