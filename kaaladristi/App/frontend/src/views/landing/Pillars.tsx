import { C, SERIF, MONO, SANS } from './tokens';
import { FadeUp, SectionHeader } from './shared';

// ── SVG Glyphs ────────────────────────────────────────────────────────────
function MoonGlyph() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="26" fill="none" stroke={C.g3} strokeWidth="0.6" strokeDasharray="1 3"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke={C.g1} strokeWidth="0.8"/>
      <path d="M 24 22 A 14 14 0 1 0 24 42 A 10 12 0 1 1 24 22 Z" fill={C.g1} opacity="0.7"/>
      {[0,45,90,135,180,225,270,315].map(d => {
        const a=(d-90)*Math.PI/180;
        return <line key={d} x1={32+24*Math.cos(a)} y1={32+24*Math.sin(a)} x2={32+28*Math.cos(a)} y2={32+28*Math.sin(a)} stroke={C.g1} strokeWidth="0.6"/>;
      })}
    </svg>
  );
}

function ChartGlyph() {
  const bars: [number,number,boolean][] = [[18,14,true],[26,22,false],[34,10,true],[42,18,false]];
  return (
    <svg viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="26" fill="none" stroke={C.g3} strokeWidth="0.6" strokeDasharray="1 3"/>
      <line x1="12" y1="40" x2="52" y2="40" stroke={C.g3} strokeWidth="0.5"/>
      {bars.map(([x,h,up],i) => (
        <g key={i}>
          <line x1={x} y1={40-Number(h)-3} x2={x} y2={43} stroke={C.g1} strokeWidth="0.6"/>
          <rect x={Number(x)-2.5} y={40-Number(h)} width="5" height={Number(h)} fill={up?C.g1:'transparent'} stroke={C.g1} strokeWidth="0.6"/>
        </g>
      ))}
      <path d="M 14 36 L 20 30 L 28 32 L 36 24 L 44 20 L 50 22" fill="none" stroke={C.g1} strokeWidth="0.8" opacity="0.7"/>
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="26" fill="none" stroke={C.g3} strokeWidth="0.6" strokeDasharray="1 3"/>
      <rect x="14" y="16" width="36" height="32" fill="none" stroke={C.g1} strokeWidth="0.8"/>
      <line x1="14" y1="24" x2="50" y2="24" stroke={C.g1} strokeWidth="0.6"/>
      <line x1="22" y1="16" x2="22" y2="12" stroke={C.g1} strokeWidth="0.8"/>
      <line x1="42" y1="16" x2="42" y2="12" stroke={C.g1} strokeWidth="0.8"/>
      {[0,1,2,3].map(r=>[0,1,2,3,4].map(col=>{
        const hi=(r===1&&col===2)||(r===2&&col===4);
        return <circle key={`${r}-${col}`} cx={18+col*7} cy={30+r*5} r={hi?1.6:0.8} fill={hi?C.g1:C.g3}/>;
      }))}
    </svg>
  );
}

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="26" fill="none" stroke={C.g3} strokeWidth="0.6" strokeDasharray="1 3"/>
      <path d="M 32 14 L 48 20 L 48 34 Q 48 46 32 52 Q 16 46 16 34 L 16 20 Z" fill="none" stroke={C.g1} strokeWidth="0.8"/>
      <path d="M 32 22 L 40 26 L 40 34 Q 40 42 32 46 Q 24 42 24 34 L 24 26 Z" fill="none" stroke={C.g1} strokeWidth="0.5" opacity="0.6"/>
      <text x="32" y="36" textAnchor="middle" fontFamily="Cormorant Garamond,serif" fontStyle="italic" fontSize="14" fill={C.g1}>ॐ</text>
    </svg>
  );
}

