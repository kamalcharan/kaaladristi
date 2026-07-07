import { useState } from 'react'
import { Check, Zap, TrendingUp, BarChart2, Brain, Star } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { startTrialCheckout, startSubscriptionCheckout } from '@/services/razorpayService'

const TIERS = [
  { id: 'free'      as const, label: 'Free',      price: '₹0',     duration: '1 week',   cta: 'Current plan',  highlight: false },
  { id: 'trial'     as const, label: 'Trial',     price: '₹199',   duration: '3 days',   cta: 'Start Trial →', highlight: false },
  { id: 'quarterly' as const, label: 'Quarterly', price: '₹1,999', duration: '3 months', cta: 'Subscribe →',   highlight: false },
  { id: 'annual'    as const, label: 'Annual',    price: '₹4,999', duration: '1 year',   cta: 'Best value →',  highlight: true  },
]

const FEATURES: { label: string; free: boolean; trial: boolean; paid: boolean; icon: React.ReactNode }[] = [
  { label: 'Nifty 50 dashboard',            free: true,  trial: true,  paid: true,  icon: <BarChart2 size={13} /> },
  { label: 'Visual Pulse — index',          free: true,  trial: true,  paid: true,  icon: <TrendingUp size={13} /> },
  { label: 'Panchang + astro calendar',     free: true,  trial: true,  paid: true,  icon: <Star size={13} /> },
  { label: 'Workspace — 2 instruments',     free: true,  trial: true,  paid: true,  icon: <Zap size={13} /> },
  { label: 'VaNi insights',                 free: false, trial: true,  paid: true,  icon: <Brain size={13} /> },
  { label: 'Correlation detection',         free: false, trial: true,  paid: true,  icon: <TrendingUp size={13} /> },
  { label: 'All astro rules + framework',   free: false, trial: true,  paid: true,  icon: <Star size={13} /> },
  { label: 'Unlimited instruments',         free: false, trial: true,  paid: true,  icon: <BarChart2 size={13} /> },
  { label: 'Full 6yr+ correlation history', free: false, trial: true,  paid: true,  icon: <TrendingUp size={13} /> },
  { label: 'Visual Pulse — equities',       free: false, trial: true,  paid: true,  icon: <BarChart2 size={13} /> },
  { label: 'Scanner — all presets',         free: false, trial: true,  paid: true,  icon: <Zap size={13} /> },
  { label: 'Intraday cockpit',              free: false, trial: false, paid: true,  icon: <Brain size={13} /> },
]

const PAID_TIER_IDS = ['trial', 'quarterly', 'annual', 'beta']

interface PricingCardsProps {
  // Onboarding mode: show "Continue free →" skip link and call these callbacks
  onPaidSuccess?: () => void   // called after successful payment + refreshProfile
  onFreeSelected?: () => void  // called when user clicks "Continue free →"
}

