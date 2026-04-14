/**
 * PostgREST client for KaalaDristi frontend.
 * Replaces @supabase/supabase-js with direct PostgREST HTTP calls.
 *
 * PostgREST query syntax: https://postgrest.org/en/stable/references/api.html
 */

const postgrestUrl = (
  import.meta.env.VITE_POSTGREST_URL?.trim() ||
  import.meta.env.VITE_SUPABASE_URL?.trim()   // legacy fallback
);

const anonKey = (
  import.meta.env.VITE_ANON_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()  // legacy fallback
);

if (!postgrestUrl) {
  console.error(
    '[Kala-Drishti] PostgREST URL missing!\n' +
    '  VITE_POSTGREST_URL:', postgrestUrl ? 'set' : 'MISSING', '\n' +
    '  Make sure .env file exists in App/frontend/ with this value.'
  );
}

/** Resolve the base URL — Supabase URLs need /rest/v1, self-hosted PostgREST does not */
function resolveBase(url: string): string {
  if (!url) return '';
  url = url.replace(/\/+$/, '');
  if (url.includes('supabase.co')) return `${url}/rest/v1`;
  if (url.endsWith('/rest/v1')) return url;
  return url;
}

const BASE_URL = resolveBase(postgrestUrl || '');

console.log('[Kala-Drishti] PostgREST URL:', BASE_URL || '(not set)');

/** Get current auth token (JWT from localStorage, or anon key) */
function getAuthToken(): string {
  const session = localStorage.getItem('kd_session');
  if (session) {
    try {
      const parsed = JSON.parse(session);
      if (parsed.access_token) return parsed.access_token;
    } catch { /* ignore */ }
  }
  return anonKey || '';
}

/** Build default headers for PostgREST requests */
function getHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  // Supabase also needs apikey header
  if (postgrestUrl?.includes('supabase.co') && anonKey) {
    headers['apikey'] = anonKey;
  }
  return { ...headers, ...extra };
}

// ─── Query builder ──────────────────────────────────────────────────────────

export interface PostgRESTQuery {
  /** Execute the query and return typed data */
  then<T>(resolve: (value: { data: T[] | null; error: PostgRESTError | null; count?: number }) => void): void;
}

export interface PostgRESTError {
  message: string;
  code: string;
  details?: string;
}

interface QueryState {
  table: string;
  params: URLSearchParams;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  single?: boolean;
  maybeSingle?: boolean;
  headers?: Record<string, string>;
}

class QueryBuilder {
  private state: QueryState;
  private _withCount = false;

  constructor(table: string) {
    this.state = {
      table,
      params: new URLSearchParams(),
      method: 'GET',
    };
  }

  select(columns: string = '*'): this {
    this.state.params.set('select', columns);
    this.state.method = 'GET';
    return this;
  }

  eq(column: string, value: string | number): this {
    this.state.params.append(column, `eq.${value}`);
    return this;
  }

  gte(column: string, value: string | number): this {
    this.state.params.append(column, `gte.${value}`);
    return this;
  }

  lte(column: string, value: string | number): this {
    this.state.params.append(column, `lte.${value}`);
    return this;
  }

  /** Case-insensitive pattern match. Use * as wildcard, e.g. "*reliance*" */
  ilike(column: string, pattern: string): this {
    this.state.params.append(column, `ilike.${pattern}`);
    return this;
  }

  /** IN filter: column IN (val1, val2, ...) */
  in(column: string, values: (string | number)[]): this {
    this.state.params.append(column, `in.(${values.join(',')})`);
    return this;
  }

  /** Greater than */
  gt(column: string, value: string | number): this {
    this.state.params.append(column, `gt.${value}`);
    return this;
  }

  /** Less than */
  lt(column: string, value: string | number): this {
    this.state.params.append(column, `lt.${value}`);
    return this;
  }

  /** Not equal */
  neq(column: string, value: string | number): this {
    this.state.params.append(column, `neq.${value}`);
    return this;
  }

  /** IS filter for null/true/false */
  is(column: string, value: 'null' | 'true' | 'false'): this {
    this.state.params.append(column, `is.${value}`);
    return this;
  }

