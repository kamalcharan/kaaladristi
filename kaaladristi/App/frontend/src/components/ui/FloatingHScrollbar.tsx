import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * FloatingHScrollbar — an always-reachable horizontal scrollbar for a scroll
 * container whose own bottom scrollbar sits below the fold.
 *
 * A box with `overflow-x: auto` is forced by the browser to own its vertical
 * scroll too, and its native horizontal scrollbar lives at the box's bottom
 * edge — often off-screen on a tall table, so you'd have to scroll to the last
 * row to pan sideways. This renders a thin bar fixed to the viewport bottom,
 * aligned to the target and synced to its scrollLeft, shown only while the
 * target's own scrollbar is out of view (target.bottom > viewport bottom).
 *
 * Portaled to <body> so no transformed/overflow-hidden ancestor can clip or
 * re-anchor the fixed bar. Pass the ref of the actual `overflow-x` element.
 */
export default function FloatingHScrollbar({
  targetRef,
}: {
  targetRef: React.RefObject<HTMLElement | null>;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const syncingFromTarget = useRef(false);
  const [box, setBox] = useState<{ left: number; width: number; visible: boolean }>({
    left: 0, width: 0, visible: false,
  });

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      const el = targetRef.current;
      const bar = barRef.current;
      const spacer = spacerRef.current;
      if (!el) {
        setBox((b) => (b.visible ? { ...b, visible: false } : b));
        return;
      }
      const rect = el.getBoundingClientRect();
      const hasOverflow = el.scrollWidth - el.clientWidth > 1;
      // Native bar off-screen below the fold, and the box is at least partly in view.
      const visible = hasOverflow && rect.top < window.innerHeight && rect.bottom > window.innerHeight;
      if (spacer) spacer.style.width = `${el.scrollWidth}px`;
      if (bar && bar.scrollLeft !== el.scrollLeft) {
        syncingFromTarget.current = true;
        bar.scrollLeft = el.scrollLeft;
      }
      setBox({ left: rect.left, width: el.clientWidth, visible });
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    const el = targetRef.current;
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    let ro: ResizeObserver | null = null;
    if (el) {
      el.addEventListener('scroll', schedule);
      ro = new ResizeObserver(schedule);
      ro.observe(el);
    }
    measure();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (el) el.removeEventListener('scroll', schedule);
      ro?.disconnect();
    };
  }, [targetRef]);

  const onBarScroll = () => {
    // Ignore the scroll event our own target-sync just caused.
    if (syncingFromTarget.current) {
      syncingFromTarget.current = false;
      return;
    }
    const el = targetRef.current;
    const bar = barRef.current;
    if (el && bar) el.scrollLeft = bar.scrollLeft;
  };

  return createPortal(
    <div
      ref={barRef}
      onScroll={onBarScroll}
      aria-hidden
      style={{
        position: 'fixed', bottom: 0, left: box.left, width: box.width, height: 14,
        overflowX: 'auto', overflowY: 'hidden', zIndex: 55,
        display: box.visible ? 'block' : 'none',
        background: 'var(--card)',
        borderTop: '1px solid var(--border-strong, var(--border))',
      }}
    >
      <div ref={spacerRef} style={{ height: 1 }} />
    </div>,
    document.body,
  );
}
