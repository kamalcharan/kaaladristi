import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, isAuthError } from '@/stores/authStore'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { updateProfile, signOut } from '@/services/auth'
import { resolveSpotlightIntent } from '@/services/spotlight'
import { trackEvent } from '@/lib/analytics'
import { errMessage as sharedErrMessage } from '@/lib/errorMessages'
import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone'
import { PAID_TIERS } from '@/constants/frameworkConstants'
import { TEMPLATE_MAP } from '@/constants/frameworkTemplates'
import type { FrameworkTemplate } from '@/constants/frameworkTemplates'
import { PERSONAS, PERSONA_SCANNERS, PERSONA_TEMPLATE, derivePersona, type Persona, type PersonaAnswers } from '@/constants/personaConfig'
import { ONBOARDING_VERSION, needsOnboarding, isReturningForUpgrade } from '@/constants/onboarding'
import { getPresetMeta } from '@/services/scanEngine'
import { useIsPhone } from '@/hooks/useMediaQuery'
import PersonalityScreen, { type PersonalityState } from '@/components/domain/Onboarding/PersonalityScreen'
import GuideStep from '@/components/domain/Onboarding/GuideStep'
import LiveIntroCard from '@/components/domain/Onboarding/LiveIntroCard'
import TryItSort from '@/components/domain/Onboarding/TryItSort'
import PricingCards from '@/components/domain/Pricing/PricingCards'
import ThemeSettings from '@/components/domain/ThemeSettings'

// 1 What is VaNi + your details · 2 Personality · 3 Scanners (workbench builds)
// 4 How VaNi will guide · 5 Plan · 6 Look — docs/claude/onboarding-poa.md
type Step = 1 | 2 | 3 | 4 | 5 | 6

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
  const [phoneTouched, setPhoneTouched] = useState(false)
  const phoneValid = isValidIndianMobile(phone)
  const showPhoneError = phoneTouched && !phoneValid
  const handleBegin = () => { setPhoneTouched(true); if (phoneValid) onBegin() }
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto"
      style={{ background: 'var(--bg)' }}>
      {/* Ambient glows */}
      <div style={{ position:'absolute', width:700, height:700, borderRadius:'50%',
        background:`radial-gradient(circle, ${V}.07) 0%, transparent 65%)`,
        top:-200, left:-200, filter:'blur(40px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%',
        background:'radial-gradient(circle, color-mix(in srgb, var(--gold) 4%, transparent) 0%, transparent 65%)',
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
      <div style={{ position:'relative', zIndex:10, textAlign:'center', width:'100%',
        padding:'24px 14px', margin:'auto',
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
          background:'linear-gradient(135deg, #9d8ff9, var(--gold, var(--gold)))',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
          animation:'text-in .6s ease .95s both' }}>VaNi.</div>
        <p style={{ fontSize:15, color:'var(--text-muted)', margin:'16px auto 32px',
          lineHeight:1.65, maxWidth:400,
          animation:'text-in .6s ease 1.1s both' }}>
          I assemble your market workbench from what you'd act on — not from a form.
        </p>
        {/* First value before the first question — one live setup, today's date. */}
        <LiveIntroCard />
        {/* Name (optional) + phone (required — how we reach you about your account) */}
        <div style={{ maxWidth:340, margin:'0 auto 28px',
          animation:'text-in .6s ease 1.2s both' }}>
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder="What should I call you? (optional)"
            style={{ width:'100%', padding:'10px 16px', marginBottom:8,
              background:'color-mix(in srgb, var(--text-primary) 4%, transparent)', border:'1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)',
              borderRadius:10, fontSize:13, color:'var(--text-primary)',
              outline:'none', fontFamily:'inherit' }} />
          <input type="tel" inputMode="numeric" value={phone}
            onChange={e => setPhone(e.target.value)}
            onBlur={() => setPhoneTouched(true)}
            placeholder="Mobile number (required)"
            style={{ width:'100%', padding:'10px 16px',
              background:'color-mix(in srgb, var(--text-primary) 4%, transparent)',
              border:`1px solid ${showPhoneError ? 'var(--bear)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)'}`,
              borderRadius:10, fontSize:13, color:'var(--text-primary)',
              outline:'none', fontFamily:'inherit' }} />
          {showPhoneError && (
            <div style={{ fontSize:11, color:'var(--bear)', textAlign:'left', marginTop:6 }}>
              Enter a valid 10-digit Indian mobile number.
            </div>
          )}
        </div>
        <button onClick={handleBegin} disabled={!phoneValid}
          style={{ padding:'14px 40px', border:'none', borderRadius:100,
            cursor: phoneValid ? 'pointer' : 'not-allowed',
            fontSize:15, fontWeight:500, fontFamily:'inherit',
            background:'linear-gradient(135deg, #7c6af7, #5b4fd4)', color:'#fff',
            letterSpacing:'.01em', opacity: phoneValid ? 1 : 0.5,
            boxShadow:`0 4px 24px ${V}.5), 0 1px 0 color-mix(in srgb, var(--text-primary) 10%, transparent) inset`,
            transition:'all .2s ease', animation:'text-in .6s ease 1.3s both' }}
          onMouseEnter={e => { if (phoneValid) (e.currentTarget).style.transform='translateY(-2px)' }}
          onMouseLeave={e => { (e.currentTarget).style.transform='' }}>
          Let VaNi begin →
        </button>
      </div>
    </div>
  )
}