  /** Request total row count — PostgREST returns it in Content-Range header */
  withCount(): this {
    this._withCount = true;
    this.state.headers = { ...this.state.headers, 'Prefer': 'count=exact' };
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    const dir = opts?.ascending === false ? 'desc' : 'asc';
    this.state.params.append('order', `${column}.${dir}`);
    return this;
  }

  limit(count: number): this {
    this.state.params.set('limit', String(count));
    return this;
  }

  range(from: number, to: number): this {
    this.state.headers = {
      ...this.state.headers,
      'Range': `${from}-${to}`,
      'Range-Unit': 'items',
    };
    // PostgREST also respects limit+offset
    this.state.params.set('offset', String(from));
    this.state.params.set('limit', String(to - from + 1));
    return this;
  }

  single(): this {
    this.state.single = true;
    this.state.params.set('limit', '1');
    this.state.headers = {
      ...this.state.headers,
      'Accept': 'application/vnd.pgrst.object+json',
    };
    return this;
  }

  maybeSingle(): this {
    this.state.maybeSingle = true;
    this.state.params.set('limit', '1');
    this.state.headers = {
      ...this.state.headers,
      'Accept': 'application/vnd.pgrst.object+json',
    };
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): this {
    this.state.method = 'POST';
    this.state.body = data;
    this.state.headers = {
      ...this.state.headers,
      'Prefer': 'return=representation',
    };
    return this;
  }

  update(data: Record<string, unknown>): this {
    this.state.method = 'PATCH';
    this.state.body = data;
    this.state.headers = {
      ...this.state.headers,
      'Prefer': 'return=representation',
    };
    return this;
  }

  delete(): this {
    this.state.method = 'DELETE';
    return this;
  }

  async execute(): Promise<{ data: any; error: PostgRESTError | null; count?: number }> {
    const qs = this.state.params.toString();
    const url = `${BASE_URL}/${this.state.table}${qs ? '?' + qs : ''}`;
    const headers = getHeaders(this.state.headers);

    try {
      const resp = await fetch(url, {
        method: this.state.method,
        headers,
        body: this.state.body ? JSON.stringify(this.state.body) : undefined,
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        return {
          data: null,
          error: {
            message: errBody.message || `HTTP ${resp.status}`,
            code: errBody.code || `PGRST${resp.status}`,
            details: errBody.details,
          },
        };
      }

      // 204 No Content (DELETE, etc.)
      if (resp.status === 204) {
        return { data: null, error: null };
      }

      const data = await resp.json();

      // maybeSingle: return null if not found (406 from Accept header → empty)
      if (this.state.maybeSingle && data === null) {
        return { data: null, error: null };
      }

      // Parse total count from Content-Range: "0-49/1380"
      let count: number | undefined;
      if (this._withCount) {
        const cr = resp.headers.get('Content-Range');
        if (cr?.includes('/')) {
          const n = parseInt(cr.split('/')[1], 10);
          if (!isNaN(n)) count = n;
        }
      }

      return { data, error: null, count };
    } catch (err) {
      return {
        data: null,
        error: {
          message: err instanceof Error ? err.message : 'Network error',
          code: 'NETWORK_ERROR',
        },
      };
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Create a query builder for a table — drop-in replacement for supabase.from() */
export function from(table: string): QueryBuilder {
  return new QueryBuilder(table);
}

/** Call a PostgREST RPC function */
export async function rpc(
  fnName: string,
  params?: Record<string, unknown>,
): Promise<{ data: any; error: PostgRESTError | null }> {
  const url = `${BASE_URL}/rpc/${fnName}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params || {}),
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      return {
        data: null,
        error: { message: errBody.message || `HTTP ${resp.status}`, code: errBody.code || 'RPC_ERROR' },
      };
    }
    const data = await resp.json();
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Network error', code: 'NETWORK_ERROR' },
    };
  }
}

/** PostgREST client object — similar shape to the old supabase client for easy migration */
export const db = { from, rpc };

export default db;
