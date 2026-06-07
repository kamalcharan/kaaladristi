/* Remaining sections: Pillars, VaNi, Personas, Origin, Beta CTA, Footer */

const { useState: useStateS2, useEffect: useEffS2 } = React;

/* ============ INTELLIGENCE PILLARS ============ */
function Pillars() {
  const items = [
    {
      n: '02.A',
      glyph: <PillarGlyph type="moon"/>,
      title: 'Panchāṅgam Atmosphere Engine',
      body: 'Daily Tithi, Nakṣatra, Yoga, Karaṇa and Vāra — mapped to historical market behavior patterns on Indian indices. Know the atmospheric character of every trading day.',
      meta: '5 time-cycle axes · NIFTY · BANKNIFTY · SENSEX',
    },
    {
      n: '02.B',
      glyph: <PillarGlyph type="chart"/>,
      title: 'Astro-Technical Confluence',
      body: 'When Vedic time signals and classical technical setups — breakouts, momentum, volume surges — align on the same day, that is your window of heightened atmospheric attention. Two independent systems. One convergence point.',
      meta: '14 classical patterns · 27 Nakṣatra states',
    },
    {
      n: '02.C',
      glyph: <PillarGlyph type="calendar"/>,
      title: 'Astro Calendar — 2026 and beyond',
      body: 'Key astronomical events pre-mapped to the market calendar — know the high-attention windows months in advance. Time cycles repeat. Be prepared.',
      meta: 'Forward-mapped through 2030',
    },
    {
      n: '02.D',
      glyph: <PillarGlyph type="shield"/>,
      title: 'Code Tagging Intelligence',
      body: 'Automated pattern detection on BSE/NSE scrips — surfaced contextually as risk-awareness badges. Trade with full atmospheric awareness.',
      meta: '4,200+ scrips · continuous tagging',
    }
  ];
  return (
    <section id="layer" style={{borderTop:'1px solid var(--rule-soft)', borderBottom:'1px solid var(--rule-soft)'}}>
      <SectionHeader
        idx="§ 02"
        label="The Layer"
        title={<>A new layer of<br/><em style={{color:'var(--gold-1)'}}>market atmosphere.</em></>}
        lede="Two independent engines — Panchāṅgam cycle intelligence and classical market technicals — surfaced through four instruments. Indexed to live NSE/BSE data. Together they form the atmospheric layer."
      />
      <div className="wrap" style={{marginTop:72}}>
        {/* Two Lenses — signature row */}
        <FadeUp>
          <div style={{border:'1px solid var(--rule)', background:'linear-gradient(180deg, rgba(226,185,111,0.04), rgba(10,10,18,0.3))', padding:'48px 44px', marginBottom: 1, display:'grid', gridTemplateColumns:'auto 1fr auto', gap:48, alignItems:'center'}} className="two-lenses">
            <div style={{display:'flex', alignItems:'center', gap:28}}>
              <LensGlyph type="ancient"/>
              <div className="mono" style={{fontSize:22, color:'var(--gold-1)', letterSpacing:'.08em'}}>⊕</div>
              <LensGlyph type="modern"/>
            </div>
            <div>
              <div className="mono" style={{fontSize:10, letterSpacing:'.24em', color:'var(--gold-2)', marginBottom:12}}>◇ 02.0 — FOUNDATIONAL</div>
              <h3 className="serif" style={{fontSize:30, color:'var(--ink-1)', margin:'0 0 14px', lineHeight:1.15, letterSpacing:'-0.01em'}}>Two independent lenses. <em style={{color:'var(--gold-1)'}}>One convergence.</em></h3>
              <p style={{margin:0, color:'var(--ink-2)', fontSize:14.5, lineHeight:1.6, maxWidth:'70ch'}}>
                DristiQ runs two parallel engines — a Panchāṅgam time-cycle engine drawing from Vedic astronomy, and a technical market data engine tracking price action, volume, and momentum on NSE/BSE. Neither tells you what to do. <em style={{color:'var(--gold-1)', fontStyle:'italic'}}>When both point in the same direction — that is atmospheric data worth paying attention to.</em>
              </p>
            </div>
            <div className="mono" style={{fontSize:10, letterSpacing:'.22em', color:'var(--ink-4)', textAlign:'right', lineHeight:1.8}}>
              LENS I · PANCHĀṄGAM<br/>
              LENS II · TECHNICAL<br/>
              <span style={{color:'var(--gold-2)'}}>⟶ CONVERGENCE</span>
            </div>
          </div>
        </FadeUp>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 1, background:'var(--rule)', border:'1px solid var(--rule)', borderTop:'none'}} className="pillar-grid">
          {items.map((it, i) => (
            <FadeUp key={i} delay={i*60}>
              <div className="pillar-card" style={{background:'var(--bg-1)', padding:'44px 40px', height:'100%', position:'relative', transition:'background .3s ease'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28}}>
                  <div style={{width:64, height:64}}>{it.glyph}</div>
                  <div className="mono" style={{fontSize:10, letterSpacing:'.24em', color:'var(--ink-4)'}}>§ {it.n}</div>
                </div>
                <h3 className="serif" style={{fontSize:30, color:'var(--ink-1)', margin:'0 0 18px', lineHeight:1.12, letterSpacing:'-0.01em', maxWidth:'18ch'}}>{it.title}</h3>
                <p style={{margin:'0 0 24px', color:'var(--ink-2)', fontSize:14.5, lineHeight:1.6, maxWidth:'42ch'}}>{it.body}</p>
                <hr className="hair-soft" style={{margin:'0 0 16px'}}/>
                <div className="mono" style={{fontSize:10, letterSpacing:'.18em', color:'var(--gold-2)'}}>{it.meta}</div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
      <style>{`
        .pillar-card:hover { background: linear-gradient(180deg, var(--bg-2), var(--bg-1)) !important; }
        @media (max-width: 900px) {
          .two-lenses { grid-template-columns: 1fr !important; gap: 24px !important; padding: 32px 28px !important; text-align: left; }
        }
        @media (max-width: 820px) {
          .pillar-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function LensGlyph({ type }) {
  const stroke = '#e2b96f', dim = '#8a6f28';
  if (type === 'ancient') return (
    <svg viewBox="0 0 64 64" width="56" height="56">
      <circle cx="32" cy="32" r="24" fill="none" stroke={stroke} strokeWidth="0.7"/>
      <circle cx="32" cy="32" r="18" fill="none" stroke={dim} strokeWidth="0.5"/>
      <circle cx="32" cy="32" r="12" fill="none" stroke={stroke} strokeWidth="0.5" opacity="0.6"/>
      {[0,45,90,135,180,225,270,315].map(d=>{
        const a=(d-90)*Math.PI/180;
        return <line key={d} x1={32+18*Math.cos(a)} y1={32+18*Math.sin(a)} x2={32+24*Math.cos(a)} y2={32+24*Math.sin(a)} stroke={stroke} strokeWidth="0.6"/>;
      })}
      <circle cx="32" cy="32" r="2" fill={stroke}/>
      <text x="32" y="58" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="6" fill={dim} letterSpacing="1.5">LENS I</text>
    </svg>
  );
  return (
    <svg viewBox="0 0 64 64" width="56" height="56">
      <rect x="10" y="12" width="44" height="32" fill="none" stroke={stroke} strokeWidth="0.7"/>
      <line x1="10" y1="36" x2="54" y2="36" stroke={dim} strokeWidth="0.4"/>
      {[14,20,26,32,38,44,50].map((x,i)=>{
        const h=[8,14,6,18,10,16,22][i];
        const up=i%2===1;
        return <g key={i}>
          <line x1={x} y1={36-h-2} x2={x} y2={36-h+h+2} stroke={stroke} strokeWidth="0.5"/>
          <rect x={x-1.6} y={36-h} width="3.2" height={h} fill={up?stroke:'transparent'} stroke={stroke} strokeWidth="0.5"/>
        </g>;
      })}
      <path d="M 12 32 L 18 28 L 24 30 L 30 22 L 36 26 L 42 18 L 50 20" fill="none" stroke={stroke} strokeWidth="0.6" opacity="0.6"/>
      <text x="32" y="58" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="6" fill={dim} letterSpacing="1.5">LENS II</text>
    </svg>
  );
}

function PillarGlyph({ type }) {
  const stroke = '#e2b96f', dim = '#8a6f28';
  if (type === 'moon') return (
    <svg viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="26" fill="none" stroke={dim} strokeWidth="0.6" strokeDasharray="1 3"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke={stroke} strokeWidth="0.8"/>
      <path d="M 24 22 A 14 14 0 1 0 24 42 A 10 12 0 1 1 24 22 Z" fill={stroke} opacity="0.7"/>
      {[0,45,90,135,180,225,270,315].map(d=>{
        const a=(d-90)*Math.PI/180;
        return <line key={d} x1={32+24*Math.cos(a)} y1={32+24*Math.sin(a)} x2={32+28*Math.cos(a)} y2={32+28*Math.sin(a)} stroke={stroke} strokeWidth="0.6"/>;
      })}
    </svg>
  );
  if (type === 'chart') return (
    <svg viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="26" fill="none" stroke={dim} strokeWidth="0.6" strokeDasharray="1 3"/>
      <line x1="12" y1="40" x2="52" y2="40" stroke={dim} strokeWidth="0.5"/>
      {[18,26,34,42].map((x,i)=>{
        const h = [14,22,10,18][i];
        const up = i%2===0;
        return <g key={i}>
          <line x1={x} y1={40-h-3} x2={x} y2={40-h+h+3} stroke={stroke} strokeWidth="0.6"/>
          <rect x={x-2.5} y={40-h} width="5" height={h} fill={up?stroke:'transparent'} stroke={stroke} strokeWidth="0.6"/>
        </g>;
      })}
      <path d="M 14 36 L 20 30 L 28 32 L 36 24 L 44 20 L 50 22" fill="none" stroke={stroke} strokeWidth="0.8" opacity="0.7"/>
    </svg>
  );
  if (type === 'calendar') return (
    <svg viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="26" fill="none" stroke={dim} strokeWidth="0.6" strokeDasharray="1 3"/>
      <rect x="14" y="16" width="36" height="32" fill="none" stroke={stroke} strokeWidth="0.8"/>
      <line x1="14" y1="24" x2="50" y2="24" stroke={stroke} strokeWidth="0.6"/>
      <line x1="22" y1="16" x2="22" y2="12" stroke={stroke} strokeWidth="0.8"/>
      <line x1="42" y1="16" x2="42" y2="12" stroke={stroke} strokeWidth="0.8"/>
      {[0,1,2,3].map(r=>[0,1,2,3,4].map(c=>(
        <circle key={r+'-'+c} cx={18+c*7} cy={30+r*5} r={(r===1&&c===2)||(r===2&&c===4)?1.6:0.8} fill={(r===1&&c===2)||(r===2&&c===4)?stroke:dim}/>
      )))}
    </svg>
  );
  if (type === 'shield') return (
    <svg viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="26" fill="none" stroke={dim} strokeWidth="0.6" strokeDasharray="1 3"/>
      <path d="M 32 14 L 48 20 L 48 34 Q 48 46 32 52 Q 16 46 16 34 L 16 20 Z" fill="none" stroke={stroke} strokeWidth="0.8"/>
      <path d="M 32 22 L 40 26 L 40 34 Q 40 42 32 46 Q 24 42 24 34 L 24 26 Z" fill="none" stroke={stroke} strokeWidth="0.5" opacity="0.6"/>
      <text x="32" y="36" textAnchor="middle" fontFamily="Cormorant Garamond" fontStyle="italic" fontSize="14" fill={stroke}>ॐ</text>
    </svg>
  );
  return null;
}

/* ============ VaNi AI ============ */
function VaNiSection() {
  return (
    <section id="vani">
      <div className="wrap">
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center'}} className="vani-grid">
          <FadeUp>
            <div style={{position:'relative', aspectRatio:'1/1', maxWidth: 420, margin:'0 auto'}}>
              <Yantra size={420}/>
              <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none'}}>
                <div className="serif" style={{fontSize:32, fontStyle:'italic', color:'var(--ink-1)', letterSpacing:'-0.01em', textShadow:'0 0 30px rgba(226,185,111,0.6)'}}>VaNi</div>
              </div>
              <div className="mono" style={{position:'absolute', bottom:-8, left:0, right:0, textAlign:'center', fontSize:9, letterSpacing:'.3em', color:'var(--gold-2)'}}>PROPRIETARY · VIKUNA</div>
            </div>
          </FadeUp>
          <div>
            <FadeUp>
              <div className="section-label"><span className="idx">§ 03</span><span>The Interpreter</span></div>
            </FadeUp>
            <FadeUp delay={80}>
              <h2 className="display" style={{marginBottom:20}}>Powered by <em style={{color:'var(--gold-1)'}}>VaNi AI</em>.</h2>
            </FadeUp>
            <FadeUp delay={160}>
              <p className="lede" style={{marginBottom:36}}>
                Vikuna's proprietary AI engine — built for Indian market context. VaNi does not issue signals. It interprets atmospheric data, in your language, at your pace.
              </p>
            </FadeUp>
            <div>
              {[
                { n:'i.', t:'Interprets Panchāṅgam cycles in natural language.', b:'Ask VaNi what today\u2019s atmospheric conditions mean for the market — in English, Hindi, or Sanskrit-adjacent terminology.' },
                { n:'ii.', t:'Conversational data explainability.', b:'Not just what the time-cycle shows, but the historical context behind it — across decades of indexed Indian market data.' },
                { n:'iii.', t:'Runs on Vikuna infrastructure.', b:'Your queries and conversation history stay within the platform. No third-party LLM pipelines. No model leakage.' }
              ].map((it,i) => (
                <FadeUp key={i} delay={200+i*80}>
                  <div style={{padding:'22px 0', borderBottom: i<2?'1px solid var(--rule-soft)':'none', display:'grid', gridTemplateColumns:'auto 1fr', gap:24}}>
                    <div className="mono" style={{fontSize:11, letterSpacing:'.18em', color:'var(--gold-2)', paddingTop:2}}>{it.n}</div>
                    <div>
                      <div className="serif" style={{fontSize:20, color:'var(--ink-1)', marginBottom:6, letterSpacing:'-0.01em'}}>{it.t}</div>
                      <div style={{fontSize:14, color:'var(--ink-3)', lineHeight:1.6}}>{it.b}</div>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
            <FadeUp delay={500}>
              <div style={{marginTop:32, display:'inline-flex', alignItems:'center', gap:12, padding:'10px 18px', border:'1px solid var(--gold-3)', background:'rgba(226,185,111,0.05)'}}>
                <span style={{width:6, height:6, borderRadius:'50%', background:'var(--gold-1)', boxShadow:'0 0 12px var(--gold-glow)', animation:'breathe 2.5s ease-in-out infinite'}}/>
                <span className="mono" style={{fontSize:10, letterSpacing:'.22em', color:'var(--gold-1)', textTransform:'uppercase'}}>VaNi AI · by Vikuna</span>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>

      {/* Mock conversation snippet */}
      <div className="wrap" style={{marginTop:100}}>
        <FadeUp>
          <div style={{border:'1px solid var(--rule)', background:'rgba(10,10,18,0.5)', padding:'32px 36px', maxWidth:780, margin:'0 auto'}}>
            <div className="mono" style={{fontSize:10, letterSpacing:'.22em', color:'var(--ink-4)', marginBottom:20}}>◇ TRANSCRIPT — VaNi · 21 APR 2026 · 09:42 IST</div>
            <div style={{display:'flex', gap:20, marginBottom:18}}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', letterSpacing:'.14em', paddingTop:3, minWidth:36}}>YOU</div>
              <div style={{color:'var(--ink-2)', fontSize:15, lineHeight:1.55}}>What is today's atmospheric reading for NIFTY?</div>
            </div>
            <div style={{display:'flex', gap:20}}>
              <div className="mono" style={{fontSize:10, color:'var(--gold-1)', letterSpacing:'.14em', paddingTop:3, minWidth:36}}>VaNi</div>
              <div style={{color:'var(--ink-1)', fontSize:15, lineHeight:1.6}}>
                Today reads as <em style={{color:'var(--gold-1)', fontStyle:'italic'}}>charged</em>. Jyeṣṭhā Nakṣatra with Kṛṣṇa Pakṣa Trayodaśī historically clusters with elevated reversal signatures on NIFTY — 68th percentile attention. This is not a signal to act. It is a condition to observe.
                <span style={{display:'block', marginTop:10, color:'var(--ink-3)', fontSize:13, fontStyle:'italic'}}>Would you like the last 8 years of analogous days?</span>
              </div>
            </div>
          </div>
        </FadeUp>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .vani-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
        }
      `}</style>
    </section>
  );
}

/* ============ PERSONAS ============ */
function Personas() {
  const p = [
    {
      n: 'i.',
      title: 'The Technical Trader',
      body: 'You already use RSI, MACD, breakouts, volume analysis. You are good at reading price. Now add the one layer no charting platform carries — the atmospheric time context. Understand why the same setup fires cleanly on some days and fails on others.',
      tags: ['RSI','MACD','breakouts','volume','+ atmosphere']
    },
    {
      n: 'ii.',
      title: 'The Astro-Aware Investor',
      body: 'You follow Panchāṅgam in life. Now see it mapped to market data with historical pattern backing — not belief, but observation.',
      tags: ['Panchāṅgam','history','observation']
    },
    {
      n: 'iii.',
      title: 'The Risk-First Trader',
      body: 'You do not chase price. You wait for the right conditions. DristiQ shows you the atmospheric picture — you decide when to move.',
      tags: ['patience','conditions','agency']
    }
  ];
  return (
    <section id="personas" style={{borderTop:'1px solid var(--rule-soft)'}}>
      <SectionHeader
        idx="§ 04"
        label="The Reader"
        title={<>Built for the<br/><em style={{color:'var(--gold-1)'}}>serious Indian trader.</em></>}
      />
      <div className="wrap" style={{marginTop:64}}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:24}} className="persona-grid">
          {p.map((x,i) => (
            <FadeUp key={i} delay={i*80}>
              <div className="glass" style={{padding:'36px 32px', height:'100%', transition:'all .3s ease'}}>
                <div className="mono" style={{fontSize:11, letterSpacing:'.22em', color:'var(--gold-2)', marginBottom:28}}>{x.n}</div>
                <h3 className="serif" style={{fontSize:26, color:'var(--ink-1)', margin:'0 0 20px', lineHeight:1.15, letterSpacing:'-0.01em'}}>{x.title}</h3>
                <p style={{margin:'0 0 28px', color:'var(--ink-2)', fontSize:14.5, lineHeight:1.6}}>{x.body}</p>
                <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                  {x.tags.map((t,j) => (
                    <span key={j} className="mono" style={{fontSize:10, letterSpacing:'.14em', padding:'5px 10px', border:'1px solid var(--rule)', color: t.startsWith('+')?'var(--gold-1)':'var(--ink-3)'}}>{t}</span>
                  ))}
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 820px) { .persona-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}

/* ============ ORIGIN + BETA CTA ============ */
function OriginAndCTA() {
  const [email, setEmail] = useStateS2('');
  const [sent, setSent] = useStateS2(false);

  const submit = (e) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setSent(true);
    setTimeout(() => { setSent(false); setEmail(''); }, 4000);
  };

  return (
    <>
      <section id="origin">
        <div className="wrap">
          <div style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:60, alignItems:'start'}} className="origin-grid">
            <FadeUp>
              <div className="section-label" style={{marginBottom:0}}><span className="idx">§ 05</span><span>Origin</span></div>
            </FadeUp>
            <div>
              <FadeUp>
                <h2 className="display" style={{marginBottom:32, maxWidth:'22ch'}}>
                  Rooted in <em style={{color:'var(--gold-1)'}}>Bharat.</em> Built for modern markets.
                </h2>
              </FadeUp>
              <FadeUp delay={80}>
                <p className="lede" style={{marginBottom:24}}>
                  Vikuna Technologies is a Hyderabad-based product company. DristiQ was born from a conviction that India's ancient astronomical wisdom — refined over millennia — encodes genuine time-cycle intelligence that modern market data platforms have entirely overlooked.
                </p>
              </FadeUp>
              <FadeUp delay={160}>
                <p className="serif" style={{fontSize:24, fontStyle:'italic', color:'var(--gold-1)', margin:'40px 0 16px', letterSpacing:'-0.01em', lineHeight:1.3}}>
                  We did not choose between ancient wisdom and modern data science.<br/>
                  <span style={{color:'var(--ink-1)'}}>We built the layer where both speak together.</span>
                </p>
              </FadeUp>
              <FadeUp delay={220}>
                <p className="serif" style={{fontSize:22, fontStyle:'italic', color:'var(--ink-3)', margin:'0', letterSpacing:'-0.01em', lineHeight:1.3}}>
                  We are not building another trading tool. We are building the <span style={{color:'var(--gold-1)'}}>atmospheric layer.</span>
                </p>
              </FadeUp>
              <FadeUp delay={240}>
                <div style={{marginTop:48, display:'flex', gap:32, alignItems:'center', flexWrap:'wrap'}}>
                  <div style={{display:'flex', alignItems:'center', gap:14}}>
                    <LogoMark size={36}/>
                    <div>
                      <div className="serif" style={{fontSize:20, color:'var(--ink-1)', letterSpacing:'-0.01em'}}>Vikuna Technologies</div>
                      <div className="mono" style={{fontSize:10, letterSpacing:'.22em', color:'var(--ink-3)', textTransform:'uppercase'}}>Hyderabad · Est. 2026</div>
                    </div>
                  </div>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
        <style>{`
          @media (max-width: 820px) { .origin-grid { grid-template-columns: 1fr !important; gap: 32px !important; } }
        `}</style>
      </section>

      <section id="beta" style={{padding:'160px 0', position:'relative', borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)', background:'radial-gradient(1200px 500px at 50% 50%, rgba(226,185,111,0.08), transparent 60%), linear-gradient(180deg, rgba(26,16,64,0.35), rgba(10,10,18,0.8))'}}>
        <div className="wrap" style={{textAlign:'center', position:'relative'}}>
          <FadeUp>
            <div className="mono" style={{fontSize:10, letterSpacing:'.28em', color:'var(--gold-2)', marginBottom:28}}>◇ BETA · LIMITED COHORT</div>
          </FadeUp>
          <FadeUp delay={80}>
            <h2 className="display" style={{fontSize:'clamp(42px, 6vw, 80px)', margin:'0 auto 24px', maxWidth:'18ch'}}>
              The atmospheric conditions<br/><em style={{color:'var(--gold-1)'}}>are forming.</em>
            </h2>
          </FadeUp>
          <FadeUp delay={160}>
            <p className="lede" style={{margin:'0 auto 48px', textAlign:'center', maxWidth:'48ch'}}>
              Be among the first Indian traders to see the market through the lens of time.
            </p>
          </FadeUp>
          <FadeUp delay={240}>
            <form onSubmit={submit} style={{display:'flex', gap:0, maxWidth:540, margin:'0 auto', border:'1px solid var(--gold-3)', background:'rgba(10,10,18,0.6)', backdropFilter:'blur(8px)'}} className="beta-form">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{flex:1, padding:'18px 22px', background:'transparent', border:'none', outline:'none', color:'var(--ink-1)', fontFamily:'DM Sans', fontSize:15}}
              />
              <button type="submit" className="btn filled" style={{border:'none', borderLeft:'1px solid var(--gold-2)'}}>
                {sent ? '✓ Received' : <>Explore Beta <span className="arrow">→</span></>}
              </button>
            </form>
          </FadeUp>
          <FadeUp delay={320}>
            <div className="mono" style={{marginTop:24, fontSize:11, letterSpacing:'.18em', color:'var(--ink-3)', textTransform:'uppercase'}}>
              No spam. No pressure. Just early access.
            </div>
          </FadeUp>
          <FadeUp delay={400}>
            <div style={{marginTop:60, paddingTop:32, borderTop:'1px solid var(--rule-soft)', maxWidth:560, margin:'60px auto 0'}}>
              <div className="mono" style={{fontSize:10, letterSpacing:'.24em', color:'var(--ink-4)', textTransform:'uppercase'}}>
                Data platform only. Not investment advice.
              </div>
            </div>
          </FadeUp>
        </div>
        <style>{`
          @media (max-width: 600px) {
            .beta-form { flex-direction: column !important; }
            .beta-form button { border-left: none !important; border-top: 1px solid var(--gold-2) !important; }
          }
        `}</style>
      </section>
    </>
  );
}

