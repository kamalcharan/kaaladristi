import { trackVani, vaniDestination } from '@/lib/vaniAnalytics';
import { usePageContext } from '@/hooks/usePageContext';
import { ArrowRight, Trash2, Loader2 } from 'lucide-react';
import VaNiFeedback from './VaNiFeedback';
import type { ChatMessage } from './types';

const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';

/** The "V" avatar that marks every VaNi utterance. Shared so the autorun
 *  brief, the answer bubble and the thinking row can never drift apart. */
export function VaNiAvatar({ pulse = false }: { pulse?: boolean }) {
  return (
    <div
      className={
        'w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] ' +
        'flex items-center justify-center shrink-0 mt-1 shadow shadow-indigo-500/20' +
        (pulse ? ' animate-pulse' : '')
      }
    >
      <span className="text-white text-[9px] font-serif font-bold">V</span>
    </div>
  );
}

/** "VaNi is analysing…" — one definition, used by the conversation and by
 *  the autorun brief while its first read is in flight. */
export function VaNiThinking({ label = 'VaNi is analysing...' }: { label?: string }) {
  return (
    <div className="flex gap-3">
      <VaNiAvatar pulse />
      <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-[#161233] border border-[var(--accent-indigo)]/15">
        <div className="flex items-center gap-2.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-indigo)]" />
          <span className="text-[11px] text-white/40">{label}</span>
        </div>
      </div>
    </div>
  );
}

interface VaNiMessageProps {
  message: ChatMessage;
  /** Admin-only "clear cache" control; omitted for non-admins. */
  isAdmin?: boolean;
  onClearCache?: (message: ChatMessage) => void;
  onFollowLink?: (href: string) => void;
}

/**
 * One turn of the VaNi conversation — the user's chosen intent (right-aligned
 * pill) or VaNi's answer (left bubble + feedback footer).
 */
export default function VaNiMessage({
  message: msg,
  isAdmin = false,
  onClearCache,
  onFollowLink,
}: VaNiMessageProps) {
  const {page}=usePageContext();
  const analyticsContext={page,mode:'chat' as const,intent_id:msg.intentId};
  if (msg.type === 'intent') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-md bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-violet)] shadow-md shadow-indigo-500/10">
          <p className="text-xs font-semibold text-white">{msg.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <VaNiAvatar />
      <div className="flex-1 min-w-0">
        <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-[#161233] border border-[var(--accent-indigo)]/15">
          <p className="text-[12px] text-white/80 leading-[1.7] whitespace-pre-wrap">
            {msg.text}
          </p>
          {msg.link && onFollowLink && (
            <button
              onClick={() => {const destination=vaniDestination(msg.link!.href);if(destination)trackVani('next_step',{...analyticsContext,destination,area:'reading'});onFollowLink(msg.link!.href)}}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-indigo)]/15 border border-[var(--accent-indigo)]/30 text-[11px] font-medium text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/25 transition-colors"
            >
              {msg.link.label}
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5 px-2">
          {msg.logId && <VaNiFeedback analyticsContext={analyticsContext} logId={msg.logId} />}
          {msg.cached && (
            <span className="text-[8px] font-mono text-[var(--accent-indigo)]/40 uppercase tracking-widest">
              instant response
            </span>
          )}
          {isAdmin && msg.intentId && onClearCache && (
            <button
              onClick={async () => {
                await fetch(
                  `${pipelineUrl}/api/vani/cache?intent_id=${encodeURIComponent(msg.intentId!)}`,
                  { method: 'DELETE' },
                );
                onClearCache(msg);
              }}
              title="Clear this intent's cache"
              className="ml-auto flex items-center gap-1 text-[8px] font-mono text-risk-red/30 hover:text-risk-red/70 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>clear cache</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
