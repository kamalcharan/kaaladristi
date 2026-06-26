export default function CustomIndexDiscoverPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'baseline',
          gap: '10px',
        }}
      >
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
          Discover with AI
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

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          <div style={{ fontSize: '32px', marginBottom: '16px', opacity: 0.4 }}>✨</div>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              margin: '0 0 8px',
            }}
          >
            Coming soon
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            AI-guided basket discovery is under construction
          </p>
        </div>
      </div>
    </div>
  );
}
