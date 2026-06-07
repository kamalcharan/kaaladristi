/* Shared atoms: Sparkline, MiniBars, NumPill, SectionHeader, Gauge */

const { useState: useS, useEffect: useE, useRef: useR } = React;

function Spark({ data, color='#e2b96f', fill=true, w=120, h=40 }) {
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const pts = data.map((v,i) => [i/(data.length-1)*w, h - ((v-min)/rng)*h*0.85 - 4]);
  const d = pts.map((p,i) => `${i===0?'M':'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const fillD = d + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{display:'block'}}>
      {fill && <path d={fillD} fill={color} opacity="0.1"/>}
      <path d={d} fill="none" stroke={color} strokeWidth="1.2"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2" fill={color}/>
    </svg>
  );
}

function MiniBars({ data, w=120, h=40 }) {
  // data: array of {v, sign} or numbers; we assume -1,0,1 to encode direction
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{display:'block'}}>
      {data.map((v,i) => {
        const col = v > 0 ? '#6ecf9a' : v < 0 ? '#d97a6c' : '#50493c';
        const bh = Math.abs(v)*h*0.8 + 4;
        const x = i*(w/data.length) + 2;
        const bw = w/data.length - 4;
        const y = v>=0 ? h/2 - bh : h/2;
        return <rect key={i} x={x} y={y} width={bw} height={bh} fill={col}/>;
      })}
      <line x1="0" y1={h/2} x2={w} y2={h/2} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5"/>
    </svg>
  );
}

function Donut({ pct, color='#e2b96f', size=64 }) {
  const r = size/2 - 4;
  const c = 2*Math.PI*r;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${c*pct/100} ${c}`} strokeDashoffset={c*0.25} transform={`rotate(-90 ${size/2} ${size/2})`}/>
    </svg>
  );
}

/* Logo */
function Logo({ size=22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="none" stroke="#c9a84c" strokeWidth="0.8"/>
      <circle cx="16" cy="16" r="9" fill="none" stroke="#c9a84c" strokeWidth="0.5" opacity=".7"/>
      {[0,45,90,135,180,225,270,315].map(d => {
        const a = (d-90)*Math.PI/180;
        return <line key={d} x1={16+12*Math.cos(a)} y1={16+12*Math.sin(a)} x2={16+14*Math.cos(a)} y2={16+14*Math.sin(a)} stroke="#e2b96f" strokeWidth="0.8"/>;
      })}
      <circle cx="16" cy="16" r="1.5" fill="#e2b96f"/>
    </svg>
  );
}

/* Sign colors */
const signColor = s => s==='pos' ? 'var(--green)' : s==='neg' ? 'var(--red)' : s==='gold' ? 'var(--gold-1)' : 'var(--ink-2)';

Object.assign(window, { Spark, MiniBars, Donut, Logo, signColor });
