import type {ScanStock} from '@/types';
export const BREAKOUT_BETA_QUESTIONS={read:'What stands out in these results?',caution:'What needs caution?',horizons:'What do short and long term tell us?',inspect:'How should I inspect a stock?'} as const;
export type BreakoutQuestion=keyof typeof BREAKOUT_BETA_QUESTIONS;
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function breakoutEvidence(stocks:ScanStock[]) {
 const dates=[...new Set(stocks.map(s=>s.trade_date).filter(Boolean))];
 const volume=stocks.filter(s=>valid(s.rvol)),flow=stocks.filter(s=>valid(s.score_5d)&&valid(s.score_22d)),rsi=stocks.filter(s=>valid(s.rsi_14)),levels=stocks.filter(s=>valid(s.pct_from_breakout));
 return {date:dates.length===1&&stocks.every(s=>s.trade_date)?dates[0]:null,mixedDates:dates.length>1,total:stocks.length,
  aboveVolume:volume.filter(s=>s.rvol!>1).length,volumeKnown:volume.length,
  strongerFlow:flow.filter(s=>s.score_5d!>s.score_22d!).length,flowKnown:flow.length,
  highRsi:rsi.filter(s=>s.rsi_14!>=70).length,rsiKnown:rsi.length,
  aboveLevel:levels.filter(s=>s.pct_from_breakout!>0).length,levelKnown:levels.length,
  examples:stocks.slice(0,5).map(s=>({symbol:s.symbol,rvol:s.rvol??null,rsi:s.rsi_14??null,above:s.pct_from_breakout??null,flow5:s.score_5d??null,flow22:s.score_22d??null}))};
}
export type BreakoutEvidence=ReturnType<typeof breakoutEvidence>;
export function breakoutStory(e:BreakoutEvidence,q:BreakoutQuestion,depth:string) {
 if(!e.total) return 'No results are displayed for these filters. This does not establish that the whole scanner has no matches. Check the data status and filters.';
 if(e.mixedDates||!e.date) return 'A single closing-data session could not be established for these results. Inspect the data dates before comparing this group.';
 const base=q==='read'?`${e.total} candidates are displayed. ${e.levelKnown?`${e.aboveLevel} of ${e.levelKnown} stocks with a breakout-level reading are above that level`:'Breakout-level readings are unavailable'}; the scanner list is not proof that every stock has broken out.`
  :q==='caution'?`${e.rsiKnown?`${e.highRsi} of ${e.rsiKnown} stocks with an RSI reading are at 70 or above.`:'RSI readings are unavailable for this filtered list.'} This is a caution to inspect the price move, not a prediction of reversal. Missing readings must be checked separately.`
  :q==='horizons'?`${e.flowKnown?`${e.strongerFlow} of ${e.flowKnown} stocks with both flow scores have Flow 5D above Flow 22D.`:'Both flow scores are unavailable, so a short-term baseline comparison cannot be made.'} That compares recent activity with its baseline; it does not show acceleration since yesterday or establish a longer-term trend.`
  :'Open the row’s VaNi mascot to understand that stock. Compare its price with the breakout level, inspect volume and cautions, then open Study for the chart. A scanner match is a starting point for research.';
 const meaning=q==='read'?'Look for price and volume evidence supporting the same observation. A promising-looking group can still contain weak or incomplete individual readings.'
  :q==='caution'?'A high RSI can coexist with strength. Check distance from the breakout level and whether volume supports the move. This scanner does not supply the market breadth regime, so no Greed/Fear conclusion is made here.'
  :q==='horizons'?'Flow 22D is not a substitute for completed weekly/monthly evidence. Inspect those chart views separately before describing longer-term strength.'
  :'Use the stock questions to understand the observation and risks. Save a stock only if you want to revisit it; a highlight is not an instruction to trade.';
 if(depth==='brief') return base;
 if(depth==='simple') return base+'\n\n'+meaning;
 return base+'\n\n'+meaning+'\n\n'+`Coverage: RVOL ${e.volumeKnown}/${e.total}; both flow scores ${e.flowKnown}/${e.total}; RSI ${e.rsiKnown}/${e.total}; breakout level ${e.levelKnown}/${e.total}. ${e.aboveVolume} of ${e.volumeKnown} known RVOL readings exceed their volume baseline. Counts describe the full filtered list; examples below are limited to the first five displayed stocks.`;
}
