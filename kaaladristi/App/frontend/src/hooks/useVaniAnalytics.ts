import { useCallback, useEffect, useRef, type MouseEvent, type SyntheticEvent } from 'react';
import { trackVani, vaniDestination, type VaniAnalyticsContext } from '@/lib/vaniAnalytics';

/** A ready reading is availability, not proof that the user read it. Query
 * polling and background refetches do not create additional completions. */
export function useVaniAnalytics(context: VaniAnalyticsContext, request?: {
  key: string; ready: boolean; failed: boolean;
}, automatic = false) {
  const latest = useRef(context); latest.current = context;
  const viewed = useRef(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const panelRef = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    if (!node || viewed.current || typeof IntersectionObserver === 'undefined') return;
    observer.current = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting && e.intersectionRect.width > 0 && e.intersectionRect.height > 0) || viewed.current) return;
      viewed.current = true;
      trackVani('panel_viewed', latest.current);
      observer.current?.disconnect();
    });
    observer.current.observe(node);
  }, []);
  const opened = useRef(false);
  useEffect(() => {
    if (automatic && !opened.current) {
      opened.current = true;
      trackVani('intent_selected', { ...latest.current, source: 'automatic' });
    }
  }, [automatic]);
  const attempt = useRef({ key: '', started: 0, completed: false });
  useEffect(() => {
    if (!request) return;
    if (attempt.current.key !== request.key) attempt.current = { key: request.key, started: Date.now(), completed: false };
    if (attempt.current.completed || (!request.ready && !request.failed)) return;
    attempt.current.completed = true;
    trackVani(request.failed ? 'reading_failed' : 'reading_ready', {
      ...latest.current, duration_ms: Math.max(0, Date.now() - attempt.current.started),
    });
  }, [request?.key, request?.ready, request?.failed]);
  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest('a');
    const destination = anchor && vaniDestination(anchor.getAttribute('href') ?? '');
    if (destination) trackVani('next_step', { ...latest.current, destination,
      area: anchor.closest('[aria-label="Connected to your stocks"]') ? 'personal_connections' : 'reading' });
  };
  const onToggleCapture = (event: SyntheticEvent<HTMLElement>) => {
    const node = event.target;
    if (!(node instanceof HTMLDetailsElement) || !node.open) return;
    const detail = node.dataset.vaniDetail;
    if (detail === 'explanation' || detail === 'evidence' || detail === 'intents' || detail === 'connections')
      trackVani('detail_opened', { ...latest.current, detail });
  };
  return { ref: panelRef, onClickCapture, onToggleCapture };
}
