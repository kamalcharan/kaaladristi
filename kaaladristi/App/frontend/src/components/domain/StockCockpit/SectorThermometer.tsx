/**
 * SectorThermometer — a slim vertical gauge of the stock's SECTOR strength
 * (industry percentile, 0–100). Lives as a column beside the chart (outside the
 * plot) so it never collides with the astro background overlays. The fill
 * animates as the story's playhead moves through time.
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
    <div className="shrink-0 flex flex-col items-center justify-center gap-1.5" style={{ width: 54 }}>
      <div className="text-[8.5px] font-mono uppercase tracking-wider text-muted">Sector</div>
      <div
        style={{
          position: 'relative',
          width: 12,
          height: '58%',
          minHeight: 120,
          maxHeight: 320,
          borderRadius: 6,
          background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${pct ?? 0}%`,
            background: col,
            borderRadius: 6,
            transition: 'height 0.6s ease, background 0.4s ease',
          }}
        />
      </div>
      <div className="text-[11px] font-mono font-bold" style={{ color: col }}>
        {pct == null ? '—' : `${pct}%`}
      </div>
      {leading && (
        <div className="text-[8px] font-mono uppercase tracking-wide" style={{ color: 'var(--risk-green)' }}>
          leading
        </div>
      )}
    </div>
  )
}
