/* Shared components: Navbar, SectionHeader, GlassCard, FadeUp, VaNiOrb */

const { useEffect: useEffectC, useRef: useRefC, useState: useStateC } = React;

function FadeUp({ children, delay = 0, as: As = 'div', className = '', style = {} }) {
  const ref = useRefC(null);
  useEffectC(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => el.classList.add('in'), delay); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <As ref={ref} className={`fade-up ${className}`} style={style}>{children}</As>;
}

function Navbar() {
  const [scrolled, setScrolled] = useStateC(false);
  useEffectC(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      padding: scrolled ? '12px 0' : '22px 0',
      background: scrolled ? 'rgba(7,7,12,0.72)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px) saturate(140%)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(12px) saturate(140%)' : 'none',
      borderBottom: scrolled ? '1px solid var(--rule-soft)' : '1px solid transparent',
      transition: 'all .35s ease'
    }}>
      <div className="wrap" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div style={{display:'flex', alignItems:'center', gap:14}}>
          <LogoMark size={28}/>
          <div style={{display:'flex', flexDirection:'column', lineHeight:1.1}}>
            <span className="serif" style={{fontSize:22, color:'var(--ink-1)', letterSpacing:'-0.01em'}}>Dristi<span style={{color:'var(--gold-1)'}}>Q</span></span>
            <span className="mono" style={{fontSize:9, letterSpacing:'.22em', textTransform:'uppercase', color:'var(--ink-3)'}}>By Vikuna Technologies</span>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:28}}>
          <div className="mono" style={{display:'flex', gap:22, fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--ink-3)'}}>
            <a href="#insight" className="navlink">The Insight</a>
            <a href="#layer" className="navlink">Layer</a>
            <a href="#vani" className="navlink">VaNi</a>
            <a href="#origin" className="navlink">Origin</a>
          </div>
          <a href="#beta" className="btn" style={{padding:'10px 18px', fontSize:11}}>
            Explore Beta <span className="arrow">→</span>
          </a>
        </div>
      </div>
      <style>{`
        .navlink { transition: color .2s ease; }
        .navlink:hover { color: var(--gold-1); }
        @media (max-width: 820px) { nav .mono { display: none !important; } }
      `}</style>
    </nav>
  );
}

function LogoMark({ size = 28 }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" style={{display:'block'}}>
      <circle cx="16" cy="16" r="14" fill="none" stroke="#c9a84c" strokeWidth="0.8"/>
      <circle cx="16" cy="16" r="10" fill="none" stroke="#c9a84c" strokeWidth="0.5" opacity=".7"/>
      <circle cx="16" cy="16" r="5" fill="none" stroke="#e2b96f" strokeWidth="0.5"/>
      {[0,45,90,135,180,225,270,315].map(d => {
        const a = (d-90)*Math.PI/180;
        return <line key={d} x1={16+12*Math.cos(a)} y1={16+12*Math.sin(a)} x2={16+14*Math.cos(a)} y2={16+14*Math.sin(a)} stroke="#e2b96f" strokeWidth="0.8"/>;
      })}
      <circle cx="16" cy="16" r="1.5" fill="#e2b96f"/>
    </svg>
  );
}

function SectionHeader({ idx, label, title, lede, align = 'left' }) {
  return (
    <div className="wrap" style={{textAlign: align}}>
      <FadeUp>
        <div className="section-label" style={{justifyContent: align==='center'?'center':'flex-start'}}>
          <span className="idx">{idx}</span><span>{label}</span>
        </div>
      </FadeUp>
      <FadeUp delay={80}>
        <h2 className="display" style={{maxWidth: align==='center'? '22ch': '18ch', margin: align==='center'?'0 auto 20px':'0 0 20px'}}>{title}</h2>
      </FadeUp>
      {lede && (
        <FadeUp delay={160}>
          <p className="lede" style={{margin: align==='center'?'0 auto':'0', maxWidth: align==='center'?'58ch':'56ch'}}>{lede}</p>
        </FadeUp>
      )}
    </div>
  );
}

/* Yantra — geometric neural-mandala for VaNi AI */
function Yantra({ size = 260 }) {
  const cx = size/2, cy = size/2;
  const polar = (r, deg) => {
    const a = (deg-90)*Math.PI/180;
    return [cx + r*Math.cos(a), cy + r*Math.sin(a)];
  };
  // triangles interlocked
  const tri = (r, phase=0) => {
    const pts = [0,120,240].map(d => polar(r, d+phase));
    return pts.map(p => p.join(',')).join(' ');
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{overflow:'visible'}}>
      <defs>
        <radialGradient id="yglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f4ecd6" stopOpacity="1"/>
          <stop offset="40%" stopColor="#e2b96f" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#e2b96f" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={size*0.42} fill="none" stroke="#8a6f28" strokeWidth="0.5" opacity=".5" strokeDasharray="1 4"/>
      <circle cx={cx} cy={cy} r={size*0.36} fill="none" stroke="#c9a84c" strokeWidth="0.6" opacity=".6"/>
      <g style={{transformOrigin:`${cx}px ${cy}px`, animation:'slowspin 60s linear infinite'}}>
        <polygon points={tri(size*0.32, 0)} fill="none" stroke="#e2b96f" strokeWidth="0.7" opacity=".8"/>
        <polygon points={tri(size*0.32, 180)} fill="none" stroke="#e2b96f" strokeWidth="0.7" opacity=".8"/>
      </g>
      <g style={{transformOrigin:`${cx}px ${cy}px`, animation:'slowspinrev 90s linear infinite'}}>
        <polygon points={tri(size*0.22, 30)} fill="none" stroke="#c9a84c" strokeWidth="0.6" opacity=".7"/>
        <polygon points={tri(size*0.22, 210)} fill="none" stroke="#c9a84c" strokeWidth="0.6" opacity=".7"/>
      </g>
      <circle cx={cx} cy={cy} r={size*0.12} fill="url(#yglow)" style={{animation:'breathe 4s ease-in-out infinite', transformOrigin:`${cx}px ${cy}px`}}/>
      <circle cx={cx} cy={cy} r="2.5" fill="#f4ecd6"/>
      {/* small satellite dots */}
      {[0,60,120,180,240,300].map(d => {
        const [x,y] = polar(size*0.36, d);
        return <circle key={d} cx={x} cy={y} r="1.4" fill="#e2b96f"/>;
      })}
    </svg>
  );
}

Object.assign(window, { FadeUp, Navbar, SectionHeader, LogoMark, Yantra });
