import { useVaniAnalytics } from '@/hooks/useVaniAnalytics';
import { usePageContext } from '@/hooks/usePageContext';
import { AlertCircle } from 'lucide-react';
import PanchangamCard from '../PanchangamCard';
import VaNiMessage, { VaNiThinking } from './VaNiMessage';
import BreadthLadder from './BreadthLadder';
import { useVaNiAutorun } from '@/hooks/useVaNiChat';
import { useMarketBreadth } from '@/hooks/useDashboardExtras';
import { useAuthStore } from '@/stores/authStore';
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
  // The viewer's ICP — the four onboarding answers. Sent with the request so
  // the read is about the way THIS user works, and used here to mark their
  // own line on the ladder. A user who skipped onboarding sends nothing and
  // gets an unmarked ladder and a market-level read.
  const profile = useAuthStore((s) => s.profile);
  const icp = {
    persona: profile?.persona ?? null,
    acts_on: profile?.acts_on ?? null,
    hold_horizon: profile?.hold_horizon ?? null,
    concede_level: profile?.concede_level ?? null,
  };

  const { data, isLoading, isError } = useVaNiAutorun(intentId, undefined, true, icp);
  const {page}=usePageContext();
  useVaniAnalytics({page,mode:'chat',intent_id:intentId},{key:JSON.stringify([intentId,profile?.id,dataDate]),ready:!isLoading&&!!data?.response&&!data?.error,failed:!isLoading&&!!(isError||data?.error)},true);
  const { data: breadth } = useMarketBreadth(10);

  // Oldest-first, matching the prompt's window. The ladder reads the newest
  // bar for its three rows and the whole slice for the trajectory strip.
  const series = breadth ?? [];
  const latest = series.length ? series[series.length - 1] : null;

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

      {/* The picture before the prose. The three shares ARE the story — a
          market can lose its short line while the long one barely moves —
          and a paragraph buries that. The viewer's own concede line is
          marked, so the same bars read differently for different people. */}
      {latest && (
        <BreadthLadder
          legs={[
            { leg: 'short', pct: latest.pct_above_20 ?? 0 },
            { leg: 'medium', pct: latest.pct_above_50 ?? 0 },
            { leg: 'long', pct: latest.pct_above_150 ?? 0 },
          ]}
          concedeLevel={icp.concede_level}
          history={series
            .filter((r) => r.breadth_score != null)
            .map((r) => ({ date: r.trade_date, score: r.breadth_score as number }))}
        />
      )}

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
