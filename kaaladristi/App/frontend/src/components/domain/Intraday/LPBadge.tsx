/**
 * LPBadge — placeholder until the LuckyPop webhook is live.
 *
 * Future shape (post-webhook): show signal name + score + dot type +
 * flow type + combined conviction score.
 */

interface LPBadgeProps {
  /** Current LP signal score (Cycle 4 dev toggle), null until webhook */
  lpScore: number | null;
  /** Current LP dot, null when none */
  lpDot: 'SVD' | 'SBD' | 'SYD' | 'PRE-SYD' | null;
}

export default function LPBadge({ lpScore, lpDot }: LPBadgeProps) {
  const hasSignal = lpScore !== null;

  return (
    <div style={{
      border: '1px solid var(--kd-border)',
      borderRadius: 4,
      padding: 12,
      background: 'var(--kd-panel, color-mix(in srgb, var(--text-primary) 2%, transparent))',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
        color: 'var(--text-faint)', letterSpacing: '0.12em',
        textTransform: 'uppercase', marginBottom: 6,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>⚡ LP + FIN Bridge</span>
        <span style={{ color: 'var(--accent-cyan)' }}>★ pending</span>
      </div>

      {hasSignal ? (
        <div style={{
          fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
          color: 'var(--text-primary)', lineHeight: 1.5,
        }}>
          <div>Score: <strong style={{ color: lpScore! > 0 ? 'var(--risk-green)' : lpScore! < 0 ? 'var(--risk-red)' : 'var(--text-muted)' }}>
            {lpScore! > 0 ? '+' : ''}{lpScore}
          </strong></div>
          {lpDot && (
            <div>Dot: <strong style={{ color: 'var(--accent-violet)' }}>● {lpDot}</strong></div>
          )}
          <div style={{
            fontSize: 9, color: 'var(--text-faint)', marginTop: 4,
            fontStyle: 'italic',
          }}>(dev toggle — webhook not yet wired)</div>
        </div>
      ) : (
        <div style={{
          fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
          color: 'var(--text-muted)', lineHeight: 1.5,
        }}>
          <div>Status: <span style={{ color: 'var(--text-faint)' }}>awaiting signal</span></div>
          <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-faint)' }}>
            Configure TradingView webhook →<br/>
            <code style={{
              fontSize: 9, background: 'var(--kd-bg)', padding: '1px 4px',
              borderRadius: 2,
            }}>POST /luckypop/signal</code>
          </div>
        </div>
      )}
    </div>
  );
}