export default function PricingCards({ onPaidSuccess, onFreeSelected }: PricingCardsProps) {
  const { profile, refreshProfile } = useAuthStore()
  const [paying,   setPaying]   = useState<string | null>(null)
  const [activating, setActivating] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const currentTier   = profile?.tier ?? 'free'
  const isOnboarding  = !!onPaidSuccess || !!onFreeSelected

  async function pollProfileUntilUpgraded() {
    setActivating(true)
    const startTier = profile?.tier ?? 'free'
    const deadline  = Date.now() + 30_000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000))
      await refreshProfile()
      const current = useAuthStore.getState().profile
      if (current?.tier && current.tier !== startTier && current.tier !== 'free') {
        setActivating(false)
        setPaying(null)
        onPaidSuccess?.()
        return
      }
    }
    setActivating(false)
    setPaying(null)
  }

  async function handleCta(tierId: string) {
    if (tierId === 'free') return
    if (!profile?.id) return

    setPaying(tierId)
    setPayError(null)
    try {
      if (tierId === 'trial') {
        await startTrialCheckout(
          profile.id,
          { name: profile.full_name, email: profile.email },
          () => pollProfileUntilUpgraded(),
          () => setPaying(null),
        )
      } else if (tierId === 'quarterly') {
        await startSubscriptionCheckout(
          'quarterly',
          profile.id,
          { name: profile.full_name, email: profile.email },
          () => pollProfileUntilUpgraded(),
          () => setPaying(null),
        )
      } else if (tierId === 'annual') {
        await startSubscriptionCheckout(
          'annual',
          profile.id,
          { name: profile.full_name, email: profile.email },
          () => pollProfileUntilUpgraded(),
          () => setPaying(null),
        )
      }
    } catch (err) {
      setPayError(String(err))
      setPaying(null)
    }
  }

  return (
    <div>
      {payError && (
        <div style={{ maxWidth: 500, margin: '0 auto 24px', padding: '10px 16px', borderRadius: 10,
          background: 'var(--bear-bg)', border: '1px solid var(--bear-dim, rgba(239,68,68,.3))',
          fontSize: 13, color: '#fca5a5', textAlign: 'center' }}>
          {payError}
        </div>
      )}

      {/* Tier cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        {TIERS.map(tier => {
          const isCurrentFree = tier.id === 'free' && !PAID_TIER_IDS.includes(currentTier)
          const isCurrent     = tier.id === currentTier
          const disabled      = tier.id === 'free' || isCurrentFree || isCurrent || !!paying

          return (
            <div key={tier.id} style={{
              borderRadius: 16, padding: '24px 20px', position: 'relative',
              background: tier.highlight ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--card)',
              border: `1px solid ${tier.highlight ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'var(--border)'}`,
              boxShadow: tier.highlight ? '0 0 30px color-mix(in srgb, var(--accent) 15%, transparent)' : 'none',
            }}>
              {tier.highlight && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  padding: '2px 12px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                  background: 'var(--accent)', color: '#fff', letterSpacing: '.06em',
                  fontFamily: 'var(--font-mono,monospace)' }}>
                  BEST VALUE
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '.03em' }}>
                {tier.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {tier.price}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', marginBottom: 24 }}>
                {tier.duration}
              </div>
              <button
                onClick={() => handleCta(tier.id)}
                disabled={disabled || activating}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10, fontSize: 13,
                  fontWeight: 600, border: 'none',
                  cursor: (disabled || activating) ? (paying ? 'wait' : 'default') : 'pointer',
                  background: tier.highlight
                    ? 'var(--accent-solid)'
                    : (isCurrentFree || isCurrent) ? 'color-mix(in srgb, var(--text-primary) 6%, transparent)' : 'color-mix(in srgb, var(--text-primary) 10%, transparent)',
                  color: (isCurrentFree || isCurrent) ? 'var(--text-muted)' : '#fff',
                  transition: 'background .15s',
                }}>
                {activating        ? 'Activating your plan…' :
                 paying === tier.id ? 'Opening checkout…' :
                 isCurrentFree      ? 'Current plan' :
                 isCurrent          ? 'Active' :
                 tier.cta}
              </button>
            </div>
          )
        })}
      </div>

      {/* Feature comparison */}
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px',
          padding: '12px 20px', background: 'var(--surface-dim, color-mix(in srgb, var(--text-primary) 4%, transparent))',
          borderBottom: '1px solid var(--border)', fontSize: 11,
          color: 'var(--text-muted)', fontFamily: 'var(--font-mono,monospace)',
          letterSpacing: '.04em', textAlign: 'center' }}>
          <span style={{ textAlign: 'left' }}>FEATURE</span>
          <span>FREE</span><span>TRIAL</span><span>QTR</span><span>ANNUAL</span>
        </div>
        {FEATURES.map((f, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px',
            padding: '11px 20px', borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 5%, transparent)',
            background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--text-primary) 1%, transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--accent)' }}>{f.icon}</span>
              {f.label}
            </div>
            {[f.free, f.trial, f.paid, f.paid].map((yes, j) => (
              <div key={j} style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {yes
                  ? <Check size={14} style={{ color: '#22c55e' }} />
                  : <span style={{ color: 'var(--text-faint)', fontSize: 16 }}>—</span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Onboarding: skip link */}
      {isOnboarding && (
        <div style={{ textAlign: 'center' }}>
          <button onClick={onFreeSelected}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--text-muted)', textDecoration: 'underline',
              textUnderlineOffset: 3 }}>
            Continue with Free plan →
          </button>
        </div>
      )}

      {/* Standalone page: footer note */}
      {!isOnboarding && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-faint)' }}>
          All payments processed by Razorpay. Prices include GST.
          Cancel or change plan from Settings → Account.
        </p>
      )}
    </div>
  )
}
