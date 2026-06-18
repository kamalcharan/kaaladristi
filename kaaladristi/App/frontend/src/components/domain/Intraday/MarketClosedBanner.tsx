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

const _BANNER_DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const _BANNER_MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = _BANNER_DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} · ${String(d).padStart(2, '0')}-${_BANNER_MON[m - 1]}-${y}`;
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
