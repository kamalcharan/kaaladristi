import { useEffect } from 'react';
import { Starfield, Navbar } from './landing/shared';
import { Hero } from './landing/Hero';
import { InsightSection } from './landing/Insight';
import { Pillars } from './landing/Pillars';
import { VaNiSection } from './landing/VaNi';
import { Personas } from './landing/Personas';
import { OriginCTA } from './landing/OriginCTA';
import { Footer } from './landing/Footer';
import { useTodayAtmo } from './landing/AtmosphericCard';
import { C } from './landing/tokens';

// ── Landing-page scoped CSS ───────────────────────────────────────────────
const LANDING_CSS = `
  .dq-wrap { max-width:1280px; margin:0 auto; padding:0 40px; }
  @media(max-width:720px){ .dq-wrap{ padding:0 20px; } }

  .dq-fade { opacity:0; transform:translateY(24px); transition:opacity .9s ease,transform .9s ease; }
  .dq-fade.dq-in { opacity:1; transform:translateY(0); }

  .dq-section-label {
    display:flex; align-items:center; gap:14px;
    font-family:'JetBrains Mono','Geist Mono',ui-monospace,monospace;
    font-size:11px; letter-spacing:.22em; text-transform:uppercase;
    color:#c9a24b; margin-bottom:28px;
  }
  .dq-section-label::before { content:""; display:block; width:28px; height:1px; background:#c9a24b; }

  .dq-btn {
    display:inline-flex; align-items:center; gap:10px;
    padding:13px 22px; border:1px solid #c9a24b; color:#f5a623;
    font-family:'DM Sans','Inter',system-ui,sans-serif;
    font-size:13px; letter-spacing:.14em; text-transform:uppercase;
    text-decoration:none; transition:all .25s ease; background:transparent; cursor:pointer;
  }
  .dq-btn:hover { background:rgba(245,166,35,.08); box-shadow:0 0 32px rgba(245,166,35,.28),inset 0 0 16px rgba(245,166,35,.06); color:#faf3e0; }
  .dq-btn-filled { background:linear-gradient(180deg,rgba(245,166,35,.92),rgba(201,168,76,.92)); color:#13161d !important; border-color:#f5a623; }
  .dq-btn-filled:hover { box-shadow:0 0 40px rgba(245,166,35,.28); background:linear-gradient(180deg,rgba(240,205,135,1),rgba(245,166,35,1)) !important; }
  .dq-arrow { transition:transform .25s ease; }
  .dq-btn:hover .dq-arrow { transform:translateX(4px); }

  .dq-navlink { transition:color .2s ease; text-decoration:none; color:#7a8099; }
  .dq-navlink:hover { color:#f5a623; }
  @media(max-width:820px){ .dq-nav-links{ display:none !important; } }

  .dq-hero-grid { display:grid; grid-template-columns:1.15fr 1fr; gap:60px; align-items:center; }
  @media(max-width:900px){ .dq-hero-grid{ grid-template-columns:1fr !important; } }

  .dq-disclaimer { display:grid; grid-template-columns:auto 1fr auto; gap:28px; align-items:center; }
  @media(max-width:820px){ .dq-disclaimer{ grid-template-columns:1fr !important; gap:12px !important; } }

  .dq-atmo-card { }
  @media(max-width:900px){
    .dq-atmo-card { position:relative !important; left:auto !important; bottom:auto !important; margin:24px auto !important; width:100% !important; max-width:420px; }
  }

  .dq-insight-grid { display:grid; grid-template-columns:repeat(2,1fr); }
  @media(max-width:820px){ .dq-insight-grid{ grid-template-columns:1fr !important; } }

  .dq-compare-grid { display:grid; grid-template-columns:1fr auto 1fr; gap:40px; align-items:stretch; }
  @media(max-width:820px){ .dq-compare-grid{ grid-template-columns:1fr !important; } }

  .dq-two-lenses { display:grid; grid-template-columns:auto 1fr auto; gap:48px; align-items:center; }
  @media(max-width:900px){ .dq-two-lenses{ grid-template-columns:1fr !important; gap:24px !important; padding:32px 28px !important; } }

  .dq-pillar-grid { display:grid; grid-template-columns:1fr 1fr; }
  @media(max-width:820px){ .dq-pillar-grid{ grid-template-columns:1fr !important; } }

  /* theme-agnostic: landing page is fixed-dark marketing, independent of app theme */
  .dq-pillar-card { background:#13161d; transition:background .3s ease; }
  .dq-pillar-card:hover { background:linear-gradient(180deg,#1c2030,#13161d) !important; } /* theme-agnostic: fixed-dark landing */

  .dq-vani-grid { display:grid; grid-template-columns:1fr 1fr; gap:80px; align-items:center; }
  @media(max-width:900px){ .dq-vani-grid{ grid-template-columns:1fr !important; gap:48px !important; } }

  .dq-persona-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
  @media(max-width:820px){ .dq-persona-grid{ grid-template-columns:1fr !important; } }

  .dq-glass {
    background:linear-gradient(180deg,color-mix(in srgb, var(--text-primary) 2%, transparent),color-mix(in srgb, var(--text-primary) 0.5%, transparent));
    border:1px solid rgba(245,166,35,.18);
    backdrop-filter:blur(8px);
    -webkit-backdrop-filter:blur(8px);
    transition:border-color .25s ease;
  }
  .dq-glass:hover { border-color:rgba(245,166,35,.35); }

  .dq-origin-grid { display:grid; grid-template-columns:auto 1fr; gap:60px; align-items:start; }
  @media(max-width:820px){ .dq-origin-grid{ grid-template-columns:1fr !important; gap:32px !important; } }

  .dq-beta-form { display:flex; }
  @media(max-width:600px){ .dq-beta-form{ flex-direction:column !important; } .dq-beta-form button{ border-left:none !important; border-top:1px solid #8a7433 !important; } }

  .dq-footer-grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:48px; }
  @media(max-width:820px){ .dq-footer-grid{ grid-template-columns:1fr 1fr !important; } }
  @media(max-width:520px){ .dq-footer-grid{ grid-template-columns:1fr !important; } }

  .dq-footer-link:hover { color:#f5a623 !important; }

  @keyframes slowspin    { to { transform:rotate(360deg); } }
  @keyframes slowspinrev { to { transform:rotate(-360deg); } }
  @keyframes breathe     { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
`;

