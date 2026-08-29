/**
 * dataTab — the Study → Data tab's reads.
 *
 * Two shapes, deliberately separate:
 *   fetchDataBars     — a page of raw bars for the table (everyone)
 *   fetchDataCoverage — what we hold vs what should exist (admin cards)
 *
 * Both key on equity_id, which is indexed, so they stay per-stock and live.
 * A universe-wide rollup would mean scanning 17M rows and needs a nightly
 * summary table instead — deliberately not attempted here.
 */

import { from } from './postgrest';
import { dataSelectColumns } from '@/config/dataColumns';

export type DataRange = '1Y' | '3Y' | '5Y' | 'ALL';

const RANGE_YEARS: Record<Exclude<DataRange, 'ALL'>, number> = { '1Y': 1, '3Y': 3, '5Y': 5 };

export interface DataBarsPage {
  rows: Record<string, unknown>[];
  /** True when the page filled exactly — there may be more behind it. */
  hasMore: boolean;
}

export async function fetchDataBars(
  equityId: number,
  range: DataRange,
  pageSize: number,
  offset: number,
): Promise<DataBarsPage> {
  let q = from('km_equity_eod')
    .select(dataSelectColumns())
    .eq('equity_id', equityId)
    .order('trade_date', { ascending: false });

  if (range !== 'ALL') {
    const from_ = new Date();
    from_.setFullYear(from_.getFullYear() - RANGE_YEARS[range]);
    q = q.gte('trade_date', from_.toISOString().slice(0, 10));
  }

  // PostgREST has no OFFSET on this builder, so a page is fetched as
  // (offset + pageSize) rows and sliced. Fine at these depths — the deepest
  // stock in the table is RELIANCE at 7,694 bars — and it keeps paging honest
  // without a second code path.
  const { data, error } = await q.limit(offset + pageSize).execute();
  if (error) throw new Error(`[data] bars: ${error.message}`);
  const all = (data ?? []) as Record<string, unknown>[];
  return { rows: all.slice(offset, offset + pageSize), hasMore: all.length === offset + pageSize };
}

export interface DataCoverage {
  exchange: string | null;
  listingDate: string | null;
  firstTradeDate: string | null;
  lastTradeDate: string | null;
  actualBars: number;
  expectedBars: number | null;
  /** Sessions the exchange traded that we hold no bar for. */
  missingBars: number | null;
  /** Years between listing and our first bar. Null when listing_date is absent —
   *  63% of BSE and 18% of NSE, where the honest answer is "unknown", not zero. */
  yearsMissingAtStart: number | null;
  isin: string | null;
  /** An ISIN twin whose history starts earlier than this row's. */
  deeperTwin: { id: number; symbol: string; exchange: string | null; firstTradeDate: string } | null;
}

export async function fetchDataCoverage(equityId: number): Promise<DataCoverage | null> {
  const symRes = await from('km_equity_symbols')
    .select('id,symbol,exchange,isin,listing_date,first_trade_date')
    .eq('id', equityId)
    .limit(1)
    .execute();
  if (symRes.error) throw new Error(`[data] symbol: ${symRes.error.message}`);
  const sym = ((symRes.data ?? []) as Record<string, any>[])[0];
  if (!sym) return null;

  const first: string | null = sym.first_trade_date ?? null;
  const listing: string | null = sym.listing_date ?? null;

  const [barsRes, calRes, twinRes] = await Promise.all([
    from('km_equity_eod')
      .select('trade_date')
      .eq('equity_id', equityId)
      .order('trade_date', { ascending: false })
      .limit(20000)
      .execute(),
    first
      ? from('km_trading_calendar')
          .select('trade_date')
          .eq('exchange', sym.exchange === 'BSE' ? 'BSE' : 'NSE')
          .gte('trade_date', first)
          .limit(20000)
          .execute()
      : Promise.resolve({ data: [], error: null } as any),
    sym.isin
      ? from('km_equity_symbols')
          .select('id,symbol,exchange,first_trade_date')
          .eq('isin', sym.isin)
          .limit(10)
          .execute()
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const bars = (barsRes.data ?? []) as { trade_date: string }[];
  const calendar = (calRes.data ?? []) as { trade_date: string }[];

  // The calendar is per exchange and starts in 1994, so "expected" is real
  // sessions rather than calendar days. Null it when the calendar has no rows
  // for this exchange — reporting 100% off an empty denominator would be worse
  // than reporting nothing.
  const expected = calendar.length > 0 ? calendar.length : null;

  let deeperTwin: DataCoverage['deeperTwin'] = null;
  for (const t of (twinRes.data ?? []) as Record<string, any>[]) {
    if (t.id === equityId || !t.first_trade_date) continue;
    if (first && t.first_trade_date >= first) continue;
    if (deeperTwin && t.first_trade_date >= deeperTwin.firstTradeDate) continue;
    deeperTwin = { id: t.id, symbol: t.symbol, exchange: t.exchange, firstTradeDate: t.first_trade_date };
  }

  const yearsMissing =
    listing && first && first > listing
      ? Math.round(((new Date(first).getTime() - new Date(listing).getTime()) / 31557600000) * 10) / 10
      : listing && first
      ? 0
      : null;

  return {
    exchange: sym.exchange ?? null,
    listingDate: listing,
    firstTradeDate: first,
    lastTradeDate: bars[0]?.trade_date ?? null,
    actualBars: bars.length,
    expectedBars: expected,
    missingBars: expected != null ? Math.max(expected - bars.length, 0) : null,
    yearsMissingAtStart: yearsMissing,
    isin: sym.isin ?? null,
    deeperTwin,
  };
}

/** First date each column has a value — the enrichment-depth card.
 *
 *  Asked as one ordered read per column would be 145 round trips, so instead
 *  the whole history is pulled once (already in memory for the coverage card's
 *  bar count) and scanned. The deepest stock is 7,694 bars; scanning that in the
 *  browser is nothing next to 145 queries. */
export interface ColumnDepth { column: string; firstDate: string | null; filled: number; total: number }

export async function fetchColumnDepth(
  equityId: number,
  columns: string[],
): Promise<ColumnDepth[]> {
  const { data, error } = await from('km_equity_eod')
    .select(['trade_date', ...columns.filter((c) => c !== 'trade_date')].join(','))
    .eq('equity_id', equityId)
    .order('trade_date', { ascending: true })
    .limit(20000)
    .execute();
  if (error) throw new Error(`[data] depth: ${error.message}`);
  const rows = (data ?? []) as Record<string, unknown>[];

  return columns.map((col) => {
    let firstDate: string | null = null;
    let filled = 0;
    for (const r of rows) {
      const v = r[col];
      if (v !== null && v !== undefined && v !== '') {
        filled += 1;
        if (!firstDate) firstDate = String(r.trade_date);
      }
    }
    return { column: col, firstDate, filled, total: rows.length };
  });
}
