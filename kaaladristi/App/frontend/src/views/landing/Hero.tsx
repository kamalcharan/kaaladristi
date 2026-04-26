import { useNavigate } from 'react-router-dom';
import { C, SERIF, MONO, SANS } from './tokens';
import { FadeUp, Hair } from './shared';
import { PanchangamMandala } from './Mandala';
import { AtmosphericCard, type Atmo } from './AtmosphericCard';

export function Hero({ atmo, loading }: { atmo: Atmo | null; loading: boolean }) {
  const navigate = useNavigate();
  const sakaYear = new Date().getFullYear() - 78;
  const tithiLabel = !loading && atmo ? atmo.tithi.split('—')[0].trim() : '—';

  const smooth = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' });
  };

  return (
    <section id="hero" style={{ paddingTop:160, paddingBottom:80, minHeight:'100vh', display:'flex', alignItems:'center' }}>
      <div className="dq-wrap" style={{ width:'100%' }}>

        {/* Instrument band */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:40, gap:20, flexWrap:'wrap' }}>
          <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.24em', textTransform:'uppercase', color:C.ink3 }}>
            <span style={{ color:C.g2 }}>◉</span>&nbsp;&nbsp;Śaka {sakaYear} · Vaiśākha · Kṛṣṇa Pakṣa · {tithiLabel}
          </div>
          <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.24em', textTransform:'uppercase', color:C.ink3 }}>
            NSE · BSE · BETA — EST. HYD 2026
          </div>
        </div>
        <Hair soft/>
        <div style={{ marginBottom:60 }}/>

        {/* Main grid */}
        <div className="dq-hero-grid" style={{ display:'grid', gridTemplateColumns:'1.15fr 1fr', gap:60, alignItems:'center' }}>

          {/* Left — copy */}
          <div>
            <FadeUp>
              <div className="dq-section-label"><span style={{ color:C.ink4 }}>§ 00</span><span>Prologue</span></div>
            </FadeUp>
            <FadeUp delay={80}>
              <h1 style={{ fontFamily:SERIF, fontWeight:400, color:C.ink1, fontSize:'clamp(42px,6.4vw,92px)', lineHeight:1.02, letterSpacing:'-0.02em', margin:0 }}>
                Where Bharath's<br/>
                <em style={{ fontStyle:'italic', color:C.g1 }}>ancient sky</em><br/>
                meets the<br/>
                <em style={{ fontStyle:'italic' }}>modern market.</em>
              </h1>
            </FadeUp>
            <FadeUp delay={180}>
              <p style={{ fontFamily:SANS, marginTop:36, maxWidth:'48ch', fontSize:17, lineHeight:1.6, color:C.ink2 }}>
                Panchāṅgam time-cycles and Vedic astronomical rhythms — fused with classical market technicals: RSI, breakouts, volume patterns — reveal the atmospheric conditions ahead.{' '}
                <em style={{ color:C.g1, fontStyle:'italic' }}>What the ancient sky and modern data agree on, pay attention to.</em>
              </p>
            </FadeUp>
            <FadeUp delay={260}>
              <p style={{ fontFamily:SERIF, marginTop:28, fontSize:28, fontStyle:'italic', color:C.g1, lineHeight:1.2, letterSpacing:'-0.01em' }}>
                "We read the sky.<br/>You read the market."
              </p>
            </FadeUp>
            <FadeUp delay={340}>
              <div style={{ display:'flex', gap:16, marginTop:40, flexWrap:'wrap' }}>
                <button onClick={() => navigate('/login')} className="dq-btn dq-btn-filled">Explore Beta <span className="dq-arrow">→</span></button>
                <a href="#insight" onClick={smooth('insight')} className="dq-btn">Read the thesis</a>
              </div>
            </FadeUp>
            <FadeUp delay={420}>
              <div style={{ fontFamily:MONO, marginTop:28, fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:C.ink3 }}>
                Built for NSE · BSE · Indian market rhythms
              </div>
            </FadeUp>
          </div>

          {/* Right — mandala + atmospheric card */}
          <div style={{ position:'relative', aspectRatio:'1/1', width:'100%', maxWidth:560, justifySelf:'end' }}>
            <div style={{ position:'absolute', inset:0 }}>
              <PanchangamMandala size={560}/>
            </div>
            <AtmosphericCard atmo={atmo} loading={loading}/>
            <div style={{ fontFamily:MONO, position:'absolute', top:'8%', right:'-8%', fontSize:9, letterSpacing:'.2em', textTransform:'uppercase', color:C.g2, lineHeight:1.6 }}>
              <div>CONVERGENCE ZONE</div>
              <div style={{ color:C.ink4 }}>ancient ⟶ modern</div>
            </div>
            <div style={{ fontFamily:MONO, position:'absolute', bottom:'4%', right:'-2%', fontSize:9, letterSpacing:'.2em', textTransform:'uppercase', color:C.ink4 }}>
              Fig. I — Kāla Yantra
            </div>
          </div>
        </div>

        {/* Disclaimer band */}
        <FadeUp delay={500}>
          <div className="dq-disclaimer" style={{
            marginTop:80, padding:'24px 32px', border:`1px solid ${C.rule}`,
            background:'rgba(10,10,18,0.4)', display:'grid',
            gridTemplateColumns:'auto 1fr auto', gap:28, alignItems:'center',
          }}>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.24em', color:C.g2 }}>◇ NON-ADVISORY</div>
            <p style={{ margin:0, fontSize:13, color:C.ink2, lineHeight:1.55, fontFamily:SANS }}>
              DristiQ is a market data and time-cycle intelligence platform. It does{' '}
              <em style={{ color:C.g1, fontStyle:'italic' }}>not</em> provide investment advice or buy/sell recommendations. Like a weather report — we show you the conditions. You make the call.
            </p>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.24em', color:C.ink4, textAlign:'right' }}>ref. §§ 1–10</div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
