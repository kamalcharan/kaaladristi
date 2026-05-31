import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { updateProfile } from '@/services/auth'
import { PAID_TIERS } from '@/constants/frameworkConstants'
import { getTemplateForICP } from '@/constants/frameworkTemplates'
import type { FrameworkTemplate } from '@/constants/frameworkTemplates'
import { from } from '@/services/postgrest'

type Step = 1 | 2 | 3 | 4
type ICP  = 'investor' | 'trader' | 'both'

// ── Keyframe animations ───────────────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes orb-morph {
    0%   { border-radius: 38% 62% 55% 45% / 41% 44% 56% 59%; }
    33%  { border-radius: 60% 40% 38% 62% / 55% 38% 62% 45%; }
    66%  { border-radius: 45% 55% 62% 38% / 30% 60% 40% 70%; }
    100% { border-radius: 38% 62% 44% 56% / 50% 55% 45% 50%; }
  }
  @keyframes orb-pulse {
    0%, 100% { box-shadow: 0 0 40px rgba(124,106,247,.7), 0 0 80px rgba(124,106,247,.3); }
    50%      { box-shadow: 0 0 60px rgba(124,106,247,.9), 0 0 120px rgba(124,106,247,.4); }
  }
  @keyframes ring-spin-cw  { to { transform: translate(-50%,-50%) rotate(360deg);  } }
  @keyframes ring-spin-ccw { to { transform: translate(-50%,-50%) rotate(-360deg); } }
  @keyframes badge-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: .4; transform: scale(.7); }
  }
  @keyframes card-rise {
    from { opacity: 0; transform: translateY(28px) scale(.96); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes text-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes bubble-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes typing-dot {
    0%, 60%, 100% { opacity: .2; transform: scale(.8); }
    30%           { opacity: 1;  transform: scale(1.1); }
  }
  @keyframes particle-float {
    from { opacity: .2; transform: translate(0, 0); }
    to   { opacity: .8; transform: translate(var(--px), var(--py)); }
  }
`

// ── Block animation metadata ──────────────────────────────────────────────────

interface AnimItem {
  catalog_item_id: string
  icon: string
  display_name: string
  type_label: string
  narration: string    // exact strings from spec Section 4.3
  badge: string
}

// Canonical order + display metadata — narrations are exact from spec §4.3
const ANIM_ORDER = [
  'ema_20', 'sma_50', 'rsi_14',
  'magic_rs', 'astro_rule:panchak',
  'conviction_flow', 'breadth_roc', 'six_day_outlook',
]

const BLOCK_META: Record<string, Omit<AnimItem, 'catalog_item_id'>> = {
  'ema_20': {
    icon: '〰️', display_name: 'EMA 20 / SMA 50', type_label: 'Indicator',
    narration: 'Starting with trend context — baseline direction first.',
    badge: 'Chart Overlay',
  },
  'sma_50': {
    icon: '〰️', display_name: 'SMA 50', type_label: 'Indicator',
    narration: 'SMA 50 — mid-term institutional reference on the chart.',
    badge: 'Chart Overlay',
  },
  'rsi_14': {
    icon: '📊', display_name: 'RSI 14', type_label: 'Indicator',
    narration: 'RSI 14 — momentum oscillator. Tells you when moves are extended.',
    badge: 'Panel Block',
  },
  'magic_rs': {
    icon: '⚡', display_name: 'MagicRS', type_label: 'Widget · DristiQ IP',
    narration: "Adding DristiQ's proprietary relative strength signal.",
    badge: 'Panel Block',
  },
  'astro_rule:panchak': {
    icon: '🪐', display_name: 'Panchak', type_label: 'Astro Rule',
    narration: 'Overlaying Panchak on the chart — caution zones visible on price.',
    badge: 'Chart Overlay + Panel',
  },
  'conviction_flow': {
    icon: '🔍', display_name: 'Conviction Flow', type_label: 'Scanner',
    narration: "Running the scanner — today's results will load here.",
    badge: 'Output Panel',
  },
  'breadth_roc': {
    icon: '📈', display_name: 'Breadth ROC', type_label: 'Widget · DristiQ IP',
    narration: 'Market momentum oscillator — tells you when the tide is turning.',
    badge: 'Panel Block',
  },
  'six_day_outlook': {
    icon: '☽', display_name: 'Six-Day Outlook', type_label: 'Astro Rule',
    narration: 'Forward astro calendar — what\'s coming in the next 6 days.',
    badge: 'Panel Block',
  },
}

function buildAnimBlocks(template: FrameworkTemplate): AnimItem[] {
  const allIds = new Set<string>()
  template.blocks.forEach(b => allIds.add(b.catalog_item_id))
  template.chart_overlays.forEach(o => allIds.add(o.catalog_item_id))

  // Merge sma_50 into ema_20 entry so "EMA 20/50" shows as one block
  const hasBothEMA = allIds.has('ema_20') && allIds.has('sma_50')
  if (hasBothEMA) allIds.delete('sma_50')

  return ANIM_ORDER
    .filter(id => allIds.has(id))
    .map(id => ({
      catalog_item_id: id,
      ...BLOCK_META[id],
      display_name: id === 'ema_20' && hasBothEMA ? 'EMA 20 / SMA 50' : BLOCK_META[id].display_name,
    }))
}

// ── Shared colour helpers ─────────────────────────────────────────────────────

// VaNi orb purple — intentional brand identity, does NOT change with theme
const V = 'rgba(124,106,247,'

// ── Screen 1 — VaNi Introduction ─────────────────────────────────────────────

interface S1Props {
  displayName: string; setDisplayName: (v: string) => void
  phone: string;       setPhone: (v: string) => void
  onBegin: () => void
}

function Screen1({ displayName, setDisplayName, phone, setPhone, onBegin }: S1Props) {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: 'var(--bg)' }}>
      {/* Ambient glows */}
      <div style={{ position:'absolute', width:700, height:700, borderRadius:'50%',
        background:`radial-gradient(circle, ${V}.07) 0%, transparent 65%)`,
        top:-200, left:-200, filter:'blur(40px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(201,168,76,.04) 0%, transparent 65%)',
        bottom:-100, right:-100, filter:'blur(60px)', pointerEvents:'none' }} />

      {/* Orb system */}
      <div style={{ position:'absolute', top:'50%', left:'50%', pointerEvents:'none' }}>
        {[{ size:340, alpha:.08, dur:'30s', dir:'ring-spin-cw' },
          { size:240, alpha:.12, dur:'20s', dir:'ring-spin-ccw' },
          { size:160, alpha:.18, dur:'15s', dir:'ring-spin-cw' }
        ].map(({ size, alpha, dur, dir }) => (
          <div key={size} style={{ position:'absolute', width:size, height:size,
            borderRadius:'50%', border:`1px solid ${V}${alpha})`,
            top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            animation:`${dir} ${dur} linear infinite` }} />
        ))}
        {[{ top:'30%', left:'40%', dx:'40px',  dy:'-60px', d:'7s', delay:'0s'   },
          { top:'60%', left:'60%', dx:'-30px', dy:'-40px', d:'5s', delay:'.8s'  },
          { top:'45%', left:'30%', dx:'20px',  dy:'30px',  d:'9s', delay:'1.5s' },
          { top:'35%', left:'65%', dx:'-50px', dy:'-20px', d:'6s', delay:'.3s'  },
        ].map(({ top, left, dx, dy, d, delay }, i) => (
          <div key={i} style={{ position:'absolute', top, left, width:2, height:2,
            borderRadius:'50%', background:`${V}.5)`,
            '--px':dx, '--py':dy,
            animation:`particle-float ${d} ${delay} ease-in-out infinite alternate`,
          } as React.CSSProperties} />
        ))}
        <div style={{ position:'absolute', top:'50%', left:'50%',
          transform:'translate(-50%,-50%)', width:80, height:80,
          background:'linear-gradient(135deg, #9d8ff9 0%, #5b4fd4 50%, #3d2fa8 100%)',
          filter:'blur(1px)',
          animation:'orb-morph 8s ease-in-out infinite alternate, orb-pulse 3s ease-in-out infinite' }} />
      </div>

      {/* Card */}
      <div style={{ position:'relative', zIndex:10, textAlign:'center',
        animation:'card-rise .9s cubic-bezier(.22,1,.36,1) .4s both' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:7,
          padding:'5px 14px', borderRadius:100,
          background:'var(--accent-glow)', border:'1px solid var(--accent-dim)',
          fontSize:10, fontWeight:600, letterSpacing:'1px', textTransform:'uppercase',
          color:'var(--accent)', fontFamily:'var(--font-mono, monospace)', marginBottom:28,
          animation:'text-in .6s ease .8s both' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)',
            animation:'badge-pulse 2s ease-in-out infinite', display:'inline-block' }} />
          Agentic Intelligence
        </div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:40, fontWeight:300,
          letterSpacing:'-0.03em', color:'var(--text-primary)',
          animation:'text-in .6s ease .8s both' }}>I'm</div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:40, fontWeight:400,
          fontStyle:'italic', letterSpacing:'-0.03em',
          background:'linear-gradient(135deg, #9d8ff9, var(--gold, #c9a84c))',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
          animation:'text-in .6s ease .95s both' }}>VaNi.</div>
        <p style={{ fontSize:15, color:'var(--text-muted)', marginTop:16, marginBottom:32,
          lineHeight:1.65, maxWidth:400,
          animation:'text-in .6s ease 1.1s both' }}>
          I'll help you build your market intelligence framework.
        </p>
        {/* Subtle name / phone */}
        <div style={{ maxWidth:340, margin:'0 auto 28px',
          animation:'text-in .6s ease 1.2s both' }}>
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder="What should I call you? (optional)"
            style={{ width:'100%', padding:'10px 16px', marginBottom:8,
              background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)',
              borderRadius:10, fontSize:13, color:'var(--text-primary)',
              outline:'none', fontFamily:'inherit' }} />
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="Phone for alerts (optional)"
            style={{ width:'100%', padding:'10px 16px',
              background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)',
              borderRadius:10, fontSize:13, color:'var(--text-primary)',
              outline:'none', fontFamily:'inherit' }} />
        </div>
        <button onClick={onBegin}
          style={{ padding:'14px 40px', border:'none', borderRadius:100, cursor:'pointer',
            fontSize:15, fontWeight:500, fontFamily:'inherit',
            background:'linear-gradient(135deg, #7c6af7, #5b4fd4)', color:'#fff',
            letterSpacing:'.01em',
            boxShadow:`0 4px 24px ${V}.5), 0 1px 0 rgba(255,255,255,.1) inset`,
            transition:'all .2s ease', animation:'text-in .6s ease 1.3s both' }}
          onMouseEnter={e => { (e.currentTarget).style.transform='translateY(-2px)' }}
          onMouseLeave={e => { (e.currentTarget).style.transform='' }}>
          Let VaNi begin →
        </button>
      </div>
    </div>
  )
}

// ── Screen 2 — ICP Question ───────────────────────────────────────────────────

interface S2Props {
  typed: boolean; icp: ICP | null
  onSelect: (val: ICP) => void
  blend: number; setBlend: (v: number) => void
  onContinue: () => void
}

function Screen2({ typed, icp, onSelect, blend, setBlend, onContinue }: S2Props) {
  const tiles: { val: ICP; icon: string; label: string; sub: string }[] = [
    { val:'investor', icon:'🌱', label:'Investor',  sub:'Weeks to months' },
    { val:'trader',   icon:'⚡', label:'Trader',    sub:'Swing & short-term' },
    { val:'both',     icon:'⚖️', label:'Both',      sub:'Set your blend' },
  ]
  const islandText = icp === 'investor' ? 'Investor profile selected'
    : icp === 'trader' ? 'Trader profile selected'
    : icp === 'both'   ? 'Set your blend — then build'
    : 'Select how you participate in markets'

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background:'var(--bg)', paddingTop:52 }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* VaNi bubble */}
        <div style={{ display:'flex', gap:12, alignItems:'flex-start', maxWidth:520, width:'100%',
          marginBottom:32, animation:'bubble-in .4s cubic-bezier(.22,1,.36,1) both' }}>
          <div style={{ width:34, height:34, flexShrink:0, borderRadius:10,
            background:'linear-gradient(135deg, #9d8ff9, #5b4fd4)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:`0 3px 12px ${V}.4)`, fontSize:13, fontWeight:700,
            color:'#fff', fontFamily:'var(--font-mono, monospace)', marginTop:2 }}>V</div>
          <div style={{ background:'var(--card)', border:'1px solid rgba(255,255,255,.14)',
            borderRadius:'3px 14px 14px 14px', padding:'14px 18px',
            fontSize:14, color:'var(--text-primary)', lineHeight:1.65, maxWidth:460 }}>
            {!typed ? (
              <span style={{ display:'flex', gap:5, alignItems:'center', padding:'6px 4px' }}>
                {[0, 200, 400].map(delay => (
                  <span key={delay} style={{ width:7, height:7, borderRadius:'50%',
                    background:'rgba(255,255,255,.15)', display:'inline-block',
                    animation:`typing-dot 1.2s ease-in-out ${delay}ms infinite` }} />
                ))}
              </span>
            ) : (
              <span style={{ animation:'bubble-in .4s cubic-bezier(.22,1,.36,1) both' }}>
                One thing —{' '}
                <span style={{ color:'var(--gold, #c9a84c)', fontFamily:'var(--font-display)',
                  fontStyle:'italic', fontSize:15 }}>
                  how do you participate in markets?
                </span>
                <span style={{ display:'block', fontSize:12, color:'var(--text-muted)', marginTop:6 }}>
                  This is all I need to get started. You can change anything after.
                </span>
              </span>
            )}
          </div>
        </div>
        {/* Tiles */}
        {typed && (
          <div style={{ display:'flex', gap:10, maxWidth:520, width:'100%',
            animation:'bubble-in .4s ease .1s both' }}>
            {tiles.map(({ val, icon, label, sub }) => (
              <button key={val} onClick={() => onSelect(val)}
                style={{ flex:1, padding:'18px 14px', cursor:'pointer', textAlign:'center',
                  borderRadius:12, transition:'all .2s ease',
                  border:`1px solid ${icp === val ? 'var(--accent)' : 'rgba(255,255,255,.07)'}`,
                  background: icp === val ? 'var(--accent-glow)' : 'var(--card)' }}
                onMouseEnter={e => { if (icp !== val) (e.currentTarget).style.borderColor='rgba(255,255,255,.14)' }}
                onMouseLeave={e => { if (icp !== val) (e.currentTarget).style.borderColor='rgba(255,255,255,.07)' }}>
                <div style={{ fontSize:22, marginBottom:8 }}>{icon}</div>
                <div style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)', marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.4 }}>{sub}</div>
              </button>
            ))}
          </div>
        )}
        {/* Blend slider */}
        {typed && icp === 'both' && (
          <div style={{ maxWidth:520, width:'100%', marginTop:10, padding:'16px 20px',
            border:'1px solid rgba(255,255,255,.07)', borderRadius:12,
            background:'var(--card)', animation:'bubble-in .3s ease both' }}>
            <div style={{ textAlign:'center', fontFamily:'var(--font-mono, monospace)',
              fontSize:13, color:'var(--gold, #c9a84c)', marginBottom:12 }}>
              {blend}% Investor · {100 - blend}% Trader
            </div>
            <input type="range" min={10} max={90} value={blend}
              onChange={e => setBlend(Number(e.target.value))}
              style={{ width:'100%', accentColor:'var(--gold, #c9a84c)' }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10,
              color:'var(--text-muted)', marginTop:8,
              fontFamily:'var(--font-mono, monospace)' }}>
              <span>← Investor</span><span>Trader →</span>
            </div>
          </div>
        )}
      </div>
      {/* Action island */}
      <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
        background:'var(--bg)', border:'1px solid var(--accent-dim)',
        borderRadius:28, padding:'10px 20px 10px 14px',
        display:'flex', alignItems:'center', gap:12, backdropFilter:'blur(20px)',
        boxShadow:`0 8px 32px rgba(0,0,0,.5), 0 0 0 1px ${V}.08)`,
        zIndex:200, minWidth:320, animation:'bubble-in .4s ease .3s both' }}>
        <div style={{ width:22, height:22, borderRadius:'50%', flexShrink:0,
          background:'radial-gradient(circle at 35% 35%, #9d8ff9, #5b4fd4)',
          animation:'badge-pulse 2.5s ease-in-out infinite' }} />
        <span style={{ fontSize:13, color:'var(--text-primary)', flex:1 }}>{islandText}</span>
        {icp === 'both' && (
          <button onClick={onContinue}
            style={{ padding:'7px 16px', border:'none', borderRadius:100, cursor:'pointer',
              fontSize:12, fontWeight:500, fontFamily:'inherit',
              background:'var(--accent-solid)', color:'#fff', flexShrink:0, transition:'background .2s' }}>
            Build my workspace →
          </button>
        )}
      </div>
    </div>
  )
}

// ── Screen 3 — VaNi Builds Framework ─────────────────────────────────────────

interface S3Props {
  template: FrameworkTemplate
  isFree: boolean
  onAccept: () => Promise<void>
  onBrowse: () => void
  isCommitting: boolean
}

function Screen3({ template, isFree: _isFree, onAccept, onBrowse, isCommitting }: S3Props) {
  const animBlocks = buildAnimBlocks(template)
  const total = animBlocks.length

  const [visibleCount, setVisibleCount] = useState(0)
  const [done, setDone]                 = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timers = animBlocks.map((_, i) =>
      setTimeout(() => setVisibleCount(i + 1), 350 * (i + 1))
    )
    const doneTimer = setTimeout(() => setDone(true), 350 * total + 500)
    return () => { timers.forEach(clearTimeout); clearTimeout(doneTimer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll narration log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visibleCount])

  const badgeColor = (badge: string) => {
    if (badge.includes('Overlay')) return { bg: 'rgba(45,212,191,.1)',  color: '#2dd4bf' }
    if (badge.includes('Output'))  return { bg: 'var(--accent-glow)', color: 'var(--accent)' }
    return                                { bg: 'rgba(201,168,76,.1)',   color: 'var(--gold, #c9a84c)' }
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background:'var(--bg)', paddingTop:52 }}>
      {/* Top bar */}
      <div style={{ height:52, position:'absolute', top:0, left:0, right:0,
        borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex',
        alignItems:'center', padding:'0 24px', gap:10, zIndex:10 }}>
        <div style={{ width:22, height:22, borderRadius:6, flexShrink:0,
          background:'linear-gradient(135deg, #9d8ff9, #5b4fd4)',
          boxShadow:`0 3px 10px ${V}.4)` }} />
        <span style={{ fontFamily:'var(--font-mono, monospace)', fontSize:10,
          color:'var(--accent)', letterSpacing:'.1em', textTransform:'uppercase' }}>VaNi</span>
        <span style={{ marginLeft:'auto', fontSize:10, fontFamily:'var(--font-mono, monospace)',
          color:'var(--text-muted)' }}>
          {done ? 'ready ✓' : `${visibleCount} / ${total}`}
        </span>
      </div>

      {/* Main: canvas left + narration right */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 360px', overflow:'hidden' }}>
        {/* Left — block list */}
        <div style={{ borderRight:'1px solid rgba(255,255,255,.07)',
          display:'flex', flexDirection:'column', padding:24, gap:12, overflowY:'auto' }}>
          <span style={{ fontFamily:'var(--font-mono, monospace)', fontSize:10,
            letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.15)' }}>
            Your Workspace
          </span>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:300,
            color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4 }}>
            {done ? 'Your framework' : 'VaNi is building…'}
          </h2>
          {animBlocks.map((block, i) => {
            const visible = visibleCount > i
            const bc = badgeColor(block.badge)
            return (
              <div key={block.catalog_item_id}
                style={{ border:`1px solid ${visible ? 'var(--accent-dim)' : 'rgba(255,255,255,.07)'}`,
                  borderRadius:10, background:'var(--card)', padding:'14px 16px',
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'none' : 'translateY(12px) scale(.97)',
                  transition:'all .5s cubic-bezier(.34,1.4,.64,1)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{block.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'var(--font-mono, monospace)', fontSize:9,
                      color:'rgba(255,255,255,.2)', letterSpacing:'.1em',
                      textTransform:'uppercase', marginBottom:3 }}>{block.type_label}</div>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>
                      {block.display_name}
                    </div>
                  </div>
                </div>
                <span style={{ display:'inline-block', marginTop:8, fontSize:9,
                  fontFamily:'var(--font-mono, monospace)', padding:'2px 7px',
                  borderRadius:3, background:bc.bg, color:bc.color }}>
                  {block.badge}
                </span>
              </div>
            )
          })}

          {/* Completion message + actions */}
          {done && (
            <div style={{ marginTop:8, animation:'text-in .6s ease both' }}>
              <p style={{ fontSize:14, color:'var(--text-muted)', lineHeight:1.65, marginBottom:20 }}>
                Your framework is ready. Everything here can be changed.
              </p>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={onAccept} disabled={isCommitting}
                  style={{ flex:1, padding:'13px 0', border:'none', borderRadius:100,
                    cursor: isCommitting ? 'default' : 'pointer', fontSize:14, fontWeight:500,
                    fontFamily:'inherit', background:'var(--accent-solid)',
                    color:'#fff', opacity: isCommitting ? .7 : 1,
                    boxShadow:`0 4px 20px ${V}.45)`, transition:'all .2s ease' }}>
                  {isCommitting ? 'Setting up…' : 'Start here →'}
                </button>
                <button onClick={onBrowse} disabled={isCommitting}
                  style={{ padding:'13px 24px', background:'transparent',
                    border:'1px solid rgba(255,255,255,.07)', borderRadius:100,
                    fontSize:14, color:'var(--text-muted)', cursor:'pointer',
                    fontFamily:'inherit', transition:'all .2s ease' }}>
                  Browse Templates
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right — VaNi narration log */}
        <div style={{ display:'flex', flexDirection:'column', padding:'20px 18px',
          overflowY:'auto', gap:10 }}>
          {animBlocks.slice(0, visibleCount).map((block, i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start',
              animation:'bubble-in .4s cubic-bezier(.22,1,.36,1) both' }}>
              <div style={{ width:24, height:24, borderRadius:7, flexShrink:0,
                background:'linear-gradient(135deg, #9d8ff9, #5b4fd4)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, fontWeight:700, color:'#fff',
                fontFamily:'var(--font-mono, monospace)', marginTop:1 }}>V</div>
              <div style={{ background:'var(--card)',
                border:'1px solid rgba(255,255,255,.07)',
                borderRadius:'3px 10px 10px 10px', padding:'10px 14px',
                fontSize:12, color:'var(--text-muted)', lineHeight:1.6, flex:1 }}
                dangerouslySetInnerHTML={{ __html: block.narration.replace(
                  /DristiQ's proprietary/g,
                  "<strong style='color:#e8eaed'>DristiQ's proprietary</strong>"
                ).replace(
                  /(EMA 20\/50|Panchak|MagicRS|Conviction Flow|Breadth ROC|Six-Day Outlook|RSI 14|SMA 50)/g,
                  "<strong style='color:#e8eaed'>$1</strong>"
                )}} />
            </div>
          ))}
          {done && (
            <div style={{ display:'flex', gap:8, alignItems:'flex-start',
              animation:'bubble-in .4s cubic-bezier(.22,1,.36,1) both' }}>
              <div style={{ width:24, height:24, borderRadius:7, flexShrink:0,
                background:'linear-gradient(135deg, #9d8ff9, #5b4fd4)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, fontWeight:700, color:'#fff', fontFamily:'var(--font-mono, monospace)', marginTop:1 }}>V</div>
              <div style={{ background:'var(--card)', border:'1px solid var(--accent-glow)',
                borderRadius:'3px 10px 10px 10px', padding:'10px 14px',
                fontSize:12, color:'var(--text-muted)', lineHeight:1.6, flex:1 }}>
                Done.{' '}
                <strong style={{ color:'#e8eaed' }}>{total} blocks placed.</strong>
                {' '}Hover any block to swap or remove it. Add more anytime from the Catalog.
              </div>
            </div>
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  )
}

// ── Screen 4 — Instrument Selector (free tier only) ───────────────────────────

interface EqSuggestion { symbol: string; company_name: string | null; isin: string | null }

async function fetchSuggestions(): Promise<EqSuggestion[]> {
  // NSE-only, active, ordered by market cap descending (nulls at end).
  // Fetching 60 to absorb any post-dedup shrinkage before slicing to 30.
  const { data, error } = await from('km_equity_symbols')
    .select('symbol,company_name,isin,exchange')
    .is('is_active', 'true')
    .eq('exchange', 'NSE')
    .order('mcap_cr', { ascending: false, nullsFirst: false })
    .limit(60)
    .execute()

  if (error || !data) return []

  // Dedup by ISIN (NSE already preferred by the exchange filter, but guard anyway)
  const seen = new Set<string>()
  const out: EqSuggestion[] = []
  for (const r of data as (EqSuggestion & { exchange: string })[]) {
    const key = r.isin ?? r.symbol
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ symbol: r.symbol, company_name: r.company_name, isin: r.isin })
  }
  return out.slice(0, 30)
}

interface S4Props {
  onComplete: (symbols: string[]) => void
}

function Screen4({ onComplete }: S4Props) {
  const [search,      setSearch]      = useState('')
  const [selected,    setSelected]    = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<EqSuggestion[]>([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    fetchSuggestions()
      .then(setSuggestions)
      .finally(() => setLoading(false))
  }, [])

  const q = search.toUpperCase().trim()
  const filtered = suggestions
    .filter(e =>
      !selected.includes(e.symbol) &&
      (q === '' || e.symbol.includes(q) || (e.company_name ?? '').toUpperCase().includes(q))
    )
    .slice(0, 8)

  function toggle(symbol: string) {
    if (selected.includes(symbol)) {
      setSelected(prev => prev.filter(s => s !== symbol))
    } else if (selected.length < 2) {
      setSelected(prev => [...prev, symbol])
    }
  }

  const canContinue = selected.length === 2

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{ background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:500, animation:'card-rise .6s cubic-bezier(.22,1,.36,1) both' }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:48, height:48, borderRadius:14, margin:'0 auto 16px',
            background:'linear-gradient(135deg, #9d8ff9, #5b4fd4)',
            boxShadow:`0 8px 24px ${V}.4)`, display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:22 }}>⚙️</div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:300,
            color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:8 }}>
            Choose your instruments
          </h2>
          <p style={{ fontSize:14, color:'var(--text-muted)', lineHeight:1.6 }}>
            Pick 2 equities to track alongside Nifty 50. You can always add more later.
          </p>
        </div>

        {/* Nifty locked + selected slots */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {/* Nifty 50 — locked */}
          <div style={{ padding:'7px 14px', borderRadius:100,
            background:'rgba(45,212,191,.08)', border:'1px solid rgba(45,212,191,.25)',
            fontSize:12, color:'#2dd4bf', fontFamily:'var(--font-mono, monospace)',
            display:'flex', alignItems:'center', gap:6 }}>
            NIFTY 50
            <span style={{ fontSize:10, opacity:.6 }}>locked</span>
          </div>
          {/* Selected */}
          {selected.map(s => (
            <button key={s} onClick={() => toggle(s)}
              style={{ padding:'7px 14px', borderRadius:100, cursor:'pointer',
                background:'var(--accent-glow)', border:'1px solid var(--accent-dim)',
                fontSize:12, color:'var(--accent)', fontFamily:'var(--font-mono, monospace)',
                display:'flex', alignItems:'center', gap:6, transition:'all .15s' }}>
              {s}
              <span style={{ fontSize:14, opacity:.7 }}>✕</span>
            </button>
          ))}
          {/* Empty slots */}
          {Array.from({ length: 2 - selected.length }).map((_, i) => (
            <div key={i} style={{ padding:'7px 14px', borderRadius:100,
              background:'rgba(255,255,255,.02)', border:'1px dashed rgba(255,255,255,.1)',
              fontSize:12, color:'rgba(255,255,255,.2)',
              fontFamily:'var(--font-mono, monospace)' }}>
              + add
            </div>
          ))}
        </div>

        {/* Search */}
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search NSE symbol…"
          style={{ width:'100%', padding:'11px 16px', marginBottom:12,
            background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)',
            borderRadius:10, fontSize:13, color:'var(--text-primary)',
            outline:'none', fontFamily:'inherit' }} />

        {/* Suggestions */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:28, minHeight:40 }}>
          {loading && (
            <span style={{ fontSize:12, color:'var(--text-muted)', animation:'text-in .4s ease both' }}>
              Loading…
            </span>
          )}
          {!loading && filtered.map(e => (
            <button key={e.symbol} onClick={() => toggle(e.symbol)}
              disabled={selected.length >= 2}
              title={e.company_name ?? e.symbol}
              style={{ padding:'6px 14px', borderRadius:100, cursor: selected.length >= 2 ? 'default' : 'pointer',
                background:'var(--card)', border:'1px solid rgba(255,255,255,.1)',
                fontSize:12, color:'var(--text-primary)',
                fontFamily:'var(--font-mono, monospace)',
                opacity: selected.length >= 2 ? .4 : 1,
                transition:'all .15s' }}
              onMouseEnter={e2 => { if (selected.length < 2) (e2.currentTarget).style.borderColor='rgba(255,255,255,.25)' }}
              onMouseLeave={e2 => { (e2.currentTarget).style.borderColor='rgba(255,255,255,.1)' }}>
              {e.symbol}
            </button>
          ))}
          {!loading && filtered.length === 0 && q && (
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>No matches for "{search}"</span>
          )}
        </div>

        {/* Continue */}
        <button onClick={() => onComplete(selected)} disabled={!canContinue}
          style={{ width:'100%', padding:'14px 0', border:'none', borderRadius:100,
            cursor: canContinue ? 'pointer' : 'default', fontSize:14, fontWeight:500,
            fontFamily:'inherit',
            background: canContinue ? 'var(--accent-solid)' : 'rgba(255,255,255,.06)',
            color: canContinue ? '#fff' : 'rgba(255,255,255,.25)',
            boxShadow: canContinue ? `0 4px 20px ${V}.4)` : 'none',
            transition:'all .3s ease' }}>
          Continue →
        </button>

        <p style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,.2)', marginTop:14 }}>
          {canContinue ? 'Ready to enter your workspace' : `Select ${2 - selected.length} more`}
        </p>
      </div>
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

export default function ProfileSetup() {
  const navigate = useNavigate()
  const { profile, refreshProfile, setProfile } = useAuthStore()
  const { loadFramework, applyTemplate, saveFramework, addInstrument, framework } = useFrameworkStore()

  const [step,        setStep]        = useState<Step>(1)
  const [icp,         setIcp]         = useState<ICP | null>(null)
  const [blend,       setBlend]       = useState(50)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [phone,       setPhone]       = useState(profile?.phone ?? '')
  const [s2Typed,     setS2Typed]     = useState(false)
  const [committing,  setCommitting]  = useState(false)

  // Screen 2: typing animation — reveal question after 1.4s
  useEffect(() => {
    if (step !== 2) return
    setS2Typed(false)
    const t = setTimeout(() => setS2Typed(true), 1400)
    return () => clearTimeout(t)
  }, [step])

  // Screen 3: pre-load framework so applyTemplate has something to write into
  useEffect(() => {
    if (step === 3 && !framework && profile?.id) {
      loadFramework(profile.id)
    }
  }, [step, framework, profile?.id, loadFramework])

  // Save name/phone non-blocking when advancing from Screen 1
  function handleBegin() {
    if (displayName.trim() || phone.trim()) {
      updateProfile({
        display_name: displayName.trim() || null,
        phone: phone.trim() || null,
      }).catch(() => {/* non-critical */})
    }
    setStep(2)
  }

  function handleSelectICP(val: ICP) {
    setIcp(val)
    if (val !== 'both') setTimeout(() => setStep(3), 280)
  }

  // "Start here →" — apply template, mark onboarded, route to workspace or S4
  async function handleAccept() {
    if (!icp) return
    setCommitting(true)
    try {
      const template = getTemplateForICP(icp, blend)
      applyTemplate(template)
      await saveFramework()
      await updateProfile({ onboarded: true })
      try { await refreshProfile() } catch {
        if (profile) setProfile({ ...profile, onboarded: true })
      }
      console.log('tier after refresh:', useAuthStore.getState().profile?.tier)
      const freshTier = useAuthStore.getState().profile?.tier ?? 'free'
      const isFreeUser = !PAID_TIERS.includes(freshTier as typeof PAID_TIERS[number])
      if (isFreeUser) {
        setStep(4)
      } else {
        navigate('/workspace', { replace: true })
      }
    } catch {
      setCommitting(false)
    }
  }

  // Screen 4 complete — add instruments, save, navigate
  async function handleInstrumentsComplete(symbols: string[]) {
    symbols.forEach(s => addInstrument(s))
    await saveFramework()
    navigate('/workspace', { replace: true })
  }

  async function handleBrowse() {
    if (!icp) { navigate('/catalog', { replace: true }); return }
    setCommitting(true)
    try {
      const template = getTemplateForICP(icp, blend)
      applyTemplate(template)
      await saveFramework()
      await updateProfile({ onboarded: true })
      try { await refreshProfile() } catch {
        if (profile) setProfile({ ...profile, onboarded: true })
      }
      navigate('/catalog', { replace: true })
    } catch {
      setCommitting(false)
    }
  }

  const template = icp ? getTemplateForICP(icp, blend) : null

  return (
    <>
      <style>{KEYFRAMES}</style>
      {step === 1 && (
        <Screen1
          displayName={displayName} setDisplayName={setDisplayName}
          phone={phone} setPhone={setPhone}
          onBegin={handleBegin}
        />
      )}
      {step === 2 && (
        <Screen2
          typed={s2Typed} icp={icp}
          onSelect={handleSelectICP}
          blend={blend} setBlend={setBlend}
          onContinue={() => setStep(3)}
        />
      )}
      {step === 3 && template && (
        <Screen3
          template={template}
          isFree={false}
          onAccept={handleAccept}
          onBrowse={handleBrowse}
          isCommitting={committing}
        />
      )}
      {step === 4 && (
        <Screen4 onComplete={handleInstrumentsComplete} />
      )}
    </>
  )
}
