import { useEffect, useState } from 'react';

/**
 * Live height of the app shell's sticky topbar (`main > header` in
 * components/domain/Layout.tsx).
 *
 * For a page that wants to fill exactly the viewport below the topbar — the
 * scanner shell, with its own internal scroll region and a footer that must
 * never scroll away — the only correct subtrahend is the header's real
 * rendered height. ScanView hardcoded 46px; measured 2026-09-06 the header is
 * 75px on desktop and 67px on a phone, so the "always visible" disclaimer
 * footer had been sitting 21px below the fold on desktop the whole time.
 * Measuring it keeps the two in step no matter how the topbar's padding or
 * contents change.
 *
 * Falls back to 0 until mounted (renders as a full-height page for one frame).
 */
export function useTopbarHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('main > header');
    if (!header) return;
    const update = () => setHeight(header.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);
  return height;
}
