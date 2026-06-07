/**
 * MarketClosedBanner
 * ==================
 * Strip shown above the top strip when the requested date is not a
 * trading day. Renders the resolved last-trading-date in a clear way
 * so the trader knows what data they're seeing.
 */

interface MarketClosedBannerProps {
  fallbackDate: string;
}

function formatLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function MarketClosedBanner({ fallbackDate }: MarketClosedBannerProps) {
  return (
    <div style={{
      padding: '6px 16px',
      background: 'var(--caution-bg)',
      borderBottom: '1px solid var(--risk-amber, rgba(245,158,11,0.40))',
      fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
      color: 'var(--risk-amber)', letterSpacing: '0.04em',
    }}>
      ⊘ Market non-working — showing data for {formatLong(fallbackDate)}
    </div>
  );
}
