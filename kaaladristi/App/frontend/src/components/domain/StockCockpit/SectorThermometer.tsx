/**
 * SectorThermometer — a slim vertical CARD of the stock's SECTOR strength
 * (industry percentile, 0–100). Sits as a column beside the chart (outside the
 * plot) so it never collides with the astro background overlays. The fill
 * animates red→amber→green as the story's playhead moves through time.
 */

export default function SectorThermometer({
  percentile,
  leading,
}: {
  percentile: number | null
  leading: boolean
}) {
  const pct = percentile == null ? null : Math.max(0, Math.min(100, percentile))
  const col =
    pct == null ? 'var(--text-muted)'
      : pct >= 70 ? 'var(--risk-green)'
      : pct >= 40 ? 'var(--risk-amber)'
      : 'var(--risk-red)'

  return (
    <div
      className="shrink-0 flex flex-col items-center gap-2 self-center"
      style={{
        width: 66,
        maxHeight: '94%',
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--text-primary) 3%, var(--card)), var(--card))',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: 'var(--card-shadow)',
        padding: '14px 8px',
      }}
    >
      <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted">Sector</div>

      <div
        className="relative"
        style={{
          width: 14,
          flex: '1 1 auto',
          minHeight: 120,
          borderRadius: 8,
          background: 'color-mix(in srgb, var(--text-primary) 9%, transparent)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 3px color-mix(in srgb, black 15%, transparent)',
        }}
      >
        {/* quartile ticks */}
        {[25, 50, 75].map((t) => (
          <div key={t} style={{ position: 'absolute', left: 0, right: 0, bottom: `${t}%`, height: 1, background: 'color-mix(in srgb, var(--text-primary) 9%, transparent)' }} />
        ))}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${pct ?? 0}%`,
            background: col,
            borderRadius: 8,
            transition: 'height 0.6s ease, background 0.4s ease',
            boxShadow: `0 0 10px ${col}`,
          }}
        />
      </div>

      <div className="text-sm font-mono font-bold" style={{ color: col }}>
        {pct == null ? '—' : `${pct}%`}
      </div>

      {leading ? (
        <div
          className="text-[8px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-full"
          style={{
            color: 'var(--risk-green)',
            background: 'color-mix(in srgb, var(--risk-green) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--risk-green) 30%, transparent)',
          }}
        >
          ★ leading
        </div>
      ) : (
        <div className="text-[8px] font-mono uppercase tracking-wide text-muted">percentile</div>
      )}
    </div>
  )
}