function ScannerGlyph() {
  // Horizontal scan lines over a 3×3 dot grid — "filtering" visual
  const dots: [number, number][] = [
    [18,20],[32,20],[46,20],
    [18,32],[32,32],[46,32],
    [18,44],[32,44],[46,44],
  ];
  return (
    <svg viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="26" fill="none" stroke={C.g3} strokeWidth="0.6" strokeDasharray="1 3"/>
      {dots.map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={1.4} fill={C.g3}/>
      ))}
      {/* Highlighted dots — those "passing" the scan */}
      <circle cx="32" cy="20" r="2.2" fill={C.g1}/>
      <circle cx="46" cy="32" r="2.2" fill={C.g1}/>
      <circle cx="18" cy="44" r="2.2" fill={C.g1}/>
      {/* Scan sweep line */}
      <line x1="12" y1="32" x2="52" y2="32" stroke={C.g1} strokeWidth="0.5" opacity="0.5"/>
      {/* ✦ marker top-right */}
      <text x="50" y="17" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="8" fill={C.g1} opacity="0.9">✦</text>
    </svg>
  );
}

// ── Lens glyphs (for the "two lenses" row) ────────────────────────────────
function AncientLens() {
  return (
    <svg viewBox="0 0 64 64" width="56" height="56">
      <circle cx="32" cy="32" r="24" fill="none" stroke={C.g1} strokeWidth="0.7"/>
      <circle cx="32" cy="32" r="18" fill="none" stroke={C.g3} strokeWidth="0.5"/>
      <circle cx="32" cy="32" r="12" fill="none" stroke={C.g1} strokeWidth="0.5" opacity="0.6"/>
      {[0,45,90,135,180,225,270,315].map(d=>{
        const a=(d-90)*Math.PI/180;
        return <line key={d} x1={32+18*Math.cos(a)} y1={32+18*Math.sin(a)} x2={32+24*Math.cos(a)} y2={32+24*Math.sin(a)} stroke={C.g1} strokeWidth="0.6"/>;
      })}
      <circle cx="32" cy="32" r="2" fill={C.g1}/>
      <text x="32" y="58" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="6" fill={C.g3} letterSpacing="1.5">LENS I</text>
    </svg>
  );
}

function ModernLens() {
  const bars: [number,number,boolean][] = [[14,8,true],[20,14,false],[26,6,true],[32,18,false],[38,10,true],[44,16,false],[50,22,true]];
  return (
    <svg viewBox="0 0 64 64" width="56" height="56">
      <rect x="10" y="12" width="44" height="32" fill="none" stroke={C.g1} strokeWidth="0.7"/>
      <line x1="10" y1="36" x2="54" y2="36" stroke={C.g3} strokeWidth="0.4"/>
      {bars.map(([x,h,up],i)=>(
        <g key={i}>
          <line x1={x} y1={36-Number(h)-2} x2={x} y2={39} stroke={C.g1} strokeWidth="0.5"/>
          <rect x={Number(x)-1.6} y={36-Number(h)} width="3.2" height={Number(h)} fill={up?C.g1:'transparent'} stroke={C.g1} strokeWidth="0.5"/>
        </g>
      ))}
      <path d="M 12 32 L 18 28 L 24 30 L 30 22 L 36 26 L 42 18 L 50 20" fill="none" stroke={C.g1} strokeWidth="0.6" opacity="0.6"/>
      <text x="32" y="58" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="6" fill={C.g3} letterSpacing="1.5">LENS II</text>
    </svg>
  );
}

// ── Pillars data ──────────────────────────────────────────────────────────
const PILLARS = [
  { n:'02.A', glyph:<MoonGlyph/>,     title:'Panchāṅgam Atmosphere Engine',   body:'Daily Tithi, Nakṣatra, Yoga, Karaṇa and Vāra — mapped to historical market behavior patterns on Indian indices. Know the atmospheric character of every trading day.',          meta:'5 time-cycle axes · NIFTY · BANKNIFTY · SENSEX' },
  { n:'02.B', glyph:<ChartGlyph/>,    title:'Astro-Technical Confluence',      body:'When Vedic time signals and classical technical setups — breakouts, momentum, volume surges — align on the same day, that is your window of heightened atmospheric attention.',    meta:'14 classical patterns · 27 Nakṣatra states' },
  { n:'02.C', glyph:<CalendarGlyph/>, title:'Astro Calendar — 2026 and beyond',body:'Key astronomical events pre-mapped to the market calendar — know the high-attention windows months in advance. Time cycles repeat. Be prepared.',                                meta:'Forward-mapped through 2030' },
  { n:'02.D', glyph:<ScannerGlyph/>,  title:'Scanner — Atmospheric Stock Intelligence', body:'Eight precision scans across 1,380+ NSE equities. Each scan combines classical technical filters — MagicRS relative strength, institutional flow, Wyckoff accumulation patterns, breakout detection — with the day\'s atmospheric window. Stocks that pass both gates are surfaced with the VaNi ✦ opportunity flag.', subtext:'Not a buy list. A filtered attention list — within today\'s conditions.', meta:'8 scan presets · 1,380+ scrips · VaNi ✦ flagged' },
];

