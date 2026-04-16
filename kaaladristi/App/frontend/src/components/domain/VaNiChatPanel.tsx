import { useState, useRef, useEffect } from 'react';
import { X, Loader2, Sparkles, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePageContext } from '@/hooks/usePageContext';
import { getIntentsForPage } from '@/config/vaniIntents';
import { useVaNiAsk } from '@/hooks/useVaNiChat';
import type { VaNiAskResponse } from '@/hooks/useVaNiChat';

interface ChatMessage {
  id: string;
  type: 'intent' | 'response';
  intentId?: string;
  label?: string;
  text: string;
  cached?: boolean;
  provider?: string | null;
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
  }, [messages]);

  const handleAsk = (intentId: string, label: string) => {
    if (askMutation.isPending) return;

    const questionMsg: ChatMessage = {
      id: `q-${Date.now()}`,
      type: 'intent',
      intentId,
      label,
      text: label,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, questionMsg]);
    setActiveIntentId(intentId);

    const today = new Date().toISOString().slice(0, 10);
    askMutation.mutate(
      { intent_id: intentId, date: today },
      {
        onSuccess: (data: VaNiAskResponse) => {
          const responseMsg: ChatMessage = {
            id: `r-${Date.now()}`,
            type: 'response',
            intentId,
            text: data.response || 'VaNi could not generate a response. AI may be disabled or data unavailable.',
            cached: data.cached,
            provider: data.provider,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, responseMsg]);
          setActiveIntentId(null);
        },
        onError: () => {
          const errorMsg: ChatMessage = {
            id: `e-${Date.now()}`,
            type: 'response',
            intentId,
            text: 'Connection to VaNi failed. Please check if the pipeline API is running.',
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, errorMsg]);
          setActiveIntentId(null);
        },
      },
    );
  };

  const askedIntents = new Set(messages.filter(m => m.type === 'intent').map(m => m.intentId));

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[200] lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full z-[201] flex flex-col',
          'bg-kd-bg border-l border-kd-border shadow-2xl shadow-black/20',
          'transition-transform duration-300 ease-out',
          'w-full sm:w-[400px] lg:w-[380px]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-kd-border shrink-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-serif font-bold">V</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-serif font-bold text-[var(--text-primary)] leading-tight">
              VaNi <span className="font-normal text-[var(--text-muted)]">&middot; वाणी</span>
            </div>
            <div className="text-[9px] font-mono text-[var(--text-muted)] tracking-wide uppercase">
              {page.replace('_', ' ')} &middot; {intents.length} intents
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-kd-elevated hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-[var(--accent-indigo)] opacity-40" />
              <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-[240px] mx-auto">
                Ask VaNi about what you see on this page. Tap a question below to get started.
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id}>
              {msg.type === 'intent' ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-tr-sm bg-[var(--accent-indigo)]/10 border border-[var(--accent-indigo)]/20">
                    <p className="text-xs text-[var(--accent-indigo)] font-medium">{msg.text}</p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-white text-[8px] font-serif font-bold">V</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="px-3 py-2.5 rounded-xl rounded-tl-sm bg-kd-surface border border-kd-border">
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    </div>
                    {(msg.cached || msg.provider) && (
                      <div className="flex items-center gap-2 mt-1 px-1">
                        {msg.cached && (
                          <span className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                            cached
                          </span>
                        )}
                        {msg.provider && msg.provider !== 'cache' && (
                          <span className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                            {msg.provider}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Thinking indicator */}
          {askMutation.isPending && (
            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-white text-[8px] font-serif font-bold">V</span>
              </div>
              <div className="px-3 py-2.5 rounded-xl rounded-tl-sm bg-kd-surface border border-kd-border">
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-[10px]">VaNi is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Intent Chips */}
        <div className="shrink-0 border-t border-kd-border px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare className="w-3 h-3 text-[var(--text-muted)]" />
            <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
              Questions
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
            {intents.map(intent => {
              const isAsked = askedIntents.has(intent.intentId);
              const isActive = activeIntentId === intent.intentId;
              return (
                <button
                  key={intent.intentId}
                  onClick={() => handleAsk(intent.intentId, intent.label)}
                  disabled={askMutation.isPending}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all',
                    'border leading-tight text-left',
                    isActive
                      ? 'bg-[var(--accent-indigo)]/15 border-[var(--accent-indigo)]/30 text-[var(--accent-indigo)]'
                      : isAsked
                        ? 'bg-kd-surface/50 border-kd-border/50 text-[var(--text-muted)]'
                        : 'bg-kd-surface border-kd-border text-[var(--text-secondary)] hover:border-[var(--accent-indigo)]/30 hover:text-[var(--accent-indigo)]',
                    askMutation.isPending && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {intent.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