// ── Screen 3 — VaNi Builds Framework ─────────────────────────────────────────

interface S3Props {
  template: FrameworkTemplate
  persona: Persona
  isFree: boolean
  onAccept: () => Promise<void>
  onBrowse: () => void
  /** Returning for a version bump AND already has blocks — offer to keep them. */
  onKeepWorkspace?: () => void
  isCommitting: boolean
  errorMsg: string | null
}

function Screen3({ template, persona, isFree: _isFree, onAccept, onBrowse, onKeepWorkspace, isCommitting, errorMsg }: S3Props) {
  const phone = useIsPhone()
  const scanners = PERSONA_SCANNERS[persona].map(id => getPresetMeta(id)).filter((m): m is NonNullable<typeof m> => !!m)
  const animBlocks = buildAnimBlocks(template)
  const total = animBlocks.length

  const [visibleCount, setVisibleCount] = useState(0)
  const [done, setDone]                 = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Show a "still working…" retry surface if commit stays pending past 10s.
  // rpc() now aborts at 15s and throws — but the retry link gives the user
  // agency during the wait itself so they never feel trapped watching a
  // spinner (the class of bug that stranded Charan repeatedly, 2026-07-30).
  const [slowCommit, setSlowCommit] = useState(false)
  useEffect(() => {
    if (!isCommitting) { setSlowCommit(false); return }
    const t = setTimeout(() => setSlowCommit(true), 10000)
    return () => clearTimeout(t)
  }, [isCommitting])

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
    return                                { bg: 'color-mix(in srgb, var(--gold) 10%, transparent)',   color: 'var(--gold, var(--gold))' }
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background:'var(--bg)', paddingTop:52 }}>
      {/* Top bar */}
      <div style={{ height:52, position:'absolute', top:0, left:0, right:0,
        borderBottom:'1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)', display:'flex',
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
      <div style={{ flex:1, display:'grid', gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 360px',
        overflow: phone ? 'auto' : 'hidden', minWidth:0 }}>
        {/* Left — block list */}
        <div style={{ borderRight: phone ? 'none' : '1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)',
          display:'flex', flexDirection:'column', padding: phone ? 16 : 24, gap:12, minWidth:0,
          overflowY: phone ? 'visible' : 'auto' }}>
          <span style={{ fontFamily:'var(--font-mono, monospace)', fontSize:10,
            letterSpacing:'.1em', textTransform:'uppercase', color:'color-mix(in srgb, var(--text-primary) 15%, transparent)' }}>
            Your Workspace
          </span>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:300,
            color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4 }}>
            {done ? `Your ${PERSONAS[persona].label.toLowerCase()} workbench` : 'VaNi is building…'}
          </h2>
          {animBlocks.map((block, i) => {
            const visible = visibleCount > i
            const bc = badgeColor(block.badge)
            return (
              <div key={block.catalog_item_id}
                style={{ border:`1px solid ${visible ? 'var(--accent-dim)' : 'color-mix(in srgb, var(--text-primary) 7%, transparent)'}`,
                  borderRadius:10, background:'var(--card)', padding:'14px 16px',
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'none' : 'translateY(12px) scale(.97)',
                  transition:'all .5s cubic-bezier(.34,1.4,.64,1)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{block.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'var(--font-mono, monospace)', fontSize:9,
                      color:'color-mix(in srgb, var(--text-primary) 20%, transparent)', letterSpacing:'.1em',
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

          {/* The persona's four scanners — the workbench's output panels. They
              light after the blocks so the sequence reads blocks → scanners. */}
          <span style={{ fontFamily:'var(--font-mono, monospace)', fontSize:10, marginTop:8,
            letterSpacing:'.1em', textTransform:'uppercase', color:'color-mix(in srgb, var(--text-primary) 15%, transparent)' }}>
            Your scanners
          </span>
          <div data-tour="onboarding-scanner-strip" style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:8 }}>
            {scanners.map((m, i) => {
              const lit = done || visibleCount > total - 1
              return (
                <div key={m.id} style={{ border:`1px solid ${lit ? 'var(--accent-dim)' : 'var(--border)'}`,
                  borderRadius:10, background:'var(--card)', padding:'10px 12px',
                  opacity: lit ? 1 : .35, transition:`all .5s ease ${i * 120}ms` }}>
                  <div style={{ fontFamily:'var(--font-mono, monospace)', fontSize:9, letterSpacing:'.1em',
                    textTransform:'uppercase', color:'var(--accent)', marginBottom:3 }}>Scanner 0{i + 1}</div>
                  <div style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>{m.name}</div>
                </div>
              )
            })}
          </div>

          {/* Completion message + actions */}
          {done && (
            <div style={{ marginTop:8, animation:'text-in .6s ease both' }}>
              <p style={{ fontSize:14, color:'var(--text-muted)', lineHeight:1.65, marginBottom:20 }}>
                {onKeepWorkspace
                  ? 'You already have a workspace. Starting from this template would replace the blocks you have arranged — keep yours instead and nothing changes.'
                  : 'Your starter framework is already applied — you can change any part of it later, from the Catalog.'}
              </p>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
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
                    border:'1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)', borderRadius:100,
                    fontSize:14, color:'var(--text-muted)', cursor:'pointer',
                    fontFamily:'inherit', transition:'all .2s ease' }}>
                  Customize in Catalog →
                </button>
              </div>
              {/* The safe exit for a user we sent back. Its own row, below the
                  template actions, because it is the one that does NOT write:
                  applyTemplate replaces blocks and overlays wholesale, so for
                  someone returning with a built workspace this is the only
                  choice that preserves it. */}
              {onKeepWorkspace && (
                <button onClick={onKeepWorkspace} disabled={isCommitting}
                  style={{ marginTop:12, width:'100%', padding:'12px 0', background:'transparent',
                    border:'1px solid color-mix(in srgb, var(--accent) 35%, transparent)', borderRadius:100,
                    fontSize:14, fontWeight:500, color:'var(--accent)', cursor:'pointer',
                    fontFamily:'inherit', transition:'all .2s ease' }}>
                  Keep my current workspace →
                </button>
              )}
              {errorMsg && (
                <p role="alert" style={{ marginTop:14, fontSize:13, lineHeight:1.5,
                  color:'var(--risk-red, #f87171)',
                  background:'color-mix(in srgb, var(--risk-red, #f87171) 8%, transparent)',
                  border:'1px solid color-mix(in srgb, var(--risk-red, #f87171) 25%, transparent)',
                  borderRadius:10, padding:'10px 14px' }}>
                  {errorMsg}
                </p>
              )}
              {slowCommit && !errorMsg && (
                <p style={{ marginTop:14, fontSize:12, lineHeight:1.5,
                  color:'var(--text-muted)', textAlign:'center' }}>
                  Still working… if this doesn't move,{' '}
                  <button type="button" onClick={onAccept}
                    style={{ background:'none', border:'none', padding:0, cursor:'pointer',
                      color:'var(--accent)', textDecoration:'underline', fontSize:12,
                      fontFamily:'inherit' }}>
                    tap here to retry
                  </button>.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right — VaNi narration log */}
        <div style={{ display:'flex', flexDirection:'column', padding: phone ? '16px' : '20px 18px',
          overflowY: phone ? 'visible' : 'auto', gap:10, minWidth:0,
          borderTop: phone ? '1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)' : 'none' }}>
          {animBlocks.slice(0, visibleCount).map((block, i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start',
              animation:'bubble-in .4s cubic-bezier(.22,1,.36,1) both' }}>
              <div style={{ width:24, height:24, borderRadius:7, flexShrink:0,
                background:'linear-gradient(135deg, #9d8ff9, #5b4fd4)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, fontWeight:700, color:'#fff',
                fontFamily:'var(--font-mono, monospace)', marginTop:1 }}>V</div>
              <div style={{ background:'var(--card)',
                border:'1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)',
                borderRadius:'3px 10px 10px 10px', padding:'10px 14px',
                fontSize:12, color:'var(--text-muted)', lineHeight:1.6, flex:1 }}
                dangerouslySetInnerHTML={{ __html: block.narration.replace(
                  /DristiQ's proprietary/g,
                  "<strong style='color:var(--text-primary)'>DristiQ's proprietary</strong>"
                ).replace(
                  /(EMA 20\/50|Panchak|MagicRS|Conviction Flow|Breadth ROC|Six-Day Outlook|RSI 14|SMA 50)/g,
                  "<strong style='color:var(--text-primary)'>$1</strong>"
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
                <strong style={{ color:'var(--text-primary)' }}>{total} blocks placed.</strong>
                {' '}Hover any block to swap or remove it. Add more anytime from the Catalog.
              </div>
            </div>
          )}
          {done && <TryItSort />}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────
// (The former Screen 4 "Choose your instruments" free-tier gate was dropped —
// owner 2026-07-07: a mandatory 2-stock pick right after declining to pay was
// noise, and its search only covered the top-30 mcap list so most symbols
// showed "No matches". Free users now land in the workspace directly and add
// instruments from there when they actually want them.)

export default function ProfileSetup() {
  const navigate = useNavigate()
  const { profile, refreshProfile, setProfile } = useAuthStore()
  const { loadFramework, applyTemplate, saveFramework, framework } = useFrameworkStore()

  // Dev-only deep link (?step=N) so the QA screenshot harness can render a
  // later screen without a live framework service. Ignored in production.
  const [step,        setStep]        = useState<Step>(() => {
    if (!import.meta.env.DEV) return 1
    const n = Number(new URLSearchParams(window.location.search).get('step'))
    return n >= 1 && n <= 6 ? (n as Step) : 1
  })
  const [personality, setPersonality] = useState<PersonalityState>({ answers: {}, override: null, stock: null })
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [phone,       setPhone]       = useState(profile?.phone ?? '')
  const [committing,  setCommitting]  = useState(false)
  const [browseIntent, setBrowseIntent] = useState(false)  // "Customize in Catalog" path → look step → /catalog
  const [error,       setError]       = useState<string | null>(null)

  // Persona is derived from the three answers (or the user's override chip);
  // the template follows the persona — no new templates, see personaConfig.
  const persona: Persona = personality.override ?? derivePersona(personality.answers)
  const template: FrameworkTemplate = TEMPLATE_MAP[PERSONA_TEMPLATE[persona]]

  // Guard: an ONBOARDED user must never sit in this wizard. Users used to
  // land here via the transiently-null-profile bounce in ProtectedRoute and
  // then re-walk the whole wizard (re-applying the starter template over
  // their customized framework). If the profile says onboarded, leave —
  // unless we're the ones flipping the flag right now (finishOnboarding).
  // A user sent BACK by a version bump is `onboarded` but not current, so the
  // guard asks needsOnboarding() rather than reading the flag directly — the
  // same predicate ProtectedRoute uses, or the two would fight and bounce the
  // user between /setup and /workspace.
  const completingRef = useRef(false)
  useEffect(() => {
    if (completingRef.current) return
    if (profile && !needsOnboarding(profile)) navigate('/workspace', { replace: true })
  }, [profile, navigate])

  // Returning for an upgrade, not arriving for the first time. They already
  // have a workspace, so step 3 must offer to keep it rather than silently
  // overwriting it with the starter template.
  const returning = isReturningForUpgrade(profile)

  // Did this user ARRIVE with a workspace of their own? Latched once, the
  // first time a framework loads, and never recomputed.
  //
  // Two traps, both found by test:
  //  · reading framework.blocks live at render time asks "has blocks", not
  //    "had blocks" — the wizard can put blocks there before step 3 reveals
  //    its actions, so the answer drifts. Hence the latch.
  //  · `length > 0` is never false. loadFramework BOOTSTRAPS a default
  //    NIFTY50 chart block into any framework that has none (frameworkStore
  //    ~line 262) and saves it, so a brand-new user reads as having one
  //    block. The bootstrap is exactly one chart block, so anything MORE
  //    than that is the user's own arrangement — that is the real question.
  const arrivedWithWorkspace = useRef<boolean | null>(null)
  useEffect(() => {
    if (arrivedWithWorkspace.current !== null) return
    if (!framework) return
    const blocks = framework.blocks ?? []
    arrivedWithWorkspace.current =
      blocks.length > 1 || blocks.some(b => b.type !== 'chart')
  }, [framework])

  // Resume: a returning user who answered the Personality step (persona_set_at
  // stamped by the RPC, migration 204) but never finished lands here
  // (ProtectedRoute forces /setup while onboarded is false). Drop them on
  // Scanners (step 3) — rebuilding the starter workbench is idempotent — instead
  // of making them redo the questions. Runs whenever the profile changes, not
  // once on mount (2026-07-30 stall note in git history).
  //
  // NOT icp_mode: migration 100 gave it NOT NULL DEFAULT 'astro', so every
  // profile has it from creation and the old rule sent EVERY new signup
  // straight to Plan → Look — nobody ever saw the VaNi intro or the ICP
  // question (found 2026-09-07 on the first real signup after the rework).
  useEffect(() => {
    if (!profile) return
    if (profile.onboarded) return
    if (profile.persona_set_at && step < 3) setStep(3)
  }, [profile, step])

  // Funnel visibility — which onboarding step a user actually reaches.
  useEffect(() => {
    trackEvent('onboarding_step_viewed', { step })
  }, [step])

  // Screen 3: pre-load framework so applyTemplate has something to write into
  useEffect(() => {
    if (step === 3 && !framework && profile?.id) {
      loadFramework(profile.id)
    }
  }, [step, framework, profile?.id, loadFramework])

  // Advance from Screen 1. Phone is required + validated in Screen1 before this
  // fires; persist the normalized 10-digit number (non-blocking — the row
  // exists and it's editable in Account if a transient save fails).
  function handleBegin() {
    if (!isValidIndianMobile(phone)) return
    updateProfile({
      display_name: displayName.trim() || null,
      phone: normalizeIndianMobile(phone),
    }).catch(() => {/* non-critical — editable later in Account */})
    setStep(2)
  }

  // Step 2 exit — persist the persona NOW, not at the end, so abandoning the
  // wizard still leaves one (Account → How you invest can change it later).
  // persona_set_at is stamped by the RPC. Non-blocking: a failed save is
  // recoverable from Account and must not strand the user here.
  function persistPersona(p: Persona, answers: PersonaAnswers, skipped: boolean) {
    updateProfile({
      persona: p,
      acts_on: answers.acts_on ?? null,
      hold_horizon: answers.hold_horizon ?? null,
      concede_level: answers.concede_level ?? null,
    })
      .then(() => refreshProfile().catch(() => {}))
      .catch(() => {/* non-critical */})
    trackEvent('onboarding_persona', { persona: p, skipped, overridden: personality.override != null, ...answers })
  }

  function handlePersonalityContinue() {
    persistPersona(persona, personality.answers, false)
    setStep(3)
  }

  function handlePersonalitySkip() {
    const blank: PersonalityState = { answers: {}, override: null, stock: null }
    setPersonality(blank)
    persistPersona(derivePersona(blank.answers), blank.answers, true)
    setStep(3)
  }

  const setupErrMessage = (e: unknown) => sharedErrMessage(e, {
    networkMessage: 'Couldn\'t reach the server to save your workspace. Check your connection and try again.',
    fallbackMessage: 'Something went wrong setting up your workspace. Please try again.',
  })

  // A dead token can never succeed on retry — the ONLY exit is a fresh login.
  // Show the message briefly, then sign out (clears the stale session) so the
  // user lands on the login page instead of retrying forever at "Your
  // framework" (the stuck-wizard bug, 2026-07-25).
  async function handleCommitError(e: unknown) {
    const message = setupErrMessage(e)
    setError(message)
    trackEvent('error_shown', { context: `onboarding_step_${step}`, message })
    setCommitting(false)
    if (isAuthError(e)) {
      setTimeout(() => {
        void signOut().then(() => navigate('/', { replace: true }))
      }, 2500)
    }
  }

  // Ensure the starter framework is actually persisted BEFORE the caller marks
  // the profile onboarded. Screen 3 kicks off loadFramework() asynchronously; if
  // that fetch failed or is still in flight, the store's `framework` is null and
  // both applyTemplate() and saveFramework() would silently no-op — stranding the
  // user as onboarded=true with no framework row. Throws on any failure so the
  // caller can surface an error and NOT advance.
  async function commitFramework() {
    if (!useFrameworkStore.getState().framework && profile?.id) {
      await loadFramework(profile.id)
    }
    if (!useFrameworkStore.getState().framework) {
      const storeErr = useFrameworkStore.getState().error
      throw new Error(storeErr || 'framework service unavailable')
    }
    applyTemplate(template)
    const saved = await saveFramework()
    if (!saved) {
      const storeErr = useFrameworkStore.getState().error
      throw new Error(storeErr || 'framework service: save failed')
    }
  }

  // icp_mode is the resume signal (workbench built, later steps pending). The
  // astro/technical choice is no longer asked during setup — astro is not
  // releasing yet — so everyone starts 'technical'; Account → Appearance
  // still lets a user switch.
  async function saveWorkbenchMarker() {
    await updateProfile({ icp_mode: 'technical' })
    try { await refreshProfile() } catch {
      if (profile) setProfile({ ...profile, icp_mode: 'technical' })
    }
  }

  // "Start here →" — apply template + mark built, then on to How VaNi will
  // guide. NOTE: onboarded is intentionally NOT set here. It flips only when
  // the user completes the last screen (2026-07-19) — so abandoning before
  // then forces them back to finish on next login.
  async function handleAccept() {
    setCommitting(true)
    setError(null)
    try {
      await commitFramework()
      await saveWorkbenchMarker()
      setCommitting(false)
      setStep(4)
    } catch (e) {
      await handleCommitError(e)
    }
  }

  // Complete onboarding — the single place onboarded flips to true, and the
  // only place onboarding_version is stamped. Written together on purpose: a
  // profile saying onboarded but carrying a stale version would be sent
  // straight back here by ProtectedRoute, looping forever.
  async function completeOnboarding() {
    await updateProfile({ onboarded: true, onboarding_version: ONBOARDING_VERSION })
    try { await refreshProfile() } catch {
      if (profile) setProfile({ ...profile, onboarded: true, onboarding_version: ONBOARDING_VERSION })
    }
  }

  // Plan exits advance to Look (step 6) rather than completing — so every
  // user consciously picks a theme before entering.
  function handlePaidSuccess() { setStep(6) }
  function handleFreeSelected() { setStep(6) }

  // Look step "Enter DristiQ" — the single place onboarding completes.
  // `browseIntent` remembers the "Customize in Catalog" path so this lands
  // them in the catalog instead of the workspace.
  async function finishOnboarding() {
    completingRef.current = true  // suppress the onboarded-guard redirect — we navigate ourselves
    try {
      await completeOnboarding()  // onboarded → true
    } catch (e) {
      completingRef.current = false
      await handleCommitError(e)
      return
    }
    trackEvent('onboarding_completed', { persona, icp_mode: 'technical' })
    if (browseIntent) { navigate('/catalog', { replace: true }); return }
    const dest = await resolveSpotlightIntent()
    navigate(dest ?? '/workspace', { replace: true })
  }

  // "Customize in Catalog →". This used to jump to step 6, skipping BOTH How
  // VaNi will guide (4) and Plan (5) — so anyone taking this exit finished
  // onboarding having never been shown pricing. `browseIntent` already
  // remembers to land them in the catalog at the end, so there was never a
  // reason to short-circuit; it now walks the same 4 → 5 → 6 as "Start
  // here →" (owner, 2026-09-12).
  async function handleBrowse() {
    setCommitting(true)
    setError(null)
    try {
      await commitFramework()
      await saveWorkbenchMarker()   // onboarded flips at the look step
      setBrowseIntent(true)
      setCommitting(false)
      setStep(4)
    } catch (e) {
      await handleCommitError(e)
    }
  }

  // "Keep my current workspace →" — step 3's third exit, offered only to a
  // user returning for a version bump who already has blocks.
  //
  // This is what makes forced re-onboarding safe. applyTemplate() REPLACES
  // blocks and chart_overlays wholesale — it does not merge — and both other
  // exits call it, so without this a version bump resets every customised
  // workbench to the starter template. ProfileSetup's own guard comment
  // records that exact bug from the last time users re-walked the wizard.
  // Writes nothing: skips the commit and moves on.
  function handleKeepWorkspace() {
    setStep(4)
  }

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
        <PersonalityScreen
          state={personality}
          onChange={setPersonality}
          onContinue={handlePersonalityContinue}
          onSkip={handlePersonalitySkip}
        />
      )}
      {step === 3 && (
        <Screen3
          template={template}
          persona={persona}
          isFree={false}
          onAccept={handleAccept}
          onBrowse={handleBrowse}
          // Offered only when there is something to lose: a returning user
          // who ARRIVED with blocks. A first-run user has an empty framework,
          // so "keep" would mean keeping nothing.
          onKeepWorkspace={
            returning && arrivedWithWorkspace.current ? handleKeepWorkspace : undefined
          }
          isCommitting={committing}
          errorMsg={error}
        />
      )}
      {step === 4 && (
        <GuideStep persona={persona} onContinue={() => setStep(5)} />
      )}
      {step === 5 && (
        <div className="fixed inset-0 overflow-y-auto" style={{ background: 'var(--bg)', padding: '48px 24px 80px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 14px', borderRadius: 100,
                background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)',
                fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
                color: 'var(--accent)', fontFamily: 'var(--font-mono, monospace)', marginBottom: 20 }}>
                Almost there
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300,
                letterSpacing: '-0.03em', marginBottom: 12, color: 'var(--text-primary)' }}>
                Choose your plan
              </h1>
              <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
                Your framework is ready.
              </p>
            </div>
            <PricingCards
              onPaidSuccess={handlePaidSuccess}
              onFreeSelected={handleFreeSelected}
            />
          </div>
        </div>
      )}


      {/* Step 6 — Theme preference (final step: onboarded flips here) */}
      {step === 6 && (
        <div className="fixed inset-0 overflow-y-auto" style={{ background: 'var(--bg)', padding: '48px 24px 80px' }}>
          <div style={{ maxWidth: 460, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 14px', borderRadius: 100,
                background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)',
                fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
                color: 'var(--accent)', fontFamily: 'var(--font-mono, monospace)', marginBottom: 20 }}>
                One last step
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300,
                letterSpacing: '-0.03em', marginBottom: 12, color: 'var(--text-primary)' }}>
                Make it yours
              </h1>
              <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
                Pick the look that suits you — you can change it anytime in Account.
              </p>
            </div>

            <div style={{
              padding: '20px 22px', borderRadius: 16,
              background: 'var(--card)', border: '1px solid var(--border)', marginBottom: 24,
            }}>
              <ThemeSettings />
            </div>

            <button
              onClick={() => void finishOnboarding()}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: 'var(--accent-solid)', color: 'white',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}>
              Enter DristiQ →
            </button>
            {error && (
              <p role="alert" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.5,
                color: 'var(--risk-red)',
                background: 'color-mix(in srgb, var(--risk-red) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--risk-red) 25%, transparent)',
                borderRadius: 10, padding: '10px 14px' }}>
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
