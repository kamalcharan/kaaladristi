export default function CustomIndexPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Page header */}
      <div
        style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Custom Index
          </h1>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-faint)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
            }}
          >
            NSE Only
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            disabled
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'not-allowed',
              opacity: 0.5,
            }}
          >
            + Create Manually
          </button>
          <button
            disabled
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              borderRadius: '8px',
              border: '1px solid var(--accent-indigo)',
              background: 'rgba(99,102,241,0.08)',
              color: 'var(--accent-indigo)',
              cursor: 'not-allowed',
              opacity: 0.5,
            }}
          >
            ✨ Discover with AI
          </button>
        </div>
      </div>

      {/* Empty state */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            padding: '48px 32px',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            background: 'var(--surface)',
            maxWidth: '360px',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '16px', opacity: 0.4 }}>⊞</div>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              margin: '0 0 8px',
            }}
          >
            No custom indices yet
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Use the buttons above to create your first basket
          </p>
        </div>
      </div>

    </div>
  );
}