export default function LandingPage() {
  const { atmo, loading } = useTodayAtmo();

  // Inject scoped CSS on mount
  useEffect(() => {
    const tag = document.createElement('style');
    tag.id = 'dristiq-landing-css';
    tag.textContent = LANDING_CSS;
    document.head.appendChild(tag);
    return () => document.getElementById('dristiq-landing-css')?.remove();
  }, []);

  return (
    <div style={{ background:C.bg0, color:C.ink2, fontFamily:"'DM Sans','Inter',system-ui,sans-serif", fontSize:15, lineHeight:1.55, overflowX:'hidden', minHeight:'100vh', WebkitFontSmoothing:'antialiased' }}>
      {/* Fixed backgrounds */}
      <div style={{
        position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
        background:`radial-gradient(1200px 700px at 70% -10%,rgba(40,46,68,.25),transparent 60%),radial-gradient(900px 600px at 10% 30%,rgba(245,166,35,.05),transparent 65%),radial-gradient(1400px 900px at 50% 110%,rgba(28,32,48,.35),transparent 60%),${C.bg0}`,
      }}/>
      <Starfield/>

      {/* Page content */}
      <div style={{ position:'relative', zIndex:2 }}>
        <Navbar/>
        <main>
          <Hero atmo={atmo} loading={loading}/>
          <InsightSection/>
          <Pillars/>
          <VaNiSection/>
          <Personas/>
          <OriginCTA/>
          <Footer/>
        </main>
      </div>
    </div>
  );
}
