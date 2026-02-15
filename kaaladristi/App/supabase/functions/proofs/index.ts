/**
 * Edge Function: /api/proofs
 *
 * GET /api/proofs?symbol=NIFTY&regime=capital_protection&limit=20
 *
 * Returns historical accuracy proofs: dates where the engine predicted
 * high risk and actual market movement validated (or didn't validate) it.
 * Cached for 1 hour.
 *
 * Self-contained: shared code inlined for Supabase Dashboard deployment.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';

// ── Shared: Supabase client ──
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('KD_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── Shared: CORS ──
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://kaaladristi.com',
  'https://www.kaaladristi.com',
];

const corsHeaders = (origin: string | null) => {
  const allowed = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o));
  return {
    'Access-Control-Allow-Origin': allowed ? origin! : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
  };
};

function handleCors(req: Request): Response | null {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  return null;
}

// ── Shared: Rate limiter ──
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60_000;

function checkRateLimit(req: Request): Response | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return null;
  }
  bucket.count++;
  if (bucket.count > RATE_LIMIT) {
    const origin = req.headers.get('Origin');
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again in 1 minute.' }),
      { status: 429, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Retry-After': '60' } }
    );
  }
  return null;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip);
  }
}, 5 * 60_000);

// ── Cache ──
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expires) cache.delete(key);
  }
}, 10 * 60_000);

// ── Symbol mapping ──
const SYMBOL_MAP: Record<string, string> = {
  NIFTY: 'NIFTY 50',
  BANKNIFTY: 'NIFTY BANK',
  NIFTYIT: 'NIFTY IT',
  NIFTYFMCG: 'NIFTY FMCG',
};

// ── Handler ──
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
    const regime = url.searchParams.get('regime');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    const cacheKey = `proofs:${symbol}:${regime || 'all'}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...headers, 'X-Cache': 'HIT' },
      });
    }

    let riskQuery = supabase
      .from('km_risk_scores')
      .select('date, composite_score, regime')
      .eq('symbol', symbol)
      .order('date', { ascending: false })
      .limit(limit * 3);

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

    const dates = riskRows.map(r => r.date);
    const { data: marketRows, error: marketError } = await supabase
      .from('km_index_eod')
      .select('trade_date, close, prev_close, pct_chng, high, low')
      .eq('index_id', indexRow.id)
      .in('trade_date', dates);

    if (marketError) {
      console.error('[proofs] Market query error:', marketError.message);
    }

    const marketMap = new Map<string, Record<string, unknown>>();
    for (const m of (marketRows || [])) {
      marketMap.set(m.trade_date, m);
    }

    const proofs = [];
    for (const risk of riskRows) {
      const market = marketMap.get(risk.date);
      if (!market) continue;

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
