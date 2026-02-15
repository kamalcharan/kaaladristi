/**
 * Edge Function: /api/proofs
 *
 * GET /api/proofs?symbol=NIFTY&regime=capital_protection&limit=20
 *
 * Returns historical accuracy proofs: dates where the engine predicted
 * high risk and actual market movement validated (or didn't validate) it.
 * Cached for 1 hour — proofs don't change until new data comes in.
 */
import { handleCors, corsHeaders, checkRateLimit } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';

// ── Cache ──
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

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
    const regime = url.searchParams.get('regime'); // optional filter
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    // Check cache
    const cacheKey = `proofs:${symbol}:${regime || 'all'}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...headers, 'X-Cache': 'HIT' },
      });
    }

    // Step 1: Get recent risk scores (ordered by date desc, most recent first)
    let riskQuery = supabase
      .from('km_risk_scores')
      .select('date, composite_score, regime')
      .eq('symbol', symbol)
      .order('date', { ascending: false })
      .limit(limit * 3); // Fetch more to account for non-trading days

    if (regime) {
      riskQuery = riskQuery.eq('regime', regime);
    }

    const { data: riskRows, error: riskError } = await riskQuery;

    if (riskError) {
      console.error('[proofs] Risk query error:', riskError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch risk scores' }),
        { status: 500, headers }
      );
    }

    if (!riskRows || riskRows.length === 0) {
      const result = { symbol, proofs: [], count: 0 };
      cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
      return new Response(JSON.stringify(result), { headers });
    }

    // Step 2: Resolve index_id for market data lookup
    const indexName = SYMBOL_MAP[symbol] || symbol;
    const { data: indexRow } = await supabase
      .from('km_index_symbols')
      .select('id')
      .eq('name', indexName)
      .limit(1)
      .maybeSingle();

    if (!indexRow) {
      return new Response(
        JSON.stringify({ error: `Index not found: ${symbol}` }),
        { status: 404, headers }
      );
    }

    // Step 3: Fetch market data for those dates
    const dates = riskRows.map(r => r.date);
    const { data: marketRows, error: marketError } = await supabase
      .from('km_index_eod')
      .select('trade_date, close, prev_close, pct_chng, high, low')
      .eq('index_id', indexRow.id)
      .in('trade_date', dates);

    if (marketError) {
      console.error('[proofs] Market query error:', marketError.message);
    }

    // Build market lookup
    const marketMap = new Map<string, Record<string, unknown>>();
    for (const m of (marketRows || [])) {
      marketMap.set(m.trade_date, m);
    }

    // Step 4: Build proof entries
    const proofs = [];
    for (const risk of riskRows) {
      const market = marketMap.get(risk.date);
      if (!market) continue; // Skip non-trading days

      const close = market.close as number;
      const prevClose = (market.prev_close as number) || close;
      let actualReturn: number;

      if (market.pct_chng != null) {
        actualReturn = market.pct_chng as number;
      } else if (prevClose > 0) {
        actualReturn = ((close - prevClose) / prevClose) * 100;
      } else {
        continue;
      }

      const score = risk.composite_score;
      const highRange = market.high && market.low && close
        ? ((market.high as number) - (market.low as number)) / close * 100
        : 0;

      // Determine if prediction was "correct":
      // High risk (>50) + negative return = correct bearish call
      // Low risk (<=50) + positive return = correct bullish call
      const isCorrect = (score > 50 && actualReturn < 0) || (score <= 50 && actualReturn >= 0);

      proofs.push({
        date: risk.date,
        score,
        regime: risk.regime,
        actualReturn: Math.round(actualReturn * 100) / 100,
        dailyRange: Math.round(highRange * 100) / 100,
        volatility: score > 60 ? 'High' : score > 35 ? 'Medium' : 'Low',
        isCorrect,
      });

      if (proofs.length >= limit) break;
    }

    // Compute summary stats
    const correctCount = proofs.filter(p => p.isCorrect).length;
    const result = {
      symbol,
      count: proofs.length,
      accuracy: proofs.length > 0
        ? Math.round((correctCount / proofs.length) * 1000) / 10
        : 0,
      proofs,
    };

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });

    return new Response(JSON.stringify(result), {
      headers: { ...headers, 'X-Cache': 'MISS' },
    });
  } catch (err) {
    console.error('[proofs] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers }
    );
  }
});
