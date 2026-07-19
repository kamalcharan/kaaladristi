import { C, SERIF, MONO, polar } from './tokens';

// ── CandleArc ─────────────────────────────────────────────────────────────
function CandleArc({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const seed = [0.5,0.55,0.48,0.6,0.65,0.58,0.62,0.7,0.66,0.55,0.48,0.52,0.6,0.72,0.78,0.7,0.68,0.75,0.82,0.78,0.72,0.8];
  const W = r * 2.2, x0 = cx - W / 2, step = W / (seed.length - 1);
  const yFor = (v: number) => cy + (0.5 - v) * r * 1.4;
  const candles = seed.map((v, i) => {
    const open = i === 0 ? v : seed[i - 1];
    return { x: x0+i*step, open: yFor(open), close: yFor(v), high: yFor(Math.max(open,v)+0.02), low: yFor(Math.min(open,v)-0.02), up: v >= open };
  });
  const path = seed.map((v,i) => `${i===0?'M':'L'} ${(x0+i*step).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ');
  return (
    <g>
      <line x1={x0-10} y1={cy} x2={x0+W+10} y2={cy} stroke={C.g3} strokeWidth="0.4" opacity="0.5" strokeDasharray="2 4"/>
      {candles.map((c,i) => (
        <g key={i} opacity="0.9">
          <line x1={c.x} y1={c.low} x2={c.x} y2={c.high} stroke={c.up?C.g1:C.g3} strokeWidth="0.8"/>
          <rect x={c.x-2} y={Math.min(c.open,c.close)} width="4" height={Math.abs(c.close-c.open)+1}
            fill={c.up?'rgba(245,166,35,0.9)':'rgba(28,32,48,0.9)'}
            stroke={c.up?C.ink1:C.g1} strokeWidth="0.6"/>
        </g>
      ))}
      <circle cx={cx} cy={cy} r={r*0.9} fill="none" stroke={C.g1} strokeWidth="0.6" opacity="0.3"/>
      <path d={path} fill="none" stroke={C.ink1} strokeWidth="1" opacity="0.7"/>
    </g>
  );
}

// ── PanchangamMandala ─────────────────────────────────────────────────────
const NAKSHATRAS = ['Aśv','Bha','Kṛt','Roh','Mṛg','Ārd','Pun','Puṣ','Āśl','Maghā','P.Phal','U.Phal','Has','Cit','Svā','Viś','Anu','Jyeṣ','Mūl','P.Aṣā','U.Aṣā','Śra','Dha','Śat','P.Bhā','U.Bhā','Rev'];
const ZODIAC    = ['meṣa','vṛṣa','mith','karka','siṃha','kanyā','tulā','vṛści','dhanu','makara','kumbha','mīna'];

export function PanchangamMandala({ size = 560 }: { size?: number }) {
  const cx = size/2, cy = size/2;
  const [r0,r1,r2,r3,r4] = [size*0.48, size*0.40, size*0.32, size*0.24, size*0.14];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{ display:'block', overflow:'visible' }}>
      <defs>
        <radialGradient id="dq-mgrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#1c2030" stopOpacity="0.25"/>
          <stop offset="60%"  stopColor="#1c2030" stopOpacity="0.1"/>
          <stop offset="100%" stopColor="#13161d" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="dq-cg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={C.ink1} stopOpacity="0.9"/>
          <stop offset="30%"  stopColor={C.g1}   stopOpacity="0.5"/>
          <stop offset="100%" stopColor={C.g2}   stopOpacity="0"/>
        </radialGradient>
        <filter id="dq-sg" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <circle cx={cx} cy={cy} r={r0+10} fill="url(#dq-mgrad)"/>

      {/* Ring 1 — 27 Nakshatras, slow spin */}
      <g style={{ transformOrigin:`${cx}px ${cy}px`, animation:'slowspin 240s linear infinite' }}>
        <circle cx={cx} cy={cy} r={r0} fill="none" stroke={C.g2} strokeWidth="0.8" opacity="0.75"/>
        <circle cx={cx} cy={cy} r={r1} fill="none" stroke={C.g3} strokeWidth="0.5" opacity="0.6"/>
        {NAKSHATRAS.map((n,i) => {
          const deg=(i/27)*360;
          const [x1,y1]=polar(cx,cy,r1,deg),[x2,y2]=polar(cx,cy,r0,deg),[tx,ty]=polar(cx,cy,r0+18,deg);
          return (
            <g key={n}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.g2} strokeWidth="0.6" opacity="0.7"/>
              <text x={tx} y={ty} fill={C.g1} fontFamily={MONO} fontSize="8" textAnchor="middle"
                dominantBaseline="middle" opacity="0.7" transform={`rotate(${deg} ${tx} ${ty})`}>{n}</text>
            </g>
          );
        })}
        {[0,90,180,270].map(d => {
          const [x1,y1]=polar(cx,cy,r1-4,d),[x2,y2]=polar(cx,cy,r0+6,d);
          return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.g1} strokeWidth="1.2"/>;
        })}
      </g>

      {/* Ring 2 — 12 Zodiac, counter spin */}
      <g style={{ transformOrigin:`${cx}px ${cy}px`, animation:'slowspinrev 360s linear infinite' }}>
        <circle cx={cx} cy={cy} r={r2} fill="none" stroke={C.g3} strokeWidth="0.6" opacity="0.55"/>
        {ZODIAC.map((z,i) => {
          const [x1,y1]=polar(cx,cy,r2,(i/12)*360),[x2,y2]=polar(cx,cy,r1,(i/12)*360);
          const [tx,ty]=polar(cx,cy,(r1+r2)/2,(i/12)*360+15);
          return (
            <g key={z}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.g3} strokeWidth="0.5" opacity="0.55"/>
              <text x={tx} y={ty} fill={C.g2} fontFamily={SERIF} fontStyle="italic" fontSize="11"
                textAnchor="middle" dominantBaseline="middle" opacity="0.8">{z}</text>
            </g>
          );
        })}
      </g>

      {/* Ring 3 — Tithi ticks */}
      <g style={{ transformOrigin:`${cx}px ${cy}px`, animation:'slowspin 180s linear infinite' }}>
        <circle cx={cx} cy={cy} r={r3} fill="none" stroke={C.g2} strokeWidth="0.5" opacity="0.4"/>
        {Array.from({length:30},(_,i)=>i).map(i => {
          const deg=(i/30)*360, len=i%5===0?8:4;
          const [x1,y1]=polar(cx,cy,r3,deg),[x2,y2]=polar(cx,cy,r3-len,deg);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.g1} strokeWidth={i%5===0?0.9:0.5} opacity={i%5===0?0.85:0.5}/>;
        })}
      </g>

      {/* Diagonal instrument lines */}
      <g opacity="0.18">
        {[30,60,120,150].map(d => {
          const [x1,y1]=polar(cx,cy,r0,d),[x2,y2]=polar(cx,cy,r0,d+180);
          return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.g2} strokeWidth="0.4"/>;
        })}
      </g>

      {/* Candlestick convergence zone */}
      <CandleArc cx={cx} cy={cy} r={r3*0.78}/>

      {/* Core glow */}
      <circle cx={cx} cy={cy} r={r4*0.6} fill="url(#dq-cg)" filter="url(#dq-sg)"
        style={{ animation:'breathe 5s ease-in-out infinite', transformOrigin:`${cx}px ${cy}px` }}/>
      <circle cx={cx} cy={cy} r="3" fill={C.ink1}/>

      {/* Outer reticle */}
      <circle cx={cx} cy={cy} r={r0+24} fill="none" stroke={C.g3} strokeWidth="0.3" opacity="0.4" strokeDasharray="1 6"/>
    </svg>
  );
}
