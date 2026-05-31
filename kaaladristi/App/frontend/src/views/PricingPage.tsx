import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Zap, TrendingUp, BarChart2, Brain, Star } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { createOrder, openCheckout, verifyPayment } from '@/services/razorpayService'

const TIERS = [
  {
    id:       'free' as const,
    label:    'Free',
    price:    '₹0',
    duration: '1 week',
    cta:      'Current plan',
    highlight: false,
  },
  {
    id:       'trial' as const,
    label:    'Trial',
    price:    '₹199',
    duration: '3 days',
    cta:      'Start Trial →',
    highlight: false,
  },
  {
    id:       'quarterly' as const,
    label:    'Quarterly',
    price:    '₹1,999',
    duration: '3 months',
    cta:      'Subscribe →',
    highlight: false,
  },
  {
    id:       'annual' as const,
    label:    'Annual',
    price:    '₹4,999',
    duration: '1 year',
    cta:      'Best value →',
    highlight: true,
  },
]

const FEATURES: { label: string; free: boolean; trial: boolean; paid: boolean; icon: React.ReactNode }[] = [
  { label: 'Nifty 50 dashboard',                free: true,  trial: true,  paid: true,  icon: <BarChart2 size={13} /> },
  { label: 'Visual Pulse — index',              free: true,  trial: true,  paid: true,  icon: <TrendingUp size={13} /> },
  { label: 'Panchang + astro calendar',         free: true,  trial: true,  paid: true,  icon: <Star size={13} /> },
  { label: 'Workspace — 2 instruments',         free: true,  trial: true,  paid: true,  icon: <Zap size={13} /> },
  { label: 'VaNi insights',                     free: false, trial: true,  paid: true,  icon: <Brain size={13} /> },
  { label: 'Correlation detection',             free: false, trial: true,  paid: true,  icon: <TrendingUp size={13} /> },
  { label: 'All astro rules + framework',       free: false, trial: true,  paid: true,  icon: <Star size={13} /> },
  { label: 'Unlimited instruments',             free: false, trial: true,  paid: true,  icon: <BarChart2 size={13} /> },
  { label: 'Full 6yr+ correlation history',     free: false, trial: true,  paid: true,  icon: <TrendingUp size={13} /> },
  { label: 'Visual Pulse — equities',           free: false, trial: true,  paid: true,  icon: <BarChart2 size={13} /> },
  { label: 'Scanner — all presets',             free: false, trial: true,  paid: true,  icon: <Zap size={13} /> },
  { label: 'Intraday cockpit',                  free: false, trial: false, paid: true,  icon: <Brain size={13} /> },
]