/* ============ FOOTER ============ */
function Footer() {
  return (
    <footer style={{padding:'80px 0 40px', position:'relative'}}>
      <div className="wrap">
        <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:48, marginBottom:64}} className="footer-grid">
          <div>
            <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:18}}>
              <LogoMark size={32}/>
              <div>
                <div className="serif" style={{fontSize:24, color:'var(--ink-1)', letterSpacing:'-0.01em'}}>Dristi<span style={{color:'var(--gold-1)'}}>Q</span></div>
                <div className="mono" style={{fontSize:9, letterSpacing:'.22em', color:'var(--ink-3)', textTransform:'uppercase'}}>By Vikuna Technologies, Hyderabad</div>
              </div>
            </div>
            <p className="serif" style={{fontSize:20, fontStyle:'italic', color:'var(--gold-1)', margin:'20px 0 0', letterSpacing:'-0.01em'}}>
              "We read the sky. You read the market."
            </p>
          </div>
          {[
            { h: 'Platform', links: ['Atmosphere Engine','Astro Calendar','Confluence','Code Tagging'] },
            { h: 'Company', links: ['About','Vikuna','Contact','Careers'] },
            { h: 'Legal', links: ['Privacy','Disclaimer','Terms','SEBI Notice'] }
          ].map((col,i) => (
            <div key={i}>
              <div className="mono" style={{fontSize:10, letterSpacing:'.22em', color:'var(--gold-2)', textTransform:'uppercase', marginBottom:18}}>{col.h}</div>
              <ul style={{listStyle:'none', padding:0, margin:0}}>
                {col.links.map(l => (
                  <li key={l} style={{marginBottom:10}}>
                    <a href="#" style={{fontSize:13, color:'var(--ink-2)', transition:'color .2s ease'}} onMouseEnter={e=>e.target.style.color='var(--gold-1)'} onMouseLeave={e=>e.target.style.color='var(--ink-2)'}>{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <hr className="hair-soft"/>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginTop:32, gap:32, flexWrap:'wrap'}}>
          <p style={{margin:0, fontSize:11, color:'var(--ink-4)', lineHeight:1.6, maxWidth:'68ch'}}>
            DristiQ is a data and analytics platform. Nothing on this platform constitutes investment advice or trading recommendations. Past market behavior mapped against time-cycles does not guarantee future results. Users are solely responsible for their trading decisions.
          </p>
          <div className="mono" style={{fontSize:10, letterSpacing:'.22em', color:'var(--ink-4)', textTransform:'uppercase', textAlign:'right'}}>
            © 2026 Vikuna Technologies<br/>
            <span style={{color:'var(--gold-3)'}}>Made in Bhārat</span>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 820px) { .footer-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 520px) { .footer-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </footer>
  );
}

Object.assign(window, { Pillars, VaNiSection, Personas, OriginAndCTA, Footer });
