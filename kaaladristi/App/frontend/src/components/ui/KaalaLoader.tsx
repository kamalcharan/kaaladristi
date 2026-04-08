/**
 * Kaaladristi Loader
 * Full-screen overlay shown during async transactions.
 * Design: Bindu (gold core) + slow astro ring + fast momentum ring + orbiting planet.
 */

interface KaalaLoaderProps {
  message?: string;
  subtext?: string;
}

export function KaalaLoader({
  message = 'Synchronizing Kaala Cycles',
  subtext  = 'aligning charts with planetary transits...',
}: KaalaLoaderProps) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-kd-bg/90 backdrop-blur-sm">
      {/* Rings */}
      <div className="relative flex items-center justify-center w-[120px] h-[120px]">

        {/* Core — Bindu */}
        <div
          className="absolute w-3 h-3 rounded-full bg-[#fbbf24]"
          style={{
            boxShadow: '0 0 20px #f97316, 0 0 40px #f97316',
            animation: 'kaala-pulse 2s infinite ease-in-out',
          }}
        />

        {/* Astro ring — slow clockwise dashed */}
        <div
          className="absolute w-[80px] h-[80px] rounded-full"
          style={{
            border: '2px dashed rgba(251,191,36,0.3)',
            animation: 'kaala-rotate-cw 10s linear infinite',
          }}
        />

        {/* Momentum ring — fast counter-clockwise with orbiting planet */}
        <div
          className="absolute w-[120px] h-[120px] rounded-full"
          style={{
            border: '1px solid transparent',
            borderTop: '2px solid #f97316',
            borderBottom: '2px solid #f97316',
            animation: 'kaala-rotate-ccw 3s cubic-bezier(0.4,0,0.2,1) infinite',
          }}
        >
          {/* Orbiting planet */}
          <div
            className="absolute w-1.5 h-1.5 rounded-full bg-white"
            style={{
              top: '-4px',
              left: '50%',
              transform: 'translateX(-50%)',
              boxShadow: '0 0 10px #fff',
            }}
          />
        </div>
      </div>

      {/* Text */}
      <div
        className="mt-12 text-center text-accent-gold uppercase text-xs font-bold tracking-[0.2em]"
        style={{ animation: 'kaala-fade-text 2s infinite' }}
      >
        {message}
        {subtext && (
          <div className="text-[10px] text-[var(--text-muted)] mt-1 lowercase font-normal tracking-normal italic not-italic normal-case">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}
