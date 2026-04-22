import { C, SERIF, MONO, SANS } from './tokens';
import { FadeUp, SectionHeader, Yantra } from './shared';

const FEATURES = [
  { n:'i.',   t:'Interprets Panchāṅgam cycles in natural language.', b:"Ask VaNi what today's atmospheric conditions mean for the market — in English, Hindi, or Sanskrit-adjacent terminology." },
  { n:'ii.',  t:'Conversational data explainability.',               b:'Not just what the time-cycle shows, but the historical context behind it — across decades of indexed Indian market data.' },
  { n:'iii.', t:'Runs on Vikuna infrastructure.',                    b:'Your queries and conversation history stay within the platform. No third-party LLM pipelines. No model leakage.' },
];

export function VaNiSection() {
  return (
    <section id="vani" style={{ position:'relative', padding:'120px 0' }}>
      <div className="dq-wrap">
        <div className="dq-vani-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center' }}>

          {/* Left — Yantra */}
          <FadeUp>
            <div style={{ position:'relative', aspectRatio:'1/1', maxWidth:420, margin:'0 auto' }}>
              <Yantra size={420}/>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                <div style={{ fontFamily:SERIF, fontSize:32, fontStyle:'italic', color:C.ink1, letterSpacing:'-0.01em', textShadow:`0 0 30px rgba(226,185,111,0.6)` }}>VaNi</div>
              </div>
              <div style={{ fontFamily:MONO, position:'absolute', bottom:-8, left:0, right:0, textAlign:'center' as const, fontSize:9, letterSpacing:'.3em', color:C.g2 }}>PROPRIETARY · VIKUNA</div>
            </div>
          </FadeUp>

          {/* Right — copy */}
          <div>
            <FadeUp>
              <div className="dq-section-label"><span style={{ color:C.ink4 }}>§ 03</span><span>The Interpreter</span></div>
            </FadeUp>
            <FadeUp delay={80}>
              <h2 style={{ fontFamily:SERIF, fontWeight:400, color:C.ink1, fontSize:'clamp(32px,4.2vw,56px)', lineHeight:1.08, letterSpacing:'-0.02em', margin:'0 0 20px' }}>
                Powered by <em style={{ color:C.g1 }}>VaNi AI</em>.
              </h2>
            </FadeUp>
            <FadeUp delay={160}>
              <p style={{ fontFamily:SANS, fontSize:17, lineHeight:1.6, color:C.ink2, marginBottom:36 }}>
                Vikuna's proprietary AI engine — built for Indian market context. VaNi does not issue signals. It interprets atmospheric data, in your language, at your pace.
              </p>
            </FadeUp>

            {FEATURES.map((f,i) => (
              <FadeUp key={f.n} delay={200+i*80}>
                <div style={{ padding:'22px 0', borderBottom: i<2 ? `1px solid ${C.rs}` : 'none', display:'grid', gridTemplateColumns:'auto 1fr', gap:24 }}>
                  <div style={{ fontFamily:MONO, fontSize:11, letterSpacing:'.18em', color:C.g2, paddingTop:2 }}>{f.n}</div>
                  <div>
                    <div style={{ fontFamily:SERIF, fontSize:20, color:C.ink1, marginBottom:6, letterSpacing:'-0.01em' }}>{f.t}</div>
                    <div style={{ fontFamily:SANS, fontSize:14, color:C.ink3, lineHeight:1.6 }}>{f.b}</div>
                  </div>
                </div>
              </FadeUp>
            ))}

            <FadeUp delay={500}>
              <div style={{ marginTop:32, display:'inline-flex', alignItems:'center', gap:12, padding:'10px 18px', border:`1px solid ${C.g3}`, background:'rgba(226,185,111,0.05)' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:C.g1, boxShadow:`0 0 12px ${C.glow}`, animation:'breathe 2.5s ease-in-out infinite', display:'block' }}/>
                <span style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.22em', color:C.g1, textTransform:'uppercase' }}>VaNi AI · by Vikuna</span>
              </div>
            </FadeUp>
          </div>
        </div>

        {/* Mock transcript */}
        <FadeUp delay={100} style={{ marginTop:100 }}>
          <div style={{ border:`1px solid ${C.rule}`, background:'rgba(10,10,18,0.5)', padding:'32px 36px', maxWidth:780, margin:'100px auto 0' }}>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.22em', color:C.ink4, marginBottom:20 }}>◇ TRANSCRIPT — VaNi · 21 APR 2026 · 09:42 IST</div>
            <div style={{ display:'flex', gap:20, marginBottom:18 }}>
              <div style={{ fontFamily:MONO, fontSize:10, color:C.ink3, letterSpacing:'.14em', paddingTop:3, minWidth:36 }}>YOU</div>
              <div style={{ fontFamily:SANS, color:C.ink2, fontSize:15, lineHeight:1.55 }}>What is today's atmospheric reading for NIFTY?</div>
            </div>
            <div style={{ display:'flex', gap:20 }}>
              <div style={{ fontFamily:MONO, fontSize:10, color:C.g1, letterSpacing:'.14em', paddingTop:3, minWidth:36 }}>VaNi</div>
              <div style={{ fontFamily:SANS, color:C.ink1, fontSize:15, lineHeight:1.6 }}>
                Today reads as <em style={{ color:C.g1, fontStyle:'italic' }}>charged</em>. Jyeṣṭhā Nakṣatra with Kṛṣṇa Pakṣa Trayodaśī historically clusters with elevated reversal signatures on NIFTY — 68th percentile attention. This is not a signal to act. It is a condition to observe.
                <span style={{ display:'block', marginTop:10, color:C.ink3, fontSize:13, fontStyle:'italic' }}>Would you like the last 8 years of analogous days?</span>
              </div>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
