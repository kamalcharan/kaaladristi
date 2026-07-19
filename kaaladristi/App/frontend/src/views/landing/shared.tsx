import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { C, SERIF, MONO, SANS, polar } from './tokens';

// ── FadeUp (intersection observer) ───────────────────────────────────────
export function FadeUp({
  children, delay = 0, style = {},
}: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => el.classList.add('dq-in'), delay); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <div ref={ref} className="dq-fade" style={style}>{children}</div>;
}

// ── Starfield ─────────────────────────────────────────────────────────────
type Star = { x: number; y: number; r: number; op: number; dur: number; del: number; gold: boolean };
const STARS: Star[] = Array.from({ length: 220 }, () => ({
  x: Math.random() * 100, y: Math.random() * 100,
  r: +(Math.random() * 1.1 + 0.2).toFixed(2),
  op: +(Math.random() * 0.6 + 0.2).toFixed(2),
  dur: +(Math.random() * 4 + 3).toFixed(1),
  del: +(Math.random() * 4).toFixed(1),
  gold: Math.random() > 0.85,
}));

export function Starfield() {
  return (
    <svg style={{ position:'fixed', inset:0, width:'100%', height:'100%', zIndex:1, pointerEvents:'none', opacity:.85 }}
         preserveAspectRatio="xMidYMid slice">
      {STARS.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill={s.gold ? C.g1 : C.ink1} opacity={s.op}>
          <animate attributeName="opacity"
            values={`${s.op};${+(s.op * 0.2).toFixed(2)};${s.op}`}
            dur={`${s.dur}s`} begin={`${s.del}s`} repeatCount="indefinite"/>
        </circle>
      ))}
    </svg>
  );
}

// ── LogoMark ──────────────────────────────────────────────────────────────
export function LogoMark({ size = 28 }: { size?: number }) {
  const ticks = [0,45,90,135,180,225,270,315].map(d => {
    const a = (d - 90) * Math.PI / 180;
    return { x1: 16+12*Math.cos(a), y1: 16+12*Math.sin(a), x2: 16+14*Math.cos(a), y2: 16+14*Math.sin(a) };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display:'block' }}>
      <circle cx="16" cy="16" r="14" fill="none" stroke={C.g2} strokeWidth="0.8"/>
      <circle cx="16" cy="16" r="10" fill="none" stroke={C.g2} strokeWidth="0.5" opacity=".7"/>
      <circle cx="16" cy="16" r="5"  fill="none" stroke={C.g1} strokeWidth="0.5"/>
      {ticks.map((t,i) => <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={C.g1} strokeWidth="0.8"/>)}
      <circle cx="16" cy="16" r="1.5" fill={C.g1}/>
    </svg>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const smooth = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav style={{
      position:'fixed', top:0, left:0, right:0, zIndex:50,
      padding: scrolled ? '12px 0' : '22px 0',
      background: scrolled ? 'rgba(13,15,20,0.72)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px) saturate(140%)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(12px) saturate(140%)' : 'none',
      borderBottom: scrolled ? `1px solid ${C.rs}` : '1px solid transparent',
      transition: 'all .35s ease',
    }}>
      <div className="dq-wrap" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <LogoMark size={28}/>
          <div style={{ display:'flex', flexDirection:'column', lineHeight:1.1 }}>
            <span style={{ fontFamily:SERIF, fontSize:22, color:C.ink1, letterSpacing:'-0.01em' }}>
              Dristi<span style={{ color:C.g1 }}>Q</span>
            </span>
            <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:'.22em', textTransform:'uppercase', color:C.ink3 }}>
              By Vikuna Technologies
            </span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:28 }}>
          <div className="dq-nav-links" style={{ fontFamily:MONO, display:'flex', gap:22, fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:C.ink3 }}>
            {[['insight','The Insight'],['layer','Layer'],['vani','VaNi'],['origin','Origin']].map(([id,label]) => (
              <a key={id} href={`#${id}`} onClick={smooth(id)} className="dq-navlink">{label}</a>
            ))}
          </div>
          <button onClick={() => navigate('/login')} className="dq-btn" style={{ padding:'10px 18px', fontSize:11 }}>
            Explore Beta <span className="dq-arrow">→</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────
