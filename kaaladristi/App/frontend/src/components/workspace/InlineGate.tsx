import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Lock, Zap, TrendingUp, BarChart2, Clock, Activity } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { createOrder, openCheckout, verifyPayment } from '@/services/razorpayService'

export type GateContext =
  | 'add_rule'
  | 'add_indicator'
  | 'correlation_view'
  | 'add_instrument'
  | 'free_expired'
  | 'walk_mode'
  | 'save_walk_widget'

interface GateContextConfig {
  icon: React.ReactNode
  message: string
}

const GATE_CONFIGS: Record<GateContext, GateContextConfig> = {
  add_rule: {
    icon: <Zap size={16} />,
    message: "VaNi can't add rules to your framework on the free tier. Upgrade to build your own combination — or try the Trial for 3 days.",
  },
  add_indicator: {
    icon: <Activity size={16} />,
    message: "VaNi can't add this indicator on the free tier. Upgrade to customise your setup.",
  },
  correlation_view: {
    icon: <TrendingUp size={16} />,
    message: 'Full correlation history needs a paid plan. Your free tier shows 1 year — the full 6yr+ picture is where the real patterns emerge.',
  },
  add_instrument: {
    icon: <BarChart2 size={16} />,
    message: 'Free tier is limited to Nifty + 2 instruments. Upgrade to watch any equity, index, or sector.',
  },
  free_expired: {
    icon: <Clock size={16} />,
    message: 'Your free week has ended. Everything you built is saved — pick up where you left off.',
  },
  walk_mode: {
    icon: <TrendingUp size={16} />,
    message: "Walk mode lets you explore all instances on the chart — seeing each confluence period in its historical context. Available on Trial and above.",
  },
  save_walk_widget: {
    icon: <Activity size={16} />,
    message: "Save Walk widgets to your workspace to re-visit any correlation's history at any time. Available on Quarterly and above.",
  },
}

interface InlineGateProps {
  context:   GateContext
  isOpen:    boolean
  onDismiss: () => void
}

function daysLeft(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

export default function InlineGate({ context, isOpen, onDismiss }: InlineGateProps) {
  const navigate   = useNavigate()
  const { profile, refreshProfile } = useAuthStore()
  const [visible, setVisible]     = useState(false)
  const [paying, setPaying]       = useState(false)
  const [payError, setPayError]   = useState<string | null>(null)
  const primaryBtnRef = useRef<HTMLButtonElement>(null)
  const triggerRef    = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement
      requestAnimationFrame(() => {
        setVisible(true)
        primaryBtnRef.current?.focus()
      })
    } else {
      setVisible(false)
      triggerRef.current?.focus()
      triggerRef.current = null
    }
  }, [isOpen])

  if (!isOpen) return null

  const cfg      = GATE_CONFIGS[context]
  const days     = daysLeft(profile?.expires_at)
  const paidTiers = ['trial', 'quarterly', 'annual', 'beta']
  const isFree   = !profile?.tier || !paidTiers.includes(profile.tier)

  async function handleTrialPurchase() {
    if (!profile?.id) return
    setPaying(true)
    setPayError(null)
    try {
      const order = await createOrder('trial', profile.id)
      await openCheckout(
        order,
        { name: profile.full_name, email: profile.email, phone: profile.phone },
        async (paymentId, orderId, signature) => {
          try {
            await verifyPayment(paymentId, orderId, signature)
            await refreshProfile()
            onDismiss()
          } catch (err) {
            setPayError(String(err))
          }
        },
        () => setPaying(false),
      )
    } catch (err) {
      setPayError(String(err))
      setPaying(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        background: 'var(--overlay, rgba(0,0,0,.55))',
        opacity: visible ? 1 : 0,
        transition: 'opacity .2s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Upgrade required"
        style={{
          background: 'var(--card)',
          border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
          borderRadius: 16,
          padding: '28px 28px 24px',
          width: 400,
          position: 'relative',
          boxShadow: '0 8px 40px rgba(0,0,0,.7), 0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent)',
          transform: visible ? 'scale(1)' : 'scale(0.95)',
          transition: 'transform .2s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none',
            cursor: 'pointer', color: 'rgba(255,255,255,.3)', padding: 4 }}>
          <X size={16} />
        </button>

        {/* Lock tag */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 10px', borderRadius: 20, marginBottom: 16,
          background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
          fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono,monospace)' }}>
          <Lock size={10} />
          PAID FEATURE
        </div>

        {/* Context icon + message */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ color: 'var(--accent)', paddingTop: 2, flexShrink: 0 }}>{cfg.icon}</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
            {cfg.message}
          </p>
        </div>

        {/* Free tier remaining bar — only for free + has expiry */}
        {isFree && days !== null && (
          <div style={{ marginBottom: 20, padding: '10px 12px', borderRadius: 8,
            background: 'var(--surface-dim, rgba(255,255,255,.04))',
            border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
              <span>Free tier remaining</span>
              <span style={{ color: days <= 2 ? 'var(--caution)' : 'var(--text-muted)' }}>
                {days} day{days !== 1 ? 's' : ''} left
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--border)' }}>
              <div style={{
                width: `${Math.min(100, (days / 7) * 100)}%`,
                height: '100%', borderRadius: 2,
                background: days <= 2 ? 'var(--caution)' : 'var(--accent)',
                transition: 'width .4s ease',
              }} />
            </div>
          </div>
        )}

        {payError && (
          <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, fontSize: 12,
            background: 'var(--bear-bg)', border: '1px solid var(--bear-dim, rgba(239,68,68,.3))',
            color: '#fca5a5' }}>
            {payError}
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            ref={primaryBtnRef}
            onClick={handleTrialPurchase}
            disabled={paying}
            style={{
              padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: paying
                ? 'color-mix(in srgb, var(--accent) 30%, transparent)'
                : 'color-mix(in srgb, var(--accent) 90%, transparent)',
              border: 'none', color: '#fff', cursor: paying ? 'wait' : 'pointer',
              transition: 'background .15s',
            }}>
            {paying ? 'Opening checkout…' : 'Try everything for 3 days · ₹199 one-time'}
          </button>

          <button
            onClick={() => navigate('/pricing')}
            style={{
              padding: '9px 16px', borderRadius: 10, fontSize: 12,
              background: 'var(--surface-dim, rgba(255,255,255,.05))',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)', cursor: 'pointer',
            }}>
            See all plans →
          </button>

          <button
            onClick={onDismiss}
            style={{
              padding: '7px 16px', borderRadius: 10, fontSize: 12,
              background: 'none', border: 'none',
              color: 'var(--text-faint, rgba(255,255,255,.3))', cursor: 'pointer',
            }}>
            Continue on free tier
          </button>
        </div>
      </div>
    </div>
  )
}
