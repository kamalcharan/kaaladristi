/**
 * Edge Function: /api/eod-chart
 *
 * GET /api/eod-chart?symbol=NIFTY&from=2025-01-01&to=2026-02-15
 *
 * Returns EOD OHLCV data for chart rendering.
 * Server-side downsamples to max 500 points using LTTB-style every-nth.
 * Replaces the frontend's .range(0, 9999) direct Supabase query.
 */
import { handleCors, corsHeaders, checkRateLimit } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';

// ── Cache ──
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 min

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expires) cache.delete(key);
  }
}, 10 * 60_000);

// ── Symbol → index name mapping ──
const SYMBOL_MAP: Record<string, string> = {
  NIFTY: 'NIFTY 50',
  BANKNIFTY: 'NIFTY BANK',
  NIFTYIT: 'NIFTY IT',
  NIFTYFMCG: 'NIFTY FMCG',
};

// ── Downsample: keep every Nth point to stay under maxPoints ──
function downsample<T>(data: T[], maxPoints: number): T[] {
  if (data.length <= maxPoints) return data;
  const step = data.length / maxPoints;
  const result: T[] = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    result.push(data[Math.floor(i * step)]);
  }
  // Always include the last point
  result.push(data[data.length - 1]);
  return result;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const rateLimited = checkRateLimit(req);
  if (rateLimited) return rateLimited;

  const origin = req.headers.get('Origin');
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };

  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol') || 'NIFTY';
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const maxPointsParam = parseInt(url.searchParams.get('max_points') || '500');
    const maxPoints = Math.min(Math.max(maxPointsParam, 50), 2000);

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: to (YYYY-MM-DD)' }),
        { status: 400, headers }
      );
    }

    // Check cache
    const cacheKey = `eod:${symbol}:${from || 'MAX'}:${to}:${maxPoints}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...headers, 'X-Cache': 'HIT' },
      });
    }

    // Resolve symbol → index_id
    const indexName = SYMBOL_MAP[symbol] || symbol;
    const { data: indexRow, error: indexError } = await supabase
      .from('km_index_symbols')
      .select('id')
      .eq('name', indexName)
      .limit(1)
      .maybeSingle();

    if (indexError || !indexRow) {
      return new Response(
        JSON.stringify({ error: `Index not found: ${symbol}` }),
        { status: 404, headers }
      );
    }

    // Fetch EOD data with date range
    let query = supabase
      .from('km_index_eod')
      .select('trade_date, open, high, low, close, prev_close, volume, pct_chng')
      .eq('index_id', indexRow.id)
      .lte('trade_date', to)
      .order('trade_date', { ascending: true });

    if (from) {
      query = query.gte('trade_date', from);
    }

    // Fetch up to 10000 rows (paginated)
    const allRows: Record<string, unknown>[] = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      const { data: page, error: pageError } = await query.range(offset, offset + pageSize - 1);
      if (pageError) {
        console.error('[eod-chart] DB error:', pageError.message);
        return new Response(
          JSON.stringify({ error: 'Database query failed' }),
          { status: 500, headers }
        );
      }
      if (!page || page.length === 0) break;
      allRows.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    // Map to chart-friendly format
    const chartData = allRows.map((r: Record<string, unknown>) => ({
      date: r.trade_date as string,
      open: r.open as number | null,
      high: r.high as number | null,
      low: r.low as number | null,
      close: r.close as number | null,
      volume: r.volume as number | null,
    }));

    // Downsample for chart performance
    const downsampled = downsample(chartData, maxPoints);

    // Compute stats from the full dataset (before downsampling)
    let stats = null;
    if (allRows.length > 0) {
      const latest = allRows[allRows.length - 1] as Record<string, unknown>;
      const currentClose = (latest.close as number) || 0;
      const prevClose = (latest.prev_close as number) || (allRows.length > 1 ? (allRows[allRows.length - 2] as Record<string, unknown>).close as number : currentClose) || 0;
      const change = currentClose - prevClose;
      const changePct = prevClose ? (change / prevClose) * 100 : 0;

      // 52-week high/low from last ~252 trading days
      const last252 = allRows.slice(-252);
      const highs = last252.map(r => (r as Record<string, unknown>).high as number).filter(Boolean);
      const lows = last252.map(r => (r as Record<string, unknown>).low as number).filter(v => v && v > 0);

      stats = {
        currentClose: Math.round(currentClose * 100) / 100,
        previousClose: Math.round(prevClose * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePct: Math.round(changePct * 100) / 100,
        high52w: highs.length ? Math.max(...highs) : 0,
        low52w: lows.length ? Math.min(...lows) : 0,
        dayHigh: (latest.high as number) || 0,
        dayLow: (latest.low as number) || 0,
      };
    }

    const result = {
      symbol,
      from: from || (allRows.length ? (allRows[0] as Record<string, unknown>).trade_date : null),
      to,
      totalRows: allRows.length,
      chartPoints: downsampled.length,
      chartData: downsampled,
      stats,
    };

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });

    return new Response(JSON.stringify(result), {
      headers: { ...headers, 'X-Cache': 'MISS' },
    });
  } catch (err) {
    console.error('[eod-chart] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers }
    );
  }
});