export function SectionHeader({ idx, label, title, lede, center = false }: {
  idx: string; label: string; title: React.ReactNode; lede?: string; center?: boolean;
}) {
  return (
    <div className="dq-wrap" style={{ textAlign: center ? 'center' : 'left' }}>
      <FadeUp>
        <div className="dq-section-label" style={{ justifyContent: center ? 'center' : 'flex-start' }}>
          <span style={{ color:C.ink4 }}>{idx}</span><span>{label}</span>
        </div>
      </FadeUp>
      <FadeUp delay={80}>
        <h2 style={{
          fontFamily:SERIF, fontWeight:400, color:C.ink1,
          fontSize:'clamp(32px,4.2vw,56px)', lineHeight:1.08, letterSpacing:'-0.02em',
          margin: center ? '0 auto 20px' : '0 0 20px',
          maxWidth: center ? '22ch' : '18ch',
        }}>{title}</h2>
      </FadeUp>
      {lede && (
        <FadeUp delay={160}>
          <p style={{ fontFamily:SANS, fontSize:17, lineHeight:1.6, color:C.ink2, maxWidth: center ? '58ch' : '56ch', margin: center ? '0 auto' : 0 }}>{lede}</p>
        </FadeUp>
      )}
    </div>
  );
}

// ── Yantra (for VaNi section) ─────────────────────────────────────────────
export function Yantra({ size = 260 }: { size?: number }) {
  const cx = size/2, cy = size/2;
  const tri = (r: number, phase = 0) =>
    [0,120,240].map(d => { const a=(d+phase-90)*Math.PI/180; return `${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`; }).join(' ');
  const dots = [0,60,120,180,240,300].map(d => {
    const a=(d-90)*Math.PI/180; return { x: cx+size*0.36*Math.cos(a), y: cy+size*0.36*Math.sin(a) };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{ overflow:'visible' }}>
      <defs>
        <radialGradient id="dq-yglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.ink1} stopOpacity="1"/>
          <stop offset="40%" stopColor={C.g1}  stopOpacity="0.6"/>
          <stop offset="100%" stopColor={C.g1}  stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={size*0.42} fill="none" stroke={C.g3} strokeWidth="0.5" opacity=".5" strokeDasharray="1 4"/>
      <circle cx={cx} cy={cy} r={size*0.36} fill="none" stroke={C.g2} strokeWidth="0.6" opacity=".6"/>
      <g style={{ transformOrigin:`${cx}px ${cy}px`, animation:'slowspin 60s linear infinite' }}>
        <polygon points={tri(size*0.32,0)}   fill="none" stroke={C.g1} strokeWidth="0.7" opacity=".8"/>
        <polygon points={tri(size*0.32,180)} fill="none" stroke={C.g1} strokeWidth="0.7" opacity=".8"/>
      </g>
      <g style={{ transformOrigin:`${cx}px ${cy}px`, animation:'slowspinrev 90s linear infinite' }}>
        <polygon points={tri(size*0.22,30)}  fill="none" stroke={C.g2} strokeWidth="0.6" opacity=".7"/>
        <polygon points={tri(size*0.22,210)} fill="none" stroke={C.g2} strokeWidth="0.6" opacity=".7"/>
      </g>
      <circle cx={cx} cy={cy} r={size*0.12} fill="url(#dq-yglow)"
        style={{ animation:'breathe 4s ease-in-out infinite', transformOrigin:`${cx}px ${cy}px` }}/>
      <circle cx={cx} cy={cy} r="2.5" fill={C.ink1}/>
      {dots.map((d,i) => <circle key={i} cx={d.x} cy={d.y} r="1.4" fill={C.g1}/>)}
    </svg>
  );
}

// ── Hair rule ─────────────────────────────────────────────────────────────
export function Hair({ soft = false }: { soft?: boolean }) {
  return <hr style={{ border:0, margin:0, height:1, background: soft ? C.rs : C.rule }}/>;
}
