import { C, SERIF, MONO, SANS } from './tokens';
import { LogoMark } from './shared';

const COLS = [
  { h:'Platform', links:['Atmosphere Engine','Astro Calendar','Confluence','Code Tagging'] },
  { h:'Company',  links:['About','Vikuna','Contact','Careers'] },
  { h:'Legal',    links:['Privacy','Disclaimer','Terms','SEBI Notice'] },
];

export function Footer() {
  return (
    <footer style={{ padding:'80px 0 40px', position:'relative' }}>
      <div className="dq-wrap">

        {/* Top grid */}
        <div className="dq-footer-grid" style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:48, marginBottom:64 }}>
          {/* Brand column */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
              <LogoMark size={32}/>
              <div>
                <div style={{ fontFamily:SERIF, fontSize:24, color:C.ink1, letterSpacing:'-0.01em' }}>
                  Dristi<span style={{ color:C.g1 }}>Q</span>
                </div>
                <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'.22em', color:C.ink3, textTransform:'uppercase' }}>
                  By Vikuna Technologies, Hyderabad
                </div>
              </div>
            </div>
            <p style={{ fontFamily:SERIF, fontSize:20, fontStyle:'italic', color:C.g1, margin:'20px 0 0', letterSpacing:'-0.01em' }}>
              "We read the sky. You read the market."
            </p>
          </div>

          {/* Link columns */}
          {COLS.map(col => (
            <div key={col.h}>
              <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.22em', color:C.g2, textTransform:'uppercase', marginBottom:18 }}>{col.h}</div>
              <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                {col.links.map(l => (
                  <li key={l} style={{ marginBottom:10 }}>
                    <a href="#" className="dq-footer-link" style={{ fontFamily:SANS, fontSize:13, color:C.ink2, textDecoration:'none', transition:'color .2s ease' }}>{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <hr style={{ border:0, height:1, background:C.rs, margin:0 }}/>

        {/* Bottom row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginTop:32, gap:32, flexWrap:'wrap' }}>
          <p style={{ fontFamily:SANS, margin:0, fontSize:11, color:C.ink4, lineHeight:1.6, maxWidth:'68ch' }}>
            DristiQ is a data and analytics platform. Nothing on this platform constitutes investment advice or trading recommendations. Past market behavior mapped against time-cycles does not guarantee future results. Users are solely responsible for their trading decisions.
          </p>
          <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.22em', color:C.ink4, textTransform:'uppercase', textAlign:'right' }}>
            © 2026 Vikuna Technologies<br/>
            <span style={{ color:C.g3 }}>Made in Bhārat</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
