import { useState } from 'react';
import { C, SERIF, MONO, SANS } from './tokens';
import { FadeUp } from './shared';
import { LogoMark } from './shared';

export function OriginCTA() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setSent(true);
    setTimeout(() => { setSent(false); setEmail(''); }, 4000);
  };

  return (
    <>
      {/* Origin */}
      <section id="origin" style={{ position:'relative', padding:'120px 0' }}>
        <div className="dq-wrap">
          <div className="dq-origin-grid" style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:60, alignItems:'start' }}>
            <FadeUp>
              <div className="dq-section-label" style={{ marginBottom:0 }}>
                <span style={{ color:C.ink4 }}>§ 05</span><span>Origin</span>
              </div>
            </FadeUp>

            <div>
              <FadeUp>
                <h2 style={{ fontFamily:SERIF, fontWeight:400, color:C.ink1, fontSize:'clamp(32px,4.2vw,56px)', lineHeight:1.08, letterSpacing:'-0.02em', margin:'0 0 32px', maxWidth:'22ch' }}>
                  Rooted in <em style={{ color:C.g1 }}>Bharat.</em> Built for modern markets.
                </h2>
              </FadeUp>
              <FadeUp delay={80}>
                <p style={{ fontFamily:SANS, fontSize:17, lineHeight:1.6, color:C.ink2, marginBottom:24, maxWidth:'62ch' }}>
                  Vikuna Technologies is a Hyderabad-based product company. DristiQ was born from a conviction that India's ancient astronomical wisdom — refined over millennia — encodes genuine time-cycle intelligence that modern market data platforms have entirely overlooked.
                </p>
              </FadeUp>
              <FadeUp delay={160}>
                <p style={{ fontFamily:SERIF, fontSize:24, fontStyle:'italic', color:C.g1, margin:'40px 0 16px', letterSpacing:'-0.01em', lineHeight:1.3, maxWidth:'48ch' }}>
                  We did not choose between ancient wisdom and modern data science.<br/>
                  <span style={{ color:C.ink1 }}>We built the layer where both speak together.</span>
                </p>
              </FadeUp>
              <FadeUp delay={220}>
                <p style={{ fontFamily:SERIF, fontSize:22, fontStyle:'italic', color:C.ink3, margin:0, letterSpacing:'-0.01em', lineHeight:1.3, maxWidth:'48ch' }}>
                  We are not building another trading tool. We are building the{' '}
                  <span style={{ color:C.g1 }}>atmospheric layer.</span>
                </p>
              </FadeUp>
              <FadeUp delay={240}>
                <div style={{ marginTop:48, display:'flex', alignItems:'center', gap:14 }}>
                  <LogoMark size={36}/>
                  <div>
                    <div style={{ fontFamily:SERIF, fontSize:20, color:C.ink1, letterSpacing:'-0.01em' }}>Vikuna Technologies</div>
                    <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.22em', color:C.ink3, textTransform:'uppercase' }}>Hyderabad · Est. 2026</div>
                  </div>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      {/* Beta CTA */}
      <section id="beta" style={{
        position:'relative', padding:'160px 0',
        borderTop:`1px solid ${C.rule}`, borderBottom:`1px solid ${C.rule}`,
        background:`radial-gradient(1200px 500px at 50% 50%,rgba(226,185,111,0.08),transparent 60%),linear-gradient(180deg,rgba(26,16,64,0.35),rgba(10,10,18,0.8))`,
      }}>
        <div className="dq-wrap" style={{ textAlign:'center', position:'relative' }}>
          <FadeUp>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.28em', color:C.g2, marginBottom:28 }}>◇ BETA · LIMITED COHORT</div>
          </FadeUp>
          <FadeUp delay={80}>
            <h2 style={{ fontFamily:SERIF, fontWeight:400, color:C.ink1, fontSize:'clamp(42px,6vw,80px)', lineHeight:1.05, letterSpacing:'-0.02em', margin:'0 auto 24px', maxWidth:'18ch' }}>
              The atmospheric conditions<br/><em style={{ color:C.g1 }}>are forming.</em>
            </h2>
          </FadeUp>
          <FadeUp delay={160}>
            <p style={{ fontFamily:SANS, fontSize:17, lineHeight:1.6, color:C.ink2, margin:'0 auto 48px', maxWidth:'48ch' }}>
              Be among the first Indian traders to see the market through the lens of time.
            </p>
          </FadeUp>
          <FadeUp delay={240}>
            <form onSubmit={submit} className="dq-beta-form" style={{
              display:'flex', maxWidth:540, margin:'0 auto',
              border:`1px solid ${C.g3}`, background:'rgba(10,10,18,0.6)',
              backdropFilter:'blur(8px)',
            }}>
              <input
                type="email" placeholder="your@email.com" value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ flex:1, padding:'18px 22px', background:'transparent', border:'none', outline:'none', color:C.ink1, fontFamily:SANS, fontSize:15 }}
              />
              <button type="submit" className="dq-btn dq-btn-filled" style={{ border:'none', borderLeft:`1px solid ${C.g2}`, whiteSpace:'nowrap' }}>
                {sent ? '✓ Received' : <>Explore Beta <span className="dq-arrow">→</span></>}
              </button>
            </form>
          </FadeUp>
          <FadeUp delay={320}>
            <div style={{ fontFamily:MONO, marginTop:24, fontSize:11, letterSpacing:'.18em', color:C.ink3, textTransform:'uppercase' }}>
              No spam. No pressure. Just early access.
            </div>
          </FadeUp>
          <FadeUp delay={400}>
            <div style={{ marginTop:60, paddingTop:32, borderTop:`1px solid ${C.rs}`, maxWidth:560, margin:'60px auto 0' }}>
              <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.24em', color:C.ink4 }}>
                Data platform only. Not investment advice.
              </div>
            </div>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
