import { PERSONA_TO_LEG, type BreadthLeg } from '@/constants/breadthLegs';
import type { ConcedeLevel } from '@/constants/personaConfig';

export interface LadderLeg {
  /** The leg's own key — also decides which persona line can mark it. */
  leg: BreadthLeg;
  /** Share of the universe holding above this moving average, 0–100. */
  pct: number;
}

interface BreadthLadderProps {
  legs: LadderLeg[];
  /** The user's concede level, from their ICP. Marks the row they trade on. */
  concedeLevel?: ConcedeLevel | null;
  /** Sessions of the headline score, oldest first — the trajectory strip. */
  history?: Array<{ date: string; score: number }>;
}

const LEG_LABEL: Record<BreadthLeg, { row: string; line: string }> = {
  short:  { row: 'Short term',  line: '20 EMA' },
  medium: { row: 'Medium term', line: '50 EMA' },
  long:   { row: 'Long term',   line: '150 EMA' },
};

/** Below this share of the market holding a line, that timeframe is working
 *  against whoever trades on it. Not a signal — a reading of the tape. */
const THIN = 40;

/**
 * "How much of the market is working" — three bars, one per timeframe.
 *
 * Why a picture and not another sentence: the brief's three percentages are
 * the whole story (a market can be falling apart on the short leg while the
 * long one barely moves) and prose buries that. Three bars show it at a
 * glance, and marking the viewer's OWN line turns a market reading into
 * their reading — the same numbers mean opposite things to someone conceding
 * at the 10-day low and someone conceding at the Golden Line.
 */
export default function BreadthLadder({ legs, concedeLevel, history }: BreadthLadderProps) {
  const yourLeg = concedeLevel ? PERSONA_TO_LEG[concedeLevel] : null;

  const scores = (history ?? []).map((h) => h.score);
  const lo = scores.length ? Math.min(...scores) : 0;
  const hi = scores.length ? Math.max(...scores) : 1;
  const span = hi - lo || 1;

  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: 'var(--border)', background: 'var(--card-soft, var(--card))' }}
    >
      <div className="flex items-baseline justify-between mb-2.5">
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Share of the market holding each line
        </span>
      </div>

      <div className="space-y-2">
        {legs.map(({ leg, pct }) => {
          const mine = yourLeg === leg;
          const thin = pct < THIN;
          const bar = thin ? 'var(--bear)' : 'var(--bull)';
          return (
            <div key={leg} className="flex items-center gap-2.5">
              <span
                className="text-[10px] w-[74px] shrink-0 leading-tight"
                style={{ color: mine ? 'var(--text-primary)' : 'var(--text-muted)',
                         fontWeight: mine ? 600 : 400 }}
              >
                {LEG_LABEL[leg].row}
                <span className="block font-mono opacity-60">{LEG_LABEL[leg].line}</span>
              </span>

              <div
                className="flex-1 h-3 rounded-full overflow-hidden min-w-0"
                style={{ background: 'color-mix(in srgb, var(--text-muted) 18%, transparent)' }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, pct))}%`,
                    background: mine ? bar : `color-mix(in srgb, ${bar} 45%, transparent)`,
                  }}
                />
              </div>

              <span
                className="text-[11px] font-mono tabular-nums w-[38px] text-right shrink-0"
                style={{ color: mine ? 'var(--text-primary)' : 'var(--text-muted)' }}
              >
                {pct.toFixed(0)}%
              </span>

              {mine && (
                <span
                  className="text-[9px] font-mono uppercase tracking-wider shrink-0"
                  style={{ color: 'var(--accent-indigo)' }}
                  title="Your concede line, from how you set up DristiQ"
                >
                  yours
                </span>
              )}
            </div>
          );
        })}
      </div>

      {history && history.length > 2 && (() => {
        const first = history[0].score;
        const last = history[history.length - 1].score;
        const move = last - first;
        // Direction is the point of this strip — "four sessions falling" is
        // half the brief. At 40% opacity on --text-muted the bars were
        // legible only as texture, so they carry the direction's colour and
        // the delta is stated rather than left to be eyeballed.
        const tone = move < -0.5 ? 'var(--bear)' : move > 0.5 ? 'var(--bull)' : 'var(--text-muted)';
        return (
          <div className="mt-3 pt-2.5 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-end gap-[3px] h-7">
              {history.map((h, i) => (
                <div
                  key={h.date}
                  title={`${h.date} · ${h.score.toFixed(1)}`}
                  className="flex-1 rounded-sm min-w-0"
                  style={{
                    height: `${18 + ((h.score - lo) / span) * 82}%`,
                    background: `color-mix(in srgb, ${tone} ${i === history.length - 1 ? 90 : 45}%, transparent)`,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between items-baseline mt-1.5">
              <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                {first.toFixed(1)}
              </span>
              <span className="text-[10px]" style={{ color: tone }}>
                {move >= 0 ? '+' : ''}{move.toFixed(1)} over {history.length} sessions
              </span>
              <span className="text-[9px] font-mono" style={{ color: 'var(--text-primary)' }}>
                {last.toFixed(1)}
              </span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