export function Pillars() {
  return (
    <section id="layer" style={{ position:'relative', padding:'120px 0', borderTop:`1px solid ${C.rs}`, borderBottom:`1px solid ${C.rs}` }}>
      <SectionHeader
        idx="§ 02" label="The Layer"
        title={<>A new layer of<br/><em style={{ color:C.g1 }}>market atmosphere.</em></>}
        lede="Two independent engines — Panchāṅgam cycle intelligence and classical market technicals — surfaced through four instruments. Indexed to live NSE/BSE data."
      />

      <div className="dq-wrap" style={{ marginTop:72 }}>
        {/* Two lenses signature row */}
        <FadeUp>
          <div className="dq-two-lenses" style={{ border:`1px solid ${C.rule}`, background:`linear-gradient(180deg,rgba(245,166,35,0.04),rgba(19,22,29,0.3))`, padding:'48px 44px', marginBottom:1, display:'grid', gridTemplateColumns:'auto 1fr auto', gap:48, alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:28 }}>
              <AncientLens/>
              <div style={{ fontFamily:MONO, fontSize:22, color:C.g1, letterSpacing:'.08em' }}>⊕</div>
              <ModernLens/>
            </div>
            <div>
              <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.24em', color:C.g2, marginBottom:12 }}>◇ 02.0 — FOUNDATIONAL</div>
              <h3 style={{ fontFamily:SERIF, fontSize:30, color:C.ink1, margin:'0 0 14px', lineHeight:1.15, letterSpacing:'-0.01em' }}>Two independent lenses. <em style={{ color:C.g1 }}>One convergence.</em></h3>
              <p style={{ margin:0, color:C.ink2, fontSize:14.5, lineHeight:1.6, maxWidth:'70ch', fontFamily:SANS }}>
                DristiQ runs two parallel engines — a Panchāṅgam time-cycle engine drawing from Vedic astronomy, and a technical market data engine tracking price action, volume, and momentum on NSE/BSE. <em style={{ color:C.g1, fontStyle:'italic' }}>When both point in the same direction — that is atmospheric data worth paying attention to.</em>
              </p>
            </div>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.22em', color:C.ink4, textAlign:'right' as const, lineHeight:1.8 }}>
              LENS I · PANCHĀṄGAM<br/>LENS II · TECHNICAL<br/><span style={{ color:C.g2 }}>⟶ CONVERGENCE</span>
            </div>
          </div>
        </FadeUp>

        {/* 4 pillar cards */}
        <div className="dq-pillar-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, background:C.rule, border:`1px solid ${C.rule}`, borderTop:'none' }}>
          {PILLARS.map((p,i) => (
            <FadeUp key={p.n} delay={i*60}>
              <div className="dq-pillar-card" style={{ background:C.bg1, padding:'44px 40px', height:'100%', position:'relative' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
                  <div style={{ width:64, height:64 }}>{p.glyph}</div>
                  <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.24em', color:C.ink4 }}>§ {p.n}</div>
                </div>
                <h3 style={{ fontFamily:SERIF, fontSize:30, color:C.ink1, margin:'0 0 18px', lineHeight:1.12, letterSpacing:'-0.01em', maxWidth:'18ch' }}>{p.title}</h3>
                <p style={{ margin:'0 0 16px', color:C.ink2, fontSize:14.5, lineHeight:1.6, maxWidth:'42ch', fontFamily:SANS }}>{p.body}</p>
                {'subtext' in p && p.subtext && (
                  <p style={{ margin:'0 0 24px', color:C.g2, fontSize:12.5, lineHeight:1.5, maxWidth:'42ch', fontFamily:SANS, fontStyle:'italic' }}>{p.subtext}</p>
                )}
                <hr style={{ border:0, height:1, background:C.rs, margin:'0 0 16px' }}/>
                <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.18em', color:C.g2 }}>{p.meta}</div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
