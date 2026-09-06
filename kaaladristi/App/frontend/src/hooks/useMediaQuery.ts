import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query from React. Returns whether it currently
 * matches, and re-renders on change (rotation, window resize, split-screen).
 *
 * Exists for the cases Tailwind's responsive classes cannot express — layout
 * that is STATEFUL or STRUCTURAL rather than cosmetic: a side rail that
 * becomes a horizontal strip, a fixed-height scroll region that becomes
 * normal document flow, a transform that must compose with a CSS variable.
 * For purely cosmetic differences prefer `md:` classes, which need no JS
 * and never flash on first paint.
 *
 * Server-safe: with no `window` it reports false until mounted.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tailwind's `md` breakpoint (768px), the one the app shell already uses to
 *  turn the sidebar into an overlay. Below it, treat the device as a phone. */
export const MD_UP = '(min-width: 768px)';

export function useIsPhone(): boolean {
  return !useMediaQuery(MD_UP);
}
