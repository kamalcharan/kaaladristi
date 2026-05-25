import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { updateProfile } from '@/services/auth'

// Screens 3 + 4 are added in the next implementation step.
// step === 3 renders null as a placeholder until then.

type Step = 1 | 2 | 3 | 4
type ICP  = 'investor' | 'trader' | 'both'

// ── Keyframe animations (injected once, referenced by inline styles) ──────────

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

// ── Shared constants ──────────────────────────────────────────────────────────

const V = 'rgba(124,106,247,'  // VaNi purple base for rgba helpers

// ── Screen 1 — VaNi Introduction ─────────────────────────────────────────────

interface S1Props {
  displayName: string
  setDisplayName: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  onBegin: () => void
}

function Screen1({ displayName, setDisplayName, phone, setPhone, onBegin }: S1Props) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* Ambient glows */}
      <div style={{
        position: 'absolute', width: 700, height: 700, borderRadius: '50%',
        background: `radial-gradient(circle, ${V}.07) 0%, transparent 65%)`,
        top: -200, left: -200, filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(201,168,76,.04) 0%, transparent 65%)',
        bottom: -100, right: -100, filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      {/* Orb system */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', pointerEvents: 'none' }}>
        {/* Rings */}
        {[
          { size: 340, opacity: .08, dur: '30s', dir: 'ring-spin-cw' },
          { size: 240, opacity: .12, dur: '20s', dir: 'ring-spin-ccw' },
          { size: 160, opacity: .18, dur: '15s', dir: 'ring-spin-cw' },
        ].map(({ size, opacity, dur, dir }) => (
          <div key={size} style={{
            position: 'absolute', width: size, height: size, borderRadius: '50%',
            border: `1px solid rgba(124,106,247,${opacity})`,
            top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            animation: `${dir} ${dur} linear infinite`,
          }} />
        ))}
        {/* Particles */}
        {[
          { top: '30%', left: '40%', dx: '40px', dy: '-60px', d: '7s', delay: '0s' },
          { top: '60%', left: '60%', dx: '-30px', dy: '-40px', d: '5s', delay: '.8s' },
          { top: '45%', left: '30%', dx: '20px', dy: '30px', d: '9s', delay: '1.5s' },
          { top: '35%', left: '65%', dx: '-50px', dy: '-20px', d: '6s', delay: '.3s' },
        ].map(({ top, left, dx, dy, d, delay }, i) => (
          <div key={i} style={{
            position: 'absolute', top, left,
            width: 2, height: 2, borderRadius: '50%',
            background: `${V}.5)`,
            // @ts-ignore CSS custom property
            '--px': dx, '--py': dy,
            animation: `particle-float ${d} ${delay} ease-in-out infinite alternate`,
          } as React.CSSProperties} />
        ))}
        {/* Orb core */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 80, height: 80,
          background: 'linear-gradient(135deg, #9d8ff9 0%, #5b4fd4 50%, #3d2fa8 100%)',
          filter: 'blur(1px)',
          animation: 'orb-morph 8s ease-in-out infinite alternate, orb-pulse 3s ease-in-out infinite',
        }} />
      </div>

      {/* Intro card — positioned above orb, centered */}
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', animation: 'card-rise .9s cubic-bezier(.22,1,.36,1) .4s both' }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 14px', borderRadius: 100,
          background: `${V}.1)`, border: `1px solid ${V}.25)`,
          fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
          color: '#7c6af7', fontFamily: 'var(--font-mono, monospace)',
          marginBottom: 28,
          animation: 'text-in .6s ease .8s both',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#7c6af7',
            animation: 'badge-pulse 2s ease-in-out infinite',
            display: 'inline-block',
          }} />
          Agentic Intelligence
        </div>

        {/* Title */}
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 300,
          letterSpacing: '-0.03em', color: 'var(--text-primary)',
          animation: 'text-in .6s ease .8s both',
        }}>
          I'm
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 400,
          fontStyle: 'italic', letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #9d8ff9, #c9a84c)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'text-in .6s ease .95s both',
        }}>
          VaNi.
        </div>

        {/* Subtext */}
        <p style={{
          fontSize: 15, color: 'var(--text-muted)', marginTop: 16, marginBottom: 32,
          lineHeight: 1.65, maxWidth: 400,
          animation: 'text-in .6s ease 1.1s both',
        }}>
          I'll help you build your market intelligence framework.
        </p>

        {/* Subtle profile form */}
        <div style={{
          maxWidth: 340, margin: '0 auto 28px',
          animation: 'text-in .6s ease 1.2s both',
        }}>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="What should I call you? (optional)"
            style={{
              width: '100%', padding: '10px 16px',
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 10, fontSize: 13, color: 'var(--text-primary)',
              outline: 'none', marginBottom: 8, fontFamily: 'inherit',
            }}
          />
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Phone for alerts (optional)"
            style={{
              width: '100%', padding: '10px 16px',
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 10, fontSize: 13, color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Begin CTA */}
        <button
          onClick={onBegin}
          style={{
            padding: '14px 40px', border: 'none', borderRadius: 100, cursor: 'pointer',
            fontSize: 15, fontWeight: 500, fontFamily: 'inherit',
            background: 'linear-gradient(135deg, #7c6af7, #5b4fd4)',
            color: '#fff', letterSpacing: '.01em',
            boxShadow: `0 4px 24px ${V}.5), 0 1px 0 rgba(255,255,255,.1) inset`,
            transition: 'all .2s ease',
            animation: 'text-in .6s ease 1.3s both',
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)'
            ;(e.target as HTMLButtonElement).style.boxShadow = `0 8px 32px ${V}.6)`
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.transform = ''
            ;(e.target as HTMLButtonElement).style.boxShadow = `0 4px 24px ${V}.5), 0 1px 0 rgba(255,255,255,.1) inset`
          }}
        >
          Let VaNi begin →
        </button>
      </div>
    </div>
  )
}

