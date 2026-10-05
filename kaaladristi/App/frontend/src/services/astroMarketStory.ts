import type { IndicatorRow } from './indicatorData';
import type { AstroBand } from './astroOverlayService';

export const percentChange = (before: number | null | undefined, after: number | null | undefined) =>
  before != null && after != null && before > 0 ? (after / before - 1) * 100 : null;

/** Completed sessions; event identity stays on its calendar date. No forward fill. */
export function astroMarketSequence(band: AstroBand, rows: IndicatorRow[], observedThrough: string) {
  rows = rows.filter(r=>r.trade_date<=observedThrough);
  let at = -1;
  for (let i=0;i<rows.length;i++) if(rows[i].trade_date<=band.from) at=i;
  const anchor = at >= 0 ? rows[at] : undefined;
  // An upcoming event has no event-day observation yet.
  const upcoming = band.from > observedThrough;
  const checkpoints = [
    { label: 'Before · −5 sessions', offset: -5 },
    { label: upcoming ? 'Latest available · event pending' : 'Event session', offset: 0 },
    { label: 'Following · +1 session', offset: 1 },
    { label: 'Following · +2 sessions', offset: 2 },
    { label: 'Held? · +5 sessions', offset: 5 },
    { label: 'Held? · +10 sessions', offset: 10 },
  ].map(p => ({ ...p, row: at >= 0 && (!upcoming || p.offset <= 0) ? rows[at+p.offset] : undefined }));
  let endAt = -1;
  if(!band.isPoint && band.to<=observedThrough) for(let i=0;i<rows.length;i++) if(rows[i].trade_date<=band.to)endAt=i;
  const periodEnd = endAt>=at && endAt>=0 ? rows[endAt] : undefined;
  const periodCheckpoints = band.isPoint ? [] : [
    {label:'Period end',offset:endAt-at,row:periodEnd},
    {label:'After period · +5 sessions',offset:endAt-at+5,row:periodEnd ? rows[endAt+5] : undefined},
    {label:'After period · +10 sessions',offset:endAt-at+10,row:periodEnd ? rows[endAt+10] : undefined},
  ];
  const following = upcoming || !anchor ? [] : rows.slice(at+1,at+3);
  const breaks = following.filter(r => r.close > anchor!.high || r.close < anchor!.low);
  const firstBreak = breaks[0];
  const direction = firstBreak && anchor ? firstBreak.close > anchor.high ? 'up' : 'down' : undefined;
  const boundary = anchor && direction ? direction === 'up' ? anchor.high : anchor.low : undefined;
  const holdRows = firstBreak ? rows.slice(rows.indexOf(firstBreak),at+11) : [];
  const failure = boundary == null ? undefined : holdRows.find(r => direction === 'up' ? r.close <= boundary : r.close >= boundary);
  return { anchor, at, upcoming, checkpoints, periodCheckpoints, periodEnd, firstBreak, direction, boundary, failure,
    complete10: !upcoming && at >= 0 && !!rows[at+10],
    beforeReturn: percentChange(checkpoints[0].row?.close,anchor?.close),
    after5Return: percentChange(anchor?.close,checkpoints[4].row?.close),
    after10Return: percentChange(anchor?.close,checkpoints[5].row?.close) };
}

/** Ratio return, not subtraction of percentage returns. Exact shared dates only. */
export function relativeRatioChange(sectorStart: number, sectorEnd: number, benchmarkStart: number, benchmarkEnd: number) {
  if ([sectorStart,sectorEnd,benchmarkStart,benchmarkEnd].some(n=>!Number.isFinite(n)||n<=0)) return null;
  return ((sectorEnd/benchmarkEnd)/(sectorStart/benchmarkStart)-1)*100;
}
