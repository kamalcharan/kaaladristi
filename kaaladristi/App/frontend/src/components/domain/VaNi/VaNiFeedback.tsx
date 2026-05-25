import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';

interface VaNiFeedbackProps {
  logId: string;
}

export default function VaNiFeedback({ logId }: VaNiFeedbackProps) {
  const [voted, setVoted] = useState<1 | -1 | null>(null);

  const handleVote = async (rating: 1 | -1) => {
    if (voted !== null) return;
    setVoted(rating);
    try {
      await fetch(`${pipelineUrl}/api/vani/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: logId, rating }),
      });
    } catch {
      // fire and forget — don't undo UI state on network error
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
