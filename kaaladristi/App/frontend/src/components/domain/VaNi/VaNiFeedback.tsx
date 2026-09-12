import { trackVani, type VaniAnalyticsContext } from '@/lib/vaniAnalytics';
import { usePageContext } from '@/hooks/usePageContext';
import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';

interface VaNiFeedbackProps {
  logId: string;
  analyticsContext?: VaniAnalyticsContext;
}

export default function VaNiFeedback({ logId, analyticsContext }: VaNiFeedbackProps) {
  const {page}=usePageContext();
  const analytics=analyticsContext??{page,mode:'chat' as const};
  const storageKey = `vani_feedback:${logId}`;
  const [voted, setVoted] = useState<1 | -1 | null>(() => {
    try { return (localStorage.getItem(storageKey) as '1' | '-1' | null) ? Number(localStorage.getItem(storageKey)) as 1 | -1 : null } catch { return null }
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    try {
      const value = localStorage.getItem(storageKey);
      setVoted(value === '1' ? 1 : value === '-1' ? -1 : null);
    } catch { setVoted(null); }
    setError(false);
  }, [storageKey]);

  const handleVote = async (rating: 1 | -1) => {
    if (voted !== null || pending) return;
    setPending(true);
    setError(false);
    try {
      const response = await fetch(`${pipelineUrl}/api/vani/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: logId, rating }),
      });
      if (!response.ok || !(await response.json()).ok) throw new Error('Feedback was not saved');
      trackVani('feedback_submitted',{...analytics,rating:rating===1?'helpful':'not_helpful'});
      setVoted(rating);
      try { localStorage.setItem(storageKey, String(rating)) } catch { /* preference only */ }
    } catch {
      trackVani('feedback_failed',{...analytics,rating:rating===1?'helpful':'not_helpful'});
      setError(true);
    } finally { setPending(false); }
  };

  return (
    <div className="flex items-center gap-0.5 mt-1.5">
      <button
        onClick={() => handleVote(1)}
        disabled={voted !== null || pending}
        aria-label="Helpful"
        title="Helpful"
        className={cn(
          'w-5 h-5 flex items-center justify-center rounded transition-colors',
          voted === 1
            ? 'text-risk-green'
            : 'text-muted hover:text-[var(--text-secondary)]',
          voted !== null && voted !== 1 && 'opacity-30',
        )}
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        onClick={() => handleVote(-1)}
        disabled={voted !== null || pending}
        aria-label="Not helpful"
        title="Not helpful"
        className={cn(
          'w-5 h-5 flex items-center justify-center rounded transition-colors',
          voted === -1
            ? 'text-risk-red'
            : 'text-muted hover:text-[var(--text-secondary)]',
          voted !== null && voted !== -1 && 'opacity-30',
        )}
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
      {error && <span role="status" className="text-xs text-muted ml-2">Not saved. Please try again.</span>}
    </div>
  );
}
