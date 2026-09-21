import { from } from './postgrest';
import { buildStoryEvents, type StoryBar, type StoryEvent } from './storyEvents';

export interface PersonalStory {
  latest: StoryBar;
  expectedDate: string;
  fromDate: string;
  sessions: number;
  events: StoryEvent[];
}
// These families are evaluable from stored columns and predecessor bars.
// Long-lookback patterns, journeys and sector events stay on the full stock page.
const supported = new Set(['price_action', 'magic_rs', 'stage', 'gl', 'flow', 'conviction', 'scan']);
export function personalStory(rows: StoryBar[], expectedDate: string): PersonalStory | null {
  const bars = rows.filter(r => Number.isFinite(r.close) && r.close > 0).slice().sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  if (!bars.length) return null;
  const shown = bars.slice(-5);
  return { latest: bars[bars.length - 1], expectedDate, fromDate: shown[0].trade_date, sessions: shown.length,
    events: buildStoryEvents(bars).filter(e => supported.has(e.kind) && e.date >= shown[0].trade_date)
      .sort((a, b) => b.date.localeCompare(a.date) || b.priority - a.priority) };
}
export async function fetchBookmarkStories(ids: number[]): Promise<Map<number, PersonalStory>> {
  const result = new Map<number, PersonalStory>();
  if (!ids.length) return result;
  const dates = await from('km_equity_eod').select('trade_date').notNull('ema_20').order('trade_date', { ascending: false }).limit(1).execute();
  if (dates.error) throw new Error(dates.error.message);
  const expected = dates.data?.[0]?.trade_date as string | undefined;
  if (!expected) throw new Error('Latest market date unavailable');
  const cutoff = new Date(Date.parse(expected + 'T00:00:00Z') - 12 * 86400000).toISOString().slice(0, 10);
  const unique = [...new Set(ids)];
  // Small bounded batches avoid per-card requests and server row-limit truncation.
  for (let i = 0; i < unique.length; i += 25) {
    const batch = unique.slice(i, i + 25);
    const response = await from('km_equity_eod').select('equity_id,trade_date,close,magic_rs,magic_rs_zone,magic_rs_chg_5d,magic_rs_chg_22d,magic_rs_chg_66d,score_5d,score_22d,flow_type,stage,stage_since,dot_sbd,dot_svd,sma_150,gl_event,gl_days_above,pct_from_gl,prev_week_close,pct_wtd,prev_month_close,pct_mtd,breakout_level,pct_from_breakout,breakdown_level,pct_from_breakdown')
      .in('equity_id', batch).gte('trade_date', cutoff).lte('trade_date', expected).order('trade_date', { ascending: true }).limit(batch.length * 13).execute();
    if (response.error) throw new Error(response.error.message);
    for (const id of batch) {
      const rows = (response.data ?? []).filter((r: StoryBar & { equity_id: number }) => r.equity_id === id);
      const story = personalStory(rows, expected);
      if (story) result.set(id, story);
    }
  }
  return result;
}
