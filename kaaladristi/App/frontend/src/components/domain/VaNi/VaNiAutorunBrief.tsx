import { AlertCircle } from 'lucide-react';
import PanchangamCard from '../PanchangamCard';
import VaNiMessage, { VaNiThinking } from './VaNiMessage';
import { useVaNiAutorun } from '@/hooks/useVaNiChat';
import { fmtDateLong } from '@/lib/dateUtils';
import type { ChatMessage } from './types';

/** Small all-caps rule used to separate the brief's blocks. */
function BriefRule({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-[var(--accent-indigo)]/40 uppercase tracking-widest">
        {children}
      </span>
      <div className="flex-1 h-px bg-[var(--accent-indigo)]/10" />
    </div>
  );
}

interface VaNiAutorunBriefProps {
  /** Intent fired on arrival. Today: 'dashboard.autorun'. */
  intentId: string;
  /** Calendar day in IST — panchangam is astronomical and belongs to the day
   *  the user is living in, NOT to the last completed trading bar. */
  calendarDate: string;
  /** Latest indicator-complete trade date, for the market read's dateline.
   *  Display only — the backend resolves the bar it actually reads. */
  dataDate?: string | null;
  isAdmin?: boolean;
}

/**
 * The opening brief — what VaNi says before being asked anything.
 *
 * Three blocks, in the order the owner specified: today's panchangam as a
 * CARD (data, rendered by the same component the dashboard uses — never
 * re-narrated in prose), then VaNi's read of market participation (breadth +
 * the ROC oscillator), then the pane's follow-up questions, which the panel
 * renders beneath this.
 *
 * VIX is deliberately absent: it is display-only today and scoring it is
 * parked behind the VIX-Upgrade decision (docs/claude/VIX-Upgrade.md).
 */
export default function VaNiAutorunBrief({
  intentId,
  calendarDate,
  dataDate,
  isAdmin = false,
}: VaNiAutorunBriefProps) {
  const { data, isLoading, isError } = useVaNiAutorun(intentId);

  // The date VaNi actually read. The backend gates on ema_20 and hands the
  // resolved bar back, so trust its answer over the caller's guess — on a
  // holiday or mid-pipeline those differ, and claiming the wrong date is
  // exactly the failure the gate exists to prevent.
  const readDate = data?.date ?? dataDate ?? null;
  const sameDay = !!readDate && readDate === calendarDate;

  const message: ChatMessage | null = data?.response
    ? {
        id: `autorun-${intentId}-${readDate ?? 'latest'}`,
        type: 'response',
        intentId,
        text: data.response,
        cached: data.cached,
        logId: data.log_id ?? undefined,
        timestamp: 0,
      }
    : null;

  return (
    <div className="space-y-3">
      <BriefRule>Today · {fmtDateLong(calendarDate)}</BriefRule>

      <PanchangamCard date={calendarDate} />

      <BriefRule>
        {sameDay || !readDate ? 'Market participation' : `Market participation · ${fmtDateLong(readDate)} close`}
      </BriefRule>

      {isLoading && <VaNiThinking label="VaNi is reading the market..." />}

      {message && <VaNiMessage message={message} isAdmin={isAdmin} />}

      {!isLoading && !message && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg)]/40 border border-[var(--accent-indigo)]/10">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--accent-indigo)]/40" />
          <p className="text-[11px] text-white/40 leading-relaxed">
            {isError || data?.error
              ? 'VaNi could not reach the market read just now. The questions below still work.'
              : 'No completed trading session to read yet. The questions below still work.'}
          </p>
        </div>
      )}
    </div>
  );
}
