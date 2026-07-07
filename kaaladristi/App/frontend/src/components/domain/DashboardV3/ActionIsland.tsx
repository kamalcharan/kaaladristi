interface ActionIslandProps {
  pingCount?: number;
  onAction?: () => void;
}

export default function ActionIsland({ pingCount = 0, onAction }: ActionIslandProps) {
  return (
    <div
      className="fixed z-50 flex items-center gap-4"
      style={{
        bottom: 28,
        left: '50%',
        transform: 'translateX(calc(-50% + 110px))',
        background: 'var(--card)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-strong)',
        borderRadius: '100px',
        padding: '10px 14px 10px 22px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{ fontSize: 13, color: 'var(--text-secondary)' }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--indigo)',
            animation: 'pulse-live 2s infinite',
            flexShrink: 0,
          }}
        />
        <span>
          VaNi is reading today&apos;s setup
          {pingCount > 0 && (
            <>
              {' '}·{' '}
              <em
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--text-primary)',
                  fontStyle: 'italic',
                }}
              >
                {pingCount} {pingCount === 1 ? 'ping' : 'pings'} today
              </em>
            </>
          )}
        </span>
      </div>

      <div style={{ width: 1, height: 18, background: 'color-mix(in srgb, var(--text-primary) 12%, transparent)' }} />

      <button
        onClick={onAction}
        style={{
          fontSize: 13,
          padding: '7px 16px',
          background: 'var(--gold)',
          color: '#1a1410',
          border: 'none',
          borderRadius: '100px',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}
      >
        Today&apos;s read
      </button>
    </div>
  );
}
