interface MiniTowerProps {
  value: number | null
  max: number
  color: string
  bars?: number
}

export function MiniTower({ value, max, color, bars = 5 }: MiniTowerProps) {
  const filledBars = value == null ? 0 : Math.round((value / max) * bars)
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'flex-end',
      gap: '2px',
      verticalAlign: 'middle',
      flexShrink: 0,
    }}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} style={{
          width: '3px',
          height: '14px',
          borderRadius: '1px',
          background: i < filledBars ? color : 'var(--border)',
        }} />
      ))}
    </span>
  )
}
