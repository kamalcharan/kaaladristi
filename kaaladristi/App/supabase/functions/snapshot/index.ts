/**
 * Edge Function: /api/snapshot
 *
 * GET /api/snapshot?date=2026-02-15&symbol=NIFTY
 *
 * Returns the pre-computed daily snapshot for one (date, symbol).
 * In-memory cache with 5-minute TTL — 2000 users = ~1 DB query.
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

// ── In-memory cache ──
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expires) cache.delete(key);
  }
}, 10 * 60_000);

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
    const dateParam = url.searchParams.get('date');
    const symbol = url.searchParams.get('symbol') || 'NIFTY';

    if (!dateParam) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: date (YYYY-MM-DD)' }),
        { status: 400, headers }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return new Response(
        JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD.' }),
        { status: 400, headers }
      );
    }

    const cacheKey = `${dateParam}:${symbol}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...headers, 'X-Cache': 'HIT' },
      });
    }

    const { data, error } = await supabase
      .from('km_daily_snapshots')
      .select('snapshot')
      .eq('date', dateParam)
      .eq('symbol', symbol)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[snapshot] DB error:', error.message);
      return new Response(
        JSON.stringify({ error: 'Database query failed' }),
        { status: 500, headers }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'No snapshot found', date: dateParam, symbol }),
        { status: 404, headers }
      );
    }

    const snapshot = data.snapshot;
    cache.set(cacheKey, { data: snapshot, expires: Date.now() + CACHE_TTL });

    return new Response(JSON.stringify(snapshot), {
      headers: { ...headers, 'X-Cache': 'MISS' },
    });
  } catch (err) {
    console.error('[snapshot] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers }
    );
  }
});
