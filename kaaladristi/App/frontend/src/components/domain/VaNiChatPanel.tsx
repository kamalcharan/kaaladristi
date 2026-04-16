import { useState, useRef, useEffect } from 'react';
import { X, Loader2, Sparkles, ChevronRight, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePageContext } from '@/hooks/usePageContext';
import { getIntentsForPage } from '@/config/vaniIntents';
import { useVaNiAsk } from '@/hooks/useVaNiChat';
import type { VaNiAskResponse } from '@/hooks/useVaNiChat';

interface ChatMessage {
  id: string;
  type: 'intent' | 'response';
  intentId?: string;
  text: string;
  cached?: boolean;
  timestamp: number;
}

interface VaNiChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function VaNiChatPanel({ open, onClose }: VaNiChatPanelProps) {
  const { page } = usePageContext();
  const intents = getIntentsForPage(page);
  const askMutation = useVaNiAsk();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeIntentId, setActiveIntentId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, askMutation.isPending]);

  const askedIntents = new Set(messages.filter(m => m.type === 'intent').map(m => m.intentId));
  const remainingIntents = intents.filter(i => !askedIntents.has(i.intentId));

  const handleAsk = (intentId: string, label: string) => {
    if (askMutation.isPending) return;

    setMessages(prev => [...prev, {
      id: `q-${Date.now()}`,
      type: 'intent',
      intentId,
      text: label,
      timestamp: Date.now(),
    }]);
    setActiveIntentId(intentId);

    const today = new Date().toISOString().slice(0, 10);
    askMutation.mutate(
      { intent_id: intentId, date: today },
      {
        onSuccess: (data: VaNiAskResponse) => {
          setMessages(prev => [...prev, {
            id: `r-${Date.now()}`,
            type: 'response',
            intentId,
            text: data.response || 'VaNi could not generate a response right now.',
            cached: data.cached,
            timestamp: Date.now(),
          }]);
          setActiveIntentId(null);
        },
        onError: () => {
          setMessages(prev => [...prev, {
            id: `e-${Date.now()}`,
            type: 'response',
            intentId,
            text: 'Connection to VaNi failed. Please check if the pipeline API is running.',
            timestamp: Date.now(),
          }]);
          setActiveIntentId(null);
        },
      },
    );
  };

  const lastMessage = messages[messages.length - 1];
  const showFollowUp = lastMessage?.type === 'response' && !askMutation.isPending && remainingIntents.length > 0;

  // ── Intent button (reused in empty state + follow-up) ──
  const IntentButton = ({ intentId, label, variant }: { intentId: string; label: string; variant: 'primary' | 'secondary' }) => (
    <button
      onClick={() => handleAsk(intentId, label)}
      disabled={askMutation.isPending}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group',
        variant === 'primary'
          ? 'bg-[#1e1b4b]/60 border-2 border-[var(--accent-indigo)]/20 hover:border-[var(--accent-indigo)]/50 hover:bg-[#1e1b4b]/80'
          : 'bg-[#1e1b4b]/30 border border-[var(--accent-indigo)]/10 hover:border-[var(--accent-indigo)]/30 hover:bg-[#1e1b4b]/50',
        askMutation.isPending && 'opacity-40 cursor-not-allowed',
      )}
    >
      <div className={cn(
        'w-6 h-6 rounded-lg flex items-center justify-center shrink-0',
        'bg-[var(--accent-indigo)]/20 group-hover:bg-[var(--accent-indigo)]/30 transition-colors',
      )}>
        <MessageCircle className="w-3 h-3 text-[var(--accent-indigo)]" />
      </div>
      <span className={cn(
        'text-xs font-medium leading-snug',
        'text-[var(--text-secondary)] group-hover:text-[var(--accent-indigo)] transition-colors',
      )}>
        {label}
      </span>
      <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0 text-[var(--accent-indigo)]/30 group-hover:text-[var(--accent-indigo)]/60 transition-colors" />
    </button>
  );

  return (
    <>
      {/* Backdrop — always show, dims the page */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-[200]"
          onClick={onClose}
        />
      )}

      {/* Panel — distinct dark background, strong border */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full z-[201] flex flex-col',
          'bg-[#0c0a1a] border-l-2 border-[var(--accent-indigo)]/30',
          'shadow-[−8px_0_30px_rgba(99,102,241,0.15)]',
          'transition-transform duration-300 ease-out',
          'w-full sm:w-[420px] lg:w-[400px]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--accent-indigo)]/20 shrink-0 bg-[#0f0d22]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
            <span className="text-white text-sm font-serif font-bold">V</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-serif font-bold text-white leading-tight">
              VaNi <span className="font-normal text-[var(--accent-indigo)]/70">&middot; वाणी</span>
            </div>
            <div className="text-[10px] font-mono text-[var(--accent-indigo)]/50 tracking-wide uppercase mt-0.5">
              {page.replace(/_/g, ' ')} context &middot; {intents.length} questions
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:bg-white/10 hover:text-white/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Chat area ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="py-2">
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--accent-indigo)]/20 to-[var(--accent-violet)]/20 flex items-center justify-center border border-[var(--accent-indigo)]/20">
                  <Sparkles className="w-6 h-6 text-[var(--accent-indigo)]" />
                </div>
                <p className="text-sm font-medium text-white/80 mb-1">
                  What would you like to know?
                </p>
                <p className="text-[11px] text-white/30 max-w-[260px] mx-auto leading-relaxed">
                  VaNi reads the live data on this page and answers your questions.
                </p>
              </div>
              <div className="space-y-2">
                {intents.map(intent => (
                  <IntentButton
                    key={intent.intentId}
                    intentId={intent.intentId}
                    label={intent.label}
                    variant="primary"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <div key={msg.id}>
              {msg.type === 'intent' ? (
                /* ── User question: right-aligned, bold accent ── */
                <div className="flex justify-end">
                  <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-md bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-violet)] shadow-md shadow-indigo-500/10">
                    <p className="text-xs font-semibold text-white">{msg.text}</p>
                  </div>
                </div>
              ) : (
                /* ── VaNi response: left-aligned, card style ── */
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] flex items-center justify-center shrink-0 mt-1 shadow shadow-indigo-500/20">
                    <span className="text-white text-[9px] font-serif font-bold">V</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-[#161233] border border-[var(--accent-indigo)]/15">
                      <p className="text-[12px] text-white/80 leading-[1.7] whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    </div>
                    {msg.cached && (
                      <div className="mt-1.5 px-2">
                        <span className="text-[8px] font-mono text-[var(--accent-indigo)]/40 uppercase tracking-widest">
                          instant response
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Thinking indicator */}
          {askMutation.isPending && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] flex items-center justify-center shrink-0 mt-1 shadow shadow-indigo-500/20 animate-pulse">
                <span className="text-white text-[9px] font-serif font-bold">V</span>
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-[#161233] border border-[var(--accent-indigo)]/15">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-indigo)]" />
                  <span className="text-[11px] text-white/40">VaNi is analysing...</span>
                </div>
              </div>
            </div>
          )}

          {/* Follow-up intents */}
          {showFollowUp && (
            <div className="pt-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-[var(--accent-indigo)]/10" />
                <span className="text-[9px] font-mono text-[var(--accent-indigo)]/40 uppercase tracking-widest px-2">
                  also ask
                </span>
                <div className="flex-1 h-px bg-[var(--accent-indigo)]/10" />
              </div>
              <div className="space-y-1.5">
                {remainingIntents.map(intent => (
                  <IntentButton
                    key={intent.intentId}
                    intentId={intent.intentId}
                    label={intent.label}
                    variant="secondary"
                  />
                ))}
              </div>
            </div>
          )}

          {/* All done */}
          {messages.length > 0 && remainingIntents.length === 0 && !askMutation.isPending && (
            <div className="pt-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[var(--accent-indigo)]/10" />
                <span className="text-[9px] font-mono text-[var(--accent-indigo)]/30 uppercase tracking-widest px-2">
                  all answered
                </span>
                <div className="flex-1 h-px bg-[var(--accent-indigo)]/10" />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
