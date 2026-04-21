import { C, SERIF, MONO, SANS } from './tokens';
import { FadeUp, SectionHeader } from './shared';

const CARDS = [
  { n:'01', t:'Same pattern, different sky.', b:"The same chart pattern behaves differently on an Amāvāsyā versus a Śukla Pakṣa. Modern technicals have no framework for this. Panchāṅgam does." },
  { n:'02', t:'A layer no one has built.',    b:"No data platform connects Vedic astronomical cycles to live Indian market data — giving serious traders the atmospheric layer they have been missing." },
  { n:'03', t:'Conditions, not commands.',    b:"A weather forecast does not tell you to carry an umbrella — it gives you probability of rain. Markets need the same: atmospheric awareness, not more buy/sell noise." },
  { n:'04', t:'What the price is doing. When conditions are favorable.', b:"Classical technicals tell you WHAT the price is doing. Panchāṅgam tells you WHEN the conditions are favorable. DristiQ is the only platform that shows both — simultaneously, in Indian market context." },
];

const NOT_LIST  = ['Buy / Sell recommendations','Target prices','Trading alerts','Investment advice'];
const ARE_LIST  = ['Atmospheric conditions of the market in time','Panchāṅgam cycle intelligence mapped to market data','Historical pattern awareness across time cycles','A weather report — you decide how to dress'];

export function InsightSection() {
  return (
    <section id="insight" style={{ position:'relative', padding:'120px 0' }}>

      <SectionHeader
        idx="§ 01" label="The Insight"
        title={<>The market moves.<br/><em style={{ color:C.g1 }}>Time</em> governs the market.</>}
        lede="Ancient Indian astronomers tracked planetary cycles with extraordinary precision — not for prophecy, but because they observed that time has patterns. Markets do too. Time cycles repeat."
      />

      {/* 4-card grid */}
      <div className="dq-wrap" style={{ marginTop:80 }}>
        <div className="dq-insight-grid" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:1, background:C.rule, border:`1px solid ${C.rule}` }}>
          {CARDS.map((c,i) => (
            <FadeUp key={c.n} delay={i*80}>
              <div style={{ background:C.bg1, padding:'42px 36px', height:'100%' }}>
                <div style={{ fontFamily:MONO, fontSize:11, letterSpacing:'.22em', color:C.g2, marginBottom:22 }}>◇ {c.n}</div>
                <h3 style={{ fontFamily:SERIF, fontSize:28, color:C.ink1, margin:'0 0 16px', lineHeight:1.15, letterSpacing:'-0.01em' }}>{c.t}</h3>
                <p style={{ margin:0, color:C.ink2, fontSize:14, lineHeight:1.6, fontFamily:SANS }}>{c.b}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>

      {/* Not vs What we are */}
      <div className="dq-wrap" style={{ marginTop:120 }}>
        <FadeUp>
          <div className="dq-section-label"><span style={{ color:C.ink4 }}>§ 01.b</span><span>Not a signal. An atmosphere.</span></div>
        </FadeUp>
        <div className="dq-compare-grid" style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:40, alignItems:'stretch' }}>

          {/* NOT column */}
          <FadeUp>
            <div style={{ padding:'40px 36px', border:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.01)', height:'100%' }}>
              <div style={{ fontFamily:MONO, fontSize:11, letterSpacing:'.22em', color:C.ink4, marginBottom:18 }}>✗ WHAT WE ARE NOT</div>
              <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                {NOT_LIST.map((x,i) => (
                  <li key={x} style={{ padding:'14px 0', borderBottom: i<3 ? '1px solid rgba(255,255,255,0.04)' : 'none', color:C.ink3, fontSize:15, display:'flex', alignItems:'center', gap:14, fontFamily:SANS }}>
                    <span style={{ color:C.ink4, width:16 }}>×</span>
                    <span style={{ textDecoration:'line-through', textDecorationColor:'rgba(138,131,114,0.4)' }}>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>

          {/* Divider */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}>
            <div style={{ width:1, flex:1, background:C.rule }}/>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.24em', color:C.g2, writingMode:'vertical-rl' as const, transform:'rotate(180deg)', padding:'8px 0' }}>· vs ·</div>
            <div style={{ width:1, flex:1, background:C.rule }}/>
          </div>

          {/* ARE column */}
          <FadeUp delay={120}>
            <div style={{ padding:'40px 36px', border:`1px solid ${C.rule}`, background:'linear-gradient(180deg,rgba(226,185,111,0.04),rgba(226,185,111,0.01))', height:'100%', boxShadow:`inset 0 0 40px rgba(226,185,111,0.03)` }}>
              <div style={{ fontFamily:MONO, fontSize:11, letterSpacing:'.22em', color:C.g2, marginBottom:18 }}>✓ WHAT WE ARE</div>
              <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                {ARE_LIST.map((x,i) => (
                  <li key={x} style={{ padding:'14px 0', borderBottom: i<3 ? `1px solid rgba(226,185,111,0.08)` : 'none', color:C.ink1, fontSize:15, display:'flex', alignItems:'center', gap:14, fontFamily:SANS }}>
                    <span style={{ color:C.g1, width:16 }}>◆</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>
        </div>

        {/* Analogy pull-quote */}
        <FadeUp delay={200}>
          <div style={{ marginTop:80, padding:'48px 0', borderTop:`1px solid ${C.rule}`, borderBottom:`1px solid ${C.rule}`, textAlign:'center' }}>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.24em', color:C.g2, marginBottom:20 }}>THE ANALOGY</div>
            <p style={{ fontFamily:SERIF, margin:'0 auto', maxWidth:'26ch', fontSize:'clamp(28px,3.6vw,44px)', lineHeight:1.18, color:C.ink1, letterSpacing:'-0.015em' }}>
              The IMD tells you a cyclone is forming.<br/>
              <span style={{ color:C.ink3 }}>It does not tell you whether to travel.</span><br/>
              <em style={{ color:C.g1 }}>DristiQ gives you the same clarity — for markets.</em>
            </p>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
