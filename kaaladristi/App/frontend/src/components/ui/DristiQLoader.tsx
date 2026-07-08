/**
 * DristiQ Loader — inline scan loading state.
 * Compact branded animation for use inside scan result areas.
 */

interface DristiQLoaderProps {
  message?: string;
}

export function DristiQLoader({ message = 'Scanning market…' }: DristiQLoaderProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '72px 24px', gap: '28px',
    }}>
      {/* Orb */}
      <div style={{ position: 'relative', width: '72px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* Bindu — gold core */}
        <div style={{
          position: 'absolute', width: '8px', height: '8px',
          borderRadius: '50%', background: '#f0a500',
          boxShadow: '0 0 12px #f0a500, 0 0 24px rgba(240,165,0,0.4)',
          animation: 'dq-pulse 2s ease-in-out infinite',
        }} />

        {/* Inner ring — slow dashed */}
        <div style={{
          position: 'absolute', width: '40px', height: '40px',
          borderRadius: '50%', border: '1.5px dashed rgba(240,165,0,0.35)',
          animation: 'dq-cw 8s linear infinite',
        }} />

        {/* Outer ring — fast with orbiting dot */}
        <div style={{
          position: 'absolute', width: '72px', height: '72px',
          borderRadius: '50%',
          borderTop: '2px solid rgba(240,165,0,0.8)',
          borderRight: '2px solid transparent',
          borderBottom: '2px solid rgba(240,165,0,0.8)',
          borderLeft: '2px solid transparent',
          animation: 'dq-ccw 2.4s cubic-bezier(0.4,0,0.2,1) infinite',
        }}>
          {/* Orbiting dot */}
          <div style={{
            position: 'absolute', top: '-3px', left: '50%',
            transform: 'translateX(-50%)',
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#fff', boxShadow: '0 0 8px color-mix(in srgb, var(--text-primary) 90%, transparent)',
          }} />
        </div>
      </div>

      {/* Label */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px',
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'var(--gold, #f0a500)',
          animation: 'dq-fade 2s ease-in-out infinite',
        }}>
          DristiQ
        </div>
        <div style={{
          marginTop: '5px', fontSize: '12px',
          color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
          letterSpacing: '0.02em',
        }}>
          {message}
        </div>
      </div>

      <style>{`
        @keyframes dq-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.5); opacity: 0.7; }
        }
        @keyframes dq-cw  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes dq-ccw { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes dq-fade {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}
