// KaalaDristi Astro Cycle — "releasing soon" teaser (owner decision
// 2026-07-19: the planetary chart overlay is teased, never presented as a
// live hero, until the astro cycle actually ships). Static SVG mock of the
// planet-band overlay: sign segments + retrograde/ingress markers under a
// price ribbon. No live data, no claims — the copy stays observational.

import { C, MONO, SANS } from './tokens';
import { FadeUp, SectionHeader } from './shared';

const ROWS = [
  { sym: '☿', name: 'Mercury', segs: [22, 34, 26, 18], marks: [{ at: 36, m: '℞' }, { at: 74, m: '→' }] },
  { sym: '♀', name: 'Venus',   segs: [30, 28, 24, 18], marks: [{ at: 55, m: '→' }] },
  { sym: '♃', name: 'Jupiter', segs: [64, 36],         marks: [{ at: 64, m: '→' }] },
  { sym: '♄', name: 'Saturn',  segs: [100],            marks: [{ at: 42, m: '℞' }] },
];

// Deterministic price ribbon for the mock (no randomness — renders identically
// on every visit; this is decoration, not data).
const RIBBON = 'M0,46 L7,42 L14,44 L21,37 L28,39 L35,31 L42,34 L49,27 L56,30 L63,22 L70,26 L77,19 L84,23 L91,15 L100,18';

export function AstroTeaser() {
  return (
    <section id="astro-cycle" style={{ position: 'relative', padding: '110px 0 90px' }}>
      <SectionHeader
        idx="§ NEXT"
        label="KaalaDristi · Astro Cycle"
        title={<>Price history meets<br /><em style={{ color: C.g1, fontStyle: 'italic' }}>planetary positions.</em></>}
        lede="The next layer of DristiQ: transit windows, retrogrades, and sign positions rendered directly beneath the price chart — so recurring time-cycles and market behavior can be studied on one canvas. In final validation now."
      />

      <div className="dq-wrap" style={{ marginTop: 48 }}>
        <FadeUp>
          <div className="dq-glass" style={{ borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
            {/* Releasing-soon chip */}
            <div style={{
              position: 'absolute', top: 14, right: 14, zIndex: 2,
              fontFamily: MONO, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase',
              color: C.g1, border: `1px solid ${C.rule}`, background: C.rs,
              padding: '5px 12px', borderRadius: 3,
            }}>
              Releasing soon
            </div>

            <div style={{ padding: '26px 22px 18px' }}>
              {/* Price ribbon */}
              <svg viewBox="0 0 100 54" preserveAspectRatio="none"
                style={{ display: 'block', width: '100%', height: 110 }}>
                <path d={RIBBON} fill="none" stroke={C.g2} strokeWidth="0.7" opacity="0.85" />
                <path d={`${RIBBON} L100,54 L0,54 Z`} fill={C.rs} stroke="none" />
              </svg>

              {/* Planet bands */}
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ROWS.map((row) => {
                  let acc = 0;
                  return (
                    <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        fontFamily: MONO, fontSize: 10, letterSpacing: '.08em',
                        color: C.ink3, width: 74, flexShrink: 0,
                      }}>
                        {row.sym}&nbsp;{row.name}
                      </span>
                      <div style={{ position: 'relative', flex: 1, height: 16 }}>
                        {row.segs.map((w, i) => {
                          const left = acc; acc += w;
                          return (
                            <div key={i} style={{
                              position: 'absolute', top: 2, bottom: 2,
                              left: `${left}%`, width: `calc(${w}% - 2px)`,
                              background: i % 2 === 0 ? C.rs : 'transparent',
                              border: `1px solid ${C.rule}`, borderRadius: 2,
                            }} />
                          );
                        })}
                        {row.marks.map((m, i) => (
                          <span key={i} style={{
                            position: 'absolute', left: `${m.at}%`, top: '50%',
                            transform: 'translate(-50%,-50%)',
                            fontFamily: MONO, fontSize: 10, color: C.g1, lineHeight: 1,
                          }}>
                            {m.m}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{
                marginTop: 16, display: 'flex', gap: 22, flexWrap: 'wrap',
                fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', color: C.ink4,
              }}>
                <span><span style={{ color: C.g1 }}>℞</span>&nbsp;Retrograde window</span>
                <span><span style={{ color: C.g1 }}>→</span>&nbsp;Sign ingress</span>
                <span>Bands · sign position over time</span>
              </div>
            </div>
          </div>
        </FadeUp>

        <FadeUp delay={120}>
          <p style={{
            fontFamily: SANS, fontSize: 13, lineHeight: 1.7, color: C.ink3,
            marginTop: 18, maxWidth: '64ch',
          }}>
            Illustration of the upcoming overlay — not live data. When it ships, every chart
            inside DristiQ can carry this time-cycle band alongside the technicals you already use.
          </p>
        </FadeUp>
      </div>
    </section>
  );
}
