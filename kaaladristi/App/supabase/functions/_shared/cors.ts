/**
 * Shared CORS headers and rate limiting for all Edge Functions.
 */

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://kaaladristi.com',
  'https://www.kaaladristi.com',
];

export const corsHeaders = (origin: string | null) => {
  const allowed = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o));
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
  };
};

export function handleCors(req: Request): Response | null {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  return null;
}

/**
 * Simple in-memory rate limiter.
 * Limits requests per IP per minute.
 */
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // requests per minute per IP
const RATE_WINDOW = 60_000; // 1 minute

export function checkRateLimit(req: Request): Response | null {
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
      {
        status: 429,
        headers: {
          ...corsHeaders(origin),
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
      }
    );
  }

  return null;
}

// Clean up stale rate limit buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) {
      rateBuckets.delete(ip);
    }
  }
}, 5 * 60_000);
