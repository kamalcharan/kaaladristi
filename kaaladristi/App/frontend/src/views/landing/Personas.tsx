import { C, SERIF, MONO, SANS } from './tokens';
import { FadeUp, SectionHeader } from './shared';

const PERSONAS = [
  {
    n: 'i.',
    title: 'The Technical Trader',
    body: 'You already use RSI, MACD, breakouts, volume analysis. You are good at reading price. Now add the one layer no charting platform carries — the atmospheric time context. Understand why the same setup fires cleanly on some days and fails on others.',
    tags: ['RSI', 'MACD', 'breakouts', 'volume', '+ atmosphere'],
  },
  {
    n: 'ii.',
    title: 'The Astro-Aware Investor',
    body: 'You follow Panchāṅgam in life. Now see it mapped to market data with historical pattern backing — not belief, but observation.',
    tags: ['Panchāṅgam', 'history', 'observation'],
  },
  {
    n: 'iii.',
    title: 'The Risk-First Trader',
    body: 'You do not chase price. You wait for the right conditions. DristiQ shows you the atmospheric picture — you decide when to move.',
    tags: ['patience', 'conditions', 'agency'],
  },
];

export function Personas() {
  return (
    <section id="personas" style={{ position:'relative', padding:'120px 0', borderTop:`1px solid ${C.rs}` }}>
      <SectionHeader
        idx="§ 04" label="The Reader"
        title={<>Built for the<br/><em style={{ color:C.g1 }}>serious Indian trader.</em></>}
      />

      <div className="dq-wrap" style={{ marginTop:64 }}>
        <div className="dq-persona-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24 }}>
          {PERSONAS.map((p, i) => (
            <FadeUp key={p.n} delay={i * 80}>
              <div className="dq-glass" style={{ padding:'36px 32px', height:'100%' }}>
                <div style={{ fontFamily:MONO, fontSize:11, letterSpacing:'.22em', color:C.g2, marginBottom:28 }}>{p.n}</div>
                <h3 style={{ fontFamily:SERIF, fontSize:26, color:C.ink1, margin:'0 0 20px', lineHeight:1.15, letterSpacing:'-0.01em' }}>{p.title}</h3>
                <p style={{ fontFamily:SANS, margin:'0 0 28px', color:C.ink2, fontSize:14.5, lineHeight:1.6 }}>{p.body}</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {p.tags.map(t => (
                    <span key={t} style={{
                      fontFamily:MONO, fontSize:10, letterSpacing:'.14em',
                      padding:'5px 10px', border:`1px solid ${C.rule}`,
                      color: t.startsWith('+') ? C.g1 : C.ink3,
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
