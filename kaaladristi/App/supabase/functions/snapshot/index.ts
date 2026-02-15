/**
 * Edge Function: /api/snapshot
 *
 * GET /api/snapshot?date=2026-02-15&symbol=NIFTY
 *
 * Returns the pre-computed daily snapshot for one (date, symbol).
 * In-memory cache with 5-minute TTL — 2000 users = ~1 DB query.
 */
import { handleCors, corsHeaders, checkRateLimit } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';

// ── In-memory cache ──
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clean expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expires) cache.delete(key);
  }
}, 10 * 60_000);

Deno.serve(async (req) => {
  // CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Rate limiting
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

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return new Response(
        JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD.' }),
        { status: 400, headers }
      );
    }

    // Check cache
    const cacheKey = `${dateParam}:${symbol}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...headers, 'X-Cache': 'HIT' },
      });
    }

    // Query km_daily_snapshots — ONE read
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

    // Store in cache
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
