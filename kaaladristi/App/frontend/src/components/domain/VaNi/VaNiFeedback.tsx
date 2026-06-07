import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';

interface VaNiFeedbackProps {
  logId: string;
}

export default function VaNiFeedback({ logId }: VaNiFeedbackProps) {
  const storageKey = `vani_feedback:${logId}`;
  const [voted, setVoted] = useState<1 | -1 | null>(() => {
    try { return (localStorage.getItem(storageKey) as '1' | '-1' | null) ? Number(localStorage.getItem(storageKey)) as 1 | -1 : null } catch { return null }
  });

  const handleVote = async (rating: 1 | -1) => {
    if (voted !== null) return;
    setVoted(rating);
    try { localStorage.setItem(storageKey, String(rating)) } catch {}
    try {
      await fetch(`${pipelineUrl}/api/vani/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: logId, rating }),
      });
    } catch {
      // fire and forget
    }
  };

  return (
    <div className="flex items-center gap-0.5 mt-1.5">
      <button
        onClick={() => handleVote(1)}
        disabled={voted !== null}
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
        disabled={voted !== null}
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
    </div>
  );
}
