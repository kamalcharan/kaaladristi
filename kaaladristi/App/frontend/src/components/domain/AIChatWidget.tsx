import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRegimeIntel } from '@/lib/regimeIntel';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatWidgetProps {
  regime: string;
  riskScore: number;
  symbol: string;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

/** Context-aware suggested questions based on current regime */
function getSuggestedQuestions(regime: string, riskScore: number, symbol: string): string[] {
  const intel = getRegimeIntel(regime);
  return [
    `What does a ${regime} regime mean for my trades?`,
    `Should I reduce my position size at risk ${riskScore}?`,
    `How long does this ${intel.posture.toLowerCase()} phase usually last?`,
    `What sectors are safest for ${symbol} right now?`,
  ];
}

/** Simulated AI responses — wired for future backend integration */
function getAIResponse(question: string, regime: string, riskScore: number): string {
  const intel = getRegimeIntel(regime);

  if (question.toLowerCase().includes('regime') || question.toLowerCase().includes('mean')) {
    return `The current **${regime}** regime signals a **${intel.posture.toLowerCase()}** market posture.\n\n${intel.behaviorExpectation}\n\n${intel.counterMove}\n\nThis regime ${intel.persistence.toLowerCase()}.`;
  }
  if (question.toLowerCase().includes('position') || question.toLowerCase().includes('size') || question.toLowerCase().includes('reduce')) {
    return `With a risk score of **${riskScore}/100**, ${intel.deploymentIntensity.toLowerCase()}\n\nParticipation intensity: **${intel.participationIntensity}**.\n\nBreakout sustainability: ${intel.breakoutSustainability.toLowerCase()}.`;
  }
  if (question.toLowerCase().includes('long') || question.toLowerCase().includes('last') || question.toLowerCase().includes('duration')) {
    return `${intel.persistence}\n\nCurrent posture is **${intel.posture}**. ${intel.counterMove}`;
  }
  if (question.toLowerCase().includes('sector') || question.toLowerCase().includes('safe')) {
    return `In a ${regime} regime, defensive sectors historically outperform. ${intel.behaviorExpectation}\n\nCheck the **Sector Sensitivity** panel below for today's specific readings.`;
  }

  return `${intel.briefing}\n\n${intel.behaviorExpectation}\n\nRisk score: **${riskScore}/100** | Posture: **${intel.posture}** | Participation: **${intel.participationIntensity}**.`;
}

export default function AIChatWidget({ regime, riskScore, symbol, externalOpen, onExternalOpenChange }: AIChatWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Sync external open trigger
  useEffect(() => {
    if (externalOpen) {
      setInternalOpen(true);
      onExternalOpenChange?.(false);
    }
  }, [externalOpen, onExternalOpenChange]);

  const open = internalOpen;
  const setOpen = setInternalOpen;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestedQuestions = getSuggestedQuestions(regime, riskScore, symbol);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleSend(text?: string) {
    const question = (text ?? input).trim();
    if (!question) return;

    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setInput('');
    setTyping(true);

    // Simulate AI thinking delay
    setTimeout(() => {
      const response = getAIResponse(question, regime, riskScore);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setTyping(false);
    }, 600 + Math.random() * 400);
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center justify-center',
          'w-14 h-14 rounded-2xl shadow-2xl transition-all duration-300',
          'border',
          open
            ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 rotate-0'
            : 'bg-gradient-to-br from-indigo-600 to-violet-600 border-indigo-500/30 hover:scale-105 hover:shadow-indigo-500/25'
        )}
      >
        {open ? (
          <X className="w-5 h-5 text-slate-300" />
        ) : (
          <MessageCircle className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Chat panel */}
      <div className={cn(
        'fixed bottom-24 right-6 z-50 w-[380px] max-h-[520px] rounded-3xl overflow-hidden',
        'bg-[var(--bg-secondary)] border border-kd-border shadow-2xl shadow-black/40',
        'flex flex-col transition-all duration-300 origin-bottom-right',
        open ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'
      )}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-kd-border bg-[var(--bg-card)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Risk Intelligence</h3>
              <p className="text-[10px] text-muted">Ask anything about today's assessment</p>
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[320px]">
          {messages.length === 0 ? (
            /* Suggested questions — shown when chat is empty */
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Suggested questions</p>
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="w-full text-left flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-kd-border hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group"
                >
                  <span className="text-xs text-slate-300 flex-1">{q}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          ) : (
            /* Chat messages */
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed',
                    msg.role === 'user'
                      ? 'ml-auto bg-indigo-600/20 border border-indigo-500/20 text-slate-200'
                      : 'bg-white/[0.04] border border-kd-border text-slate-300'
                  )}
                >
                  {/* Simple markdown bold rendering */}
                  {msg.content.split('\n').map((line, j) => (
                    <p key={j} className={j > 0 ? 'mt-2' : ''}>
                      {line.split(/(\*\*[^*]+\*\*)/).map((part, k) =>
                        part.startsWith('**') && part.endsWith('**')
                          ? <strong key={k} className="text-white font-semibold">{part.slice(2, -2)}</strong>
                          : <span key={k}>{part}</span>
                      )}
                    </p>
                  ))}
                </div>
              ))}
              {typing && (
                <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-white/[0.04] border border-kd-border">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-kd-border bg-[var(--bg-card)]">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask about this risk assessment..."
              className="flex-1 bg-white/[0.04] border border-kd-border rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                input.trim()
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-white/[0.04] text-slate-600 cursor-not-allowed'
              )}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Imperative open function — used by "Ask AI" buttons elsewhere */
export function useAIChatTrigger() {
  const [open, setOpen] = useState(false);
  const trigger = () => setOpen(true);
  return { isOpen: open, setOpen, trigger };
}
