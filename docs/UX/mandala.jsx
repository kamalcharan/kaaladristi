/* Panchangam Mandala — restrained, 4 rings, Nakshatra tick marks
   Composes with a candlestick chart overlay in merged mode */

const { useEffect, useRef, useState } = React;

function PanchangamMandala({ size = 560, merged = true, chartOpacity = 1, variant = 'merged' }) {
  const cx = size / 2, cy = size / 2;
  const rings = [size*0.48, size*0.40, size*0.32, size*0.24, size*0.14];
  const gold1 = '#e2b96f', gold2 = '#c9a84c', gold3 = '#8a6f28';

  // 27 Nakshatras — sanskrit-adjacent abbreviations
  const nakshatras = ['Aśv','Bha','Kṛt','Roh','Mṛg','Ārd','Pun','Puṣ','Āśl','Maghā','P.Phal','U.Phal','Has','Cit','Svā','Viś','Anu','Jyeṣ','Mūl','P.Aṣā','U.Aṣā','Śra','Dha','Śat','P.Bhā','U.Bhā','Rev'];

  // 12 zodiac marks
  const zodiac = ['meṣa','vṛṣa','mith','karka','siṃha','kanyā','tulā','vṛści','dhanu','makara','kumbha','mīna'];

  // 15 tithi ticks for the outer ring
  const tithis = Array.from({length: 30}, (_, i) => i);

  const polar = (r, deg) => {
    const a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{display:'block', overflow:'visible'}}>
      <defs>
        <radialGradient id="mgrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a1040" stopOpacity="0.25"/>
          <stop offset="60%" stopColor="#0d0d1a" stopOpacity="0.1"/>
          <stop offset="100%" stopColor="#0a0a12" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="coreglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f4ecd6" stopOpacity="0.9"/>
          <stop offset="30%" stopColor="#e2b96f" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#c9a84c" stopOpacity="0"/>
        </radialGradient>
        <filter id="softglow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* atmospheric backing */}
      <circle cx={cx} cy={cy} r={rings[0]+10} fill="url(#mgrad)"/>

      {/* Ring 1 — outermost: 27 nakshatra divisions, slow-rotating */}
      <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'slowspin 240s linear infinite' }}>
        <circle cx={cx} cy={cy} r={rings[0]} fill="none" stroke={gold2} strokeWidth="0.8" opacity="0.75"/>
        <circle cx={cx} cy={cy} r={rings[1]} fill="none" stroke={gold3} strokeWidth="0.5" opacity="0.6"/>
        {nakshatras.map((n, i) => {
          const deg = (i / 27) * 360;
          const [x1, y1] = polar(rings[1], deg);
          const [x2, y2] = polar(rings[0], deg);
          const [tx, ty] = polar(rings[0] + 18, deg);
          return (
            <g key={`n${i}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={gold2} strokeWidth="0.6" opacity="0.7"/>
              <text x={tx} y={ty} fill={gold1} fontFamily="JetBrains Mono, monospace" fontSize="8" textAnchor="middle" dominantBaseline="middle" opacity="0.7"
                transform={`rotate(${deg} ${tx} ${ty})`}>
                {n}
              </text>
            </g>
          );
        })}
        {/* cardinal markers - brighter */}
        {[0, 90, 180, 270].map(d => {
          const [x1,y1] = polar(rings[1]-4, d);
          const [x2,y2] = polar(rings[0]+6, d);
          return <line key={`c${d}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={gold1} strokeWidth="1.2"/>;
        })}
      </g>

      {/* Ring 2 — 12 zodiac, counter-rotating */}
      <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'slowspinrev 360s linear infinite' }}>
        <circle cx={cx} cy={cy} r={rings[2]} fill="none" stroke={gold3} strokeWidth="0.6" opacity="0.55"/>
        {zodiac.map((z, i) => {
          const deg = (i / 12) * 360 + 15;
          const [x1, y1] = polar(rings[2], deg - 15);
          const [x2, y2] = polar(rings[1], deg - 15);
          const [tx, ty] = polar((rings[1]+rings[2])/2, deg);
          return (
            <g key={`z${i}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={gold3} strokeWidth="0.5" opacity="0.55"/>
              <text x={tx} y={ty} fill={gold2} fontFamily="Cormorant Garamond, serif" fontStyle="italic" fontSize="11" textAnchor="middle" dominantBaseline="middle" opacity="0.8">
                {z}
              </text>
            </g>
          );
        })}
      </g>

      {/* Ring 3 — tithi tick ring, slow spin */}
      <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'slowspin 180s linear infinite' }}>
        <circle cx={cx} cy={cy} r={rings[3]} fill="none" stroke={gold2} strokeWidth="0.5" opacity="0.4"/>
        {tithis.map(i => {
          const deg = (i / 30) * 360;
          const len = i % 5 === 0 ? 8 : 4;
          const [x1, y1] = polar(rings[3], deg);
          const [x2, y2] = polar(rings[3] - len, deg);
          return <line key={`t${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={gold1} strokeWidth={i%5===0?0.9:0.5} opacity={i%5===0?0.85:0.5}/>;
        })}
      </g>

      {/* diagonals — instrument aesthetic */}
      <g opacity="0.18">
        {[30, 60, 120, 150].map(d => {
          const [x1,y1] = polar(rings[0], d);
          const [x2,y2] = polar(rings[0], d+180);
          return <line key={`d${d}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={gold2} strokeWidth="0.4"/>;
        })}
      </g>

      {/* The merged candlestick arc — sits inside ring 4, convergence zone */}
      {variant !== 'mandala' && (
        <g opacity={chartOpacity} style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <CandleArc cx={cx} cy={cy} r={rings[3]*0.78} />
        </g>
      )}

      {/* core glow */}
      <circle cx={cx} cy={cy} r={rings[4]*0.6} fill="url(#coreglow)" filter="url(#softglow)" style={{animation:'breathe 5s ease-in-out infinite', transformOrigin: `${cx}px ${cy}px`}}/>
      <circle cx={cx} cy={cy} r="3" fill="#f4ecd6"/>

      {/* outer reticle */}
      <circle cx={cx} cy={cy} r={rings[0]+24} fill="none" stroke={gold3} strokeWidth="0.3" opacity="0.4" strokeDasharray="1 6"/>
    </svg>
  );
}

/* Candlestick "arc" — candles arranged around a horizon, converging with the mandala */
function CandleArc({ cx, cy, r }) {
  // line chart of prices as a horizontal run inside the mandala core
  const N = 22;
  const W = r * 2.2;
  const x0 = cx - W/2;
  const seed = [0.5,0.55,0.48,0.6,0.65,0.58,0.62,0.7,0.66,0.55,0.48,0.52,0.6,0.72,0.78,0.7,0.68,0.75,0.82,0.78,0.72,0.8];
  const step = W / (N-1);
  const yFor = v => cy + (0.5 - v) * r * 1.4;

  // candles
  const candles = seed.map((v,i) => {
    const open = i === 0 ? v : seed[i-1];
    const close = v;
    const high = Math.max(open, close) + 0.02 + Math.random()*0.02;
    const low = Math.min(open, close) - 0.02 - Math.random()*0.02;
    const x = x0 + i*step;
    return { x, open: yFor(open), close: yFor(close), high: yFor(high), low: yFor(low), up: close >= open };
  });

  // sparkline
  const path = seed.map((v,i) => `${i===0?'M':'L'} ${x0+i*step} ${yFor(v)}`).join(' ');

  return (
    <g>
      {/* horizon baseline */}
      <line x1={x0-10} y1={cy} x2={x0+W+10} y2={cy} stroke="#8a6f28" strokeWidth="0.4" opacity="0.5" strokeDasharray="2 4"/>
      {/* candles */}
      {candles.map((c,i) => (
        <g key={i} opacity="0.9">
          <line x1={c.x} y1={c.low} x2={c.x} y2={c.high} stroke={c.up ? '#e2b96f' : '#8a6f28'} strokeWidth="0.8"/>
          <rect x={c.x-2} y={Math.min(c.open,c.close)} width="4" height={Math.abs(c.close-c.open)+1}
            fill={c.up ? 'rgba(226,185,111,0.9)' : 'rgba(13,13,26,0.9)'}
            stroke={c.up ? '#f4ecd6' : '#e2b96f'} strokeWidth="0.6"/>
        </g>
      ))}
      {/* convergence glow */}
      <circle cx={cx} cy={cy} r={r*0.9} fill="none" stroke="#e2b96f" strokeWidth="0.6" opacity="0.3"/>
      <path d={path} fill="none" stroke="#f4ecd6" strokeWidth="1" opacity="0.7"/>
    </g>
  );
}

window.PanchangamMandala = PanchangamMandala;