export default function PricingPage() {
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuthStore()
  const [paying, setPaying]   = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)

  const currentTier = profile?.tier ?? 'free'
  const paidTiers   = ['trial', 'quarterly', 'annual', 'beta']

  async function handleCta(tierId: string) {
    if (tierId === 'free') return
    if (!profile?.id) { navigate('/login'); return }

    setPaying(tierId)
    setPayError(null)
    try {
      const order = await createOrder(tierId, profile.id)
      await openCheckout(
        order,
        { name: profile.full_name, email: profile.email, phone: profile.phone },
        async (paymentId, orderId, signature) => {
          try {
            await verifyPayment(paymentId, orderId, signature)
            await refreshProfile()
            navigate('/workspace')
          } catch (err) {
            setPayError(String(err))
          } finally {
            setPaying(null)
          }
        },
        () => setPaying(null),
      )
    } catch (err) {
      setPayError(String(err))
      setPaying(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0d0d17)',
      padding: '48px 24px 80px', color: 'var(--text-primary, #fff)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 300,
            letterSpacing: '-0.03em', marginBottom: 12 }}>
            Choose your plan
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-muted, #6b7280)', maxWidth: 420, margin: '0 auto' }}>
            Kāla-Drishti combines astronomical intelligence with market data.
            Start free, upgrade when you're ready.
          </p>
        </div>

        {payError && (
          <div style={{ maxWidth: 500, margin: '0 auto 24px', padding: '10px 16px', borderRadius: 10,
            background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
            fontSize: 13, color: '#fca5a5', textAlign: 'center' }}>
            {payError}
          </div>
        )}

        {/* Tier cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 56 }}>
          {TIERS.map(tier => {
            const isCurrent = currentTier === tier.id || (tier.id !== 'free' && currentTier === tier.id)
            const isCurrentFree = tier.id === 'free' && !paidTiers.includes(currentTier)

            return (
              <div key={tier.id} style={{
                borderRadius: 16, padding: '24px 20px',
                background: tier.highlight ? 'rgba(139,92,246,.12)' : 'rgba(255,255,255,.04)',
                border: `1px solid ${tier.highlight ? 'rgba(139,92,246,.5)' : 'rgba(255,255,255,.1)'}`,
                position: 'relative',
                boxShadow: tier.highlight ? '0 0 30px rgba(139,92,246,.15)' : 'none',
              }}>
                {tier.highlight && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    padding: '2px 12px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                    background: '#8b5cf6', color: '#fff', letterSpacing: '.06em',
                    fontFamily: 'var(--font-mono,monospace)' }}>
                    BEST VALUE
                  </div>
                )}

                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)',
                  marginBottom: 8, letterSpacing: '.03em' }}>
                  {tier.label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                  {tier.price}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', marginBottom: 24 }}>
                  {tier.duration}
                </div>

                <button
                  onClick={() => handleCta(tier.id)}
                  disabled={tier.id === 'free' || !!paying || isCurrentFree || isCurrent}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 10, fontSize: 13,
                    fontWeight: 600, border: 'none', cursor:
                      (tier.id === 'free' || isCurrentFree || isCurrent) ? 'default' :
                      paying ? 'wait' : 'pointer',
                    background: tier.highlight
                      ? 'rgba(139,92,246,.9)'
                      : isCurrentFree || isCurrent
                        ? 'rgba(255,255,255,.06)'
                        : 'rgba(255,255,255,.1)',
                    color: isCurrentFree || isCurrent ? 'rgba(255,255,255,.35)' : '#fff',
                    transition: 'background .15s',
                  }}>
                  {paying === tier.id ? 'Opening checkout…' :
                   isCurrentFree ? 'Current plan' :
                   isCurrent     ? 'Active' :
                   tier.cta}
                </button>
              </div>
            )
          })}
        </div>

        {/* Feature comparison */}
        <div style={{ borderRadius: 16, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px',
            padding: '12px 20px', background: 'rgba(255,255,255,.04)',
            borderBottom: '1px solid rgba(255,255,255,.08)', fontSize: 11,
            color: 'rgba(255,255,255,.4)', fontFamily: 'var(--font-mono,monospace)',
            letterSpacing: '.04em', textAlign: 'center' }}>
            <span style={{ textAlign: 'left' }}>FEATURE</span>
            <span>FREE</span>
            <span>TRIAL</span>
            <span>QTR</span>
            <span>ANNUAL</span>
          </div>

          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px',
              padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,.05)',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.01)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
                <span style={{ color: 'rgba(139,92,246,.6)' }}>{f.icon}</span>
                {f.label}
              </div>
              {[f.free, f.trial, f.paid, f.paid].map((yes, j) => (
                <div key={j} style={{ textAlign: 'center', display: 'flex',
                  alignItems: 'center', justifyContent: 'center' }}>
                  {yes
                    ? <Check size={14} style={{ color: '#22c55e' }} />
                    : <span style={{ color: 'rgba(255,255,255,.15)', fontSize: 16 }}>—</span>
                  }
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12,
          color: 'rgba(255,255,255,.25)' }}>
          All payments processed by Razorpay. Prices include GST.
          Cancel or change plan from Settings → Account.
        </p>
      </div>
    </div>
  )
}