// ── Screen 2 — ICP Question ───────────────────────────────────────────────────

interface S2Props {
  typed: boolean
  icp: ICP | null
  onSelect: (val: ICP) => void
  blend: number
  setBlend: (v: number) => void
  onContinue: () => void
}

function Screen2({ typed, icp, onSelect, blend, setBlend, onContinue }: S2Props) {
  const tiles: { val: ICP; icon: string; label: string; sub: string }[] = [
    { val: 'investor', icon: '🌱', label: 'Investor',  sub: 'Weeks to months' },
    { val: 'trader',   icon: '⚡', label: 'Trader',    sub: 'Swing & short-term' },
    { val: 'both',     icon: '⚖️', label: 'Both',      sub: 'Set your blend' },
  ]

  const islandText = icp === 'investor'
    ? 'Investor profile selected'
    : icp === 'trader'
      ? 'Trader profile selected'
      : icp === 'both'
        ? 'Set your blend — then build'
        : 'Select how you participate in markets'

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: 'var(--bg)', paddingTop: 52 }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-6">

        {/* VaNi avatar + bubble */}
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start', maxWidth: 520, width: '100%',
          marginBottom: 32,
          animation: 'bubble-in .4s cubic-bezier(.22,1,.36,1) both',
        }}>
          {/* Avatar */}
          <div style={{
            width: 34, height: 34, flexShrink: 0, borderRadius: 10,
            background: 'linear-gradient(135deg, #9d8ff9, #5b4fd4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 3px 12px ${V}.4)`,
            fontSize: 13, fontWeight: 700, color: '#fff',
            fontFamily: 'var(--font-mono, monospace)', marginTop: 2,
          }}>
            V
          </div>

          {/* Bubble */}
          <div style={{
            background: 'var(--bg-elevated, #0d1117)',
            border: '1px solid rgba(255,255,255,.14)',
            borderRadius: '3px 14px 14px 14px',
            padding: '14px 18px', fontSize: 14,
            color: 'var(--text-primary)', lineHeight: 1.65, maxWidth: 460,
          }}>
            {!typed ? (
              /* typing dots */
              <span style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '6px 4px' }}>
                {[0, 200, 400].map(delay => (
                  <span key={delay} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'rgba(255,255,255,.15)',
                    display: 'inline-block',
                    animation: `typing-dot 1.2s ease-in-out ${delay}ms infinite`,
                  }} />
                ))}
              </span>
            ) : (
              <span style={{ animation: 'bubble-in .4s cubic-bezier(.22,1,.36,1) both' }}>
                One thing —{' '}
                <span style={{ color: '#c9a84c', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15 }}>
                  how do you participate in markets?
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  This is all I need to get started. You can change anything after.
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Option tiles */}
        {typed && (
          <div style={{
            display: 'flex', gap: 10, maxWidth: 520, width: '100%',
            animation: 'bubble-in .4s ease .1s both',
          }}>
            {tiles.map(({ val, icon, label, sub }) => (
              <button
                key={val}
                onClick={() => onSelect(val)}
                style={{
                  flex: 1, padding: '18px 14px',
                  border: `1px solid ${icp === val ? '#7c6af7' : 'rgba(255,255,255,.07)'}`,
                  borderRadius: 12,
                  background: icp === val ? 'rgba(124,106,247,.08)' : 'rgba(13,17,23,1)',
                  cursor: 'pointer', textAlign: 'center',
                  transition: 'all .2s ease',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  if (icp !== val) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.14)'
                }}
                onMouseLeave={e => {
                  if (icp !== val) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.07)'
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{sub}</div>
              </button>
            ))}
          </div>
        )}

        {/* Blend slider — only for "both" */}
        {typed && icp === 'both' && (
          <div style={{
            maxWidth: 520, width: '100%', marginTop: 10,
            padding: '16px 20px',
            border: '1px solid rgba(255,255,255,.07)', borderRadius: 12,
            background: 'rgba(13,17,23,1)',
            animation: 'bubble-in .3s ease both',
          }}>
            <div style={{
              textAlign: 'center', fontFamily: 'var(--font-mono, monospace)',
              fontSize: 13, color: '#c9a84c', marginBottom: 12,
            }}>
              {blend}% Investor · {100 - blend}% Trader
            </div>
            <input
              type="range" min={10} max={90} value={blend}
              onChange={e => setBlend(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#c9a84c' }}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: 'var(--text-muted)', marginTop: 8,
              fontFamily: 'var(--font-mono, monospace)',
            }}>
              <span>← Investor</span>
              <span>Trader →</span>
            </div>
          </div>
        )}

      </div>

      {/* Action island */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(9,12,16,.95)',
        border: `1px solid ${V}.3)`,
        borderRadius: 28, padding: '10px 20px 10px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        backdropFilter: 'blur(20px)',
        boxShadow: `0 8px 32px rgba(0,0,0,.5), 0 0 0 1px ${V}.08)`,
        zIndex: 200, minWidth: 320,
        animation: 'bubble-in .4s ease .3s both',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          background: 'radial-gradient(circle at 35% 35%, #9d8ff9, #5b4fd4)',
          animation: 'badge-pulse 2.5s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>
          {islandText}
        </span>
        {icp === 'both' && (
          <button
            onClick={onContinue}
            style={{
              padding: '7px 16px', border: 'none', borderRadius: 100, cursor: 'pointer',
              fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
              background: '#7c6af7', color: '#fff', flexShrink: 0,
              transition: 'background .2s',
            }}
          >
            Build my workspace →
          </button>
        )}
      </div>
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

export default function ProfileSetup() {
  const navigate   = useNavigate()
  const { profile, refreshProfile, setProfile } = useAuthStore()

  const [step, setStep]               = useState<Step>(1)
  const [icp,  setIcp]                = useState<ICP | null>(null)
  const [blend, setBlend]             = useState(50)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [phone, setPhone]             = useState(profile?.phone ?? '')
  const [s2Typed, setS2Typed]         = useState(false)

  // Typing animation for Screen 2 — reveal question after 1.4s
  useEffect(() => {
    if (step !== 2) return
    setS2Typed(false)
    const t = setTimeout(() => setS2Typed(true), 1400)
    return () => clearTimeout(t)
  }, [step])

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
    // Investor / Trader: immediately advance; Both: waits for "Build my workspace →"
    if (val !== 'both') {
      setTimeout(() => setStep(3), 280)
    }
  }

  // Steps 3 + 4 implemented in next step — placeholder renders nothing
  if (step >= 3) {
    // TODO: replace with Screen3 / Screen4 in next implementation step
    const _ = { navigate, refreshProfile, setProfile, icp, blend, displayName, phone }
    void _
    return null
  }

  return (
    <>
      <style>{KEYFRAMES}</style>
      {step === 1 && (
        <Screen1
          displayName={displayName}
          setDisplayName={setDisplayName}
          phone={phone}
          setPhone={setPhone}
          onBegin={handleBegin}
        />
      )}
      {step === 2 && (
        <Screen2
          typed={s2Typed}
          icp={icp}
          onSelect={handleSelectICP}
          blend={blend}
          setBlend={setBlend}
          onContinue={() => setStep(3)}
        />
      )}
    </>
  )
}
