/**
 * App-wide film-grain overlay (Glass UX & Theme Standard §5.5 UxNoiseOverlay).
 * Mounted once at the layout root (App.tsx), not per component. The ambient
 * gradient bloom half of the decorative layer already exists app-wide via
 * `body::before` in globals.css — this adds the other half (texture) that
 * was previously landing-page-only (views/landing/*.tsx's own effects,
 * which stay separate — that page is a standalone design system).
 *
 * Skipped: drifting particles. Continuous animation across every page of a
 * dense data/trading app is a real perf/attention cost for a subtle visual
 * flourish — the gradient bloom + this grain already deliver most of the
 * "depth through translucency" effect. Not an oversight, a scope call.
 */
export function NoiseOverlay() {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: 0.02,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      <filter id="kd-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={3} />
      </filter>
      <rect width="100%" height="100%" filter="url(#kd-noise)" />
    </svg>
  );
}
