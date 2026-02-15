/**
 * Edge Function: /api/calendar
 *
 * GET /api/calendar?year=2026&month=2&symbol=NIFTY
 *
 * Returns an array of mini-snapshots for every day in a month.
 * Each entry has: date, risk score, regime, and panchang summary.
 * Cached for 30 minutes (past months are immutable).
 */
import { handleCors, corsHeaders, checkRateLimit } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';

// ── In-memory cache ──
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL_CURRENT = 30 * 60 * 1000; // 30 min for current month
const CACHE_TTL_PAST = 24 * 60 * 60 * 1000; // 24 hours for past months

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expires) cache.delete(key);
  }
}, 10 * 60_000);

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const rateLimited = checkRateLimit(req);
  if (rateLimited) return rateLimited;

  const origin = req.headers.get('Origin');
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };

  try {
    const url = new URL(req.url);
    const year = parseInt(url.searchParams.get('year') || '');
    const month = parseInt(url.searchParams.get('month') || '');
    const symbol = url.searchParams.get('symbol') || 'NIFTY';

    if (!year || !month || month < 1 || month > 12) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid parameters: year, month (1-12)' }),
        { status: 400, headers }
      );
    }

    // Check cache
    const cacheKey = `cal:${year}-${month}:${symbol}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...headers, 'X-Cache': 'HIT' },
      });
    }

    // Compute month boundaries
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // Fetch all snapshots for this month
    const { data, error } = await supabase
      .from('km_daily_snapshots')
      .select('date, snapshot')
      .eq('symbol', symbol)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date');

    if (error) {
      console.error('[calendar] DB error:', error.message);
      return new Response(
        JSON.stringify({ error: 'Database query failed' }),
        { status: 500, headers }
      );
    }

    // Extract mini-snapshots (just what the calendar needs)
    const calendarDays = (data || []).map((row: { date: string; snapshot: Record<string, unknown> }) => {
      const s = row.snapshot as Record<string, unknown>;
      const risk = s.risk as Record<string, unknown> | null;
      const panchang = s.panchang as Record<string, unknown> | null;
      const events = (s.events as unknown[]) || [];

      return {
        date: row.date,
        score: risk?.composite_score ?? null,
        regime: risk?.regime ?? null,
        nakshatra: panchang?.nakshatra_name ?? null,
        tithi: panchang?.tithi_name ?? null,
        paksha: panchang?.paksha ?? null,
        vara: panchang?.vara ?? null,
        dlnl: panchang?.dlnl_match ?? false,
        sankranti: panchang?.is_sankranti ?? false,
        event_count: events.length,
        has_retrograde: (
          (s.planets as Array<Record<string, unknown>>) || []
        ).some((p) => p.retrograde === true),
      };
    });

    // Determine cache TTL (past months get longer cache)
    const now = new Date();
    const isPastMonth = year < now.getFullYear() ||
      (year === now.getFullYear() && month < now.getMonth() + 1);
    const ttl = isPastMonth ? CACHE_TTL_PAST : CACHE_TTL_CURRENT;

    const result = { year, month, symbol, days: calendarDays };
    cache.set(cacheKey, { data: result, expires: Date.now() + ttl });

    return new Response(JSON.stringify(result), {
      headers: { ...headers, 'X-Cache': 'MISS' },
    });
  } catch (err) {
    console.error('[calendar] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers }
    );
  }
});
