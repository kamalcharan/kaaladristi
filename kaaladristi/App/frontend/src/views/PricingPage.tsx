import { useNavigate } from 'react-router-dom'
import PricingCards from '@/components/domain/Pricing/PricingCards'

export default function PricingPage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0d0d17)',
      padding: '48px 24px 80px', color: 'var(--text-primary, #fff)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

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

        <PricingCards onPaidSuccess={() => navigate('/workspace')} />

      </div>
    </div>
  )
}
