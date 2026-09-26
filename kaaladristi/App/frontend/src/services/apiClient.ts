/**
 * Shared FastAPI client — the ONE module every call to kd-pipeline-api2
 * (port 8101, `/api/*`) goes through. Contract: `.claude/skills/api-auth-contract/SKILL.md` §4.
 *
 * Two instances share one implementation:
 *
 *   api       — the app. Attaches the session token from authStore
 *               (`kd_session.access_token`, `role: authenticated`). On 401 it
 *               drops the session and redirects to /login. Never retries.
 *   guestApi  — the logged-out landing page. Holds a short-lived guest token
 *               (`role: guest`, 15 min) in MEMORY ONLY, mints it on demand from
 *               POST /api/guest/token, refreshes it 30 s before expiry, and on a
 *               401 re-mints once and retries once.
 *
 * Rules enforced here rather than by convention:
 *   - exactly one place builds `Authorization: Bearer …`;
 *   - `api` refuses `/api/guest/*` and `guestApi` refuses everything else, so a
 *     landing component cannot silently start using the session token (and a
 *     guest token is never sent where it would be rejected as `wrong_role`);
 *   - no `credentials: 'include'` — tokens travel in the header and CORS runs
 *     with allow_credentials=false;
 *   - `.fetch()` returns the raw Response so call sites keep their own `res.ok`
 *     handling and error wording byte-for-byte; `.get/.post/...` are the
 *     conveniences the old `apiGet/apiPost` helpers offered (throw ApiError
 *     carrying FastAPI's `detail`).
 *
 * `services/postgrest.ts` is NOT this module: it keeps its own token handling
 * for `/db/*`, and the guest client never touches it.
 */

import { useAuthStore } from '@/stores/authStore';
import { signOut } from '@/services/auth';

const API_BASE = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || '');

export const GUEST_PREFIX = '/api/guest/';
export const GUEST_TOKEN_PATH = '/api/guest/token';
/** Re-mint this many seconds before the guest token's `exp` (SKILL.md §3.3). */
const GUEST_REFRESH_MARGIN_S = 30;

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly retryAfter: number | null;
  constructor(status: number, detail: string, retryAfter: number | null = null) {
    super(detail || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.retryAfter = retryAfter;
  }
}

/** FastAPI puts the reason in a JSON `detail`; fall back to the status. */
async function errorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const d = body?.detail;
    if (typeof d === 'string' && d) return d;
    if (d) return JSON.stringify(d);
  } catch { /* not JSON */ }
  return `HTTP ${res.status}`;
}

function isGuestPath(path: string): boolean {
  return path.startsWith(GUEST_PREFIX) || path === GUEST_TOKEN_PATH.replace(/\/$/, '');
}

type Kind = 'app' | 'guest';

export interface ApiClient {
  /** Drop-in for `fetch(\`${VITE_PIPELINE_API_URL}${path}\`, init)` — adds the token, handles 401. */
  fetch(path: string, init?: RequestInit): Promise<Response>;
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  delete<T>(path: string, init?: RequestInit): Promise<T>;
}

// ── Session (app) token ───────────────────────────────────────────────────────

function sessionToken(): string | null {
  return useAuthStore.getState().session?.access_token ?? null;
}

let redirecting = false;

/** A 401 from the app: the session is dead. Drop it and go to /login once. */
async function onAppUnauthorized(): Promise<void> {
  if (redirecting) return;
  redirecting = true;
  try { await signOut(); } catch { /* clearing local state cannot fail in a way we can act on */ }
  useAuthStore.getState().clear();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    const next = window.location.pathname + window.location.search;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }
}

// ── Guest token (landing) ─────────────────────────────────────────────────────

interface GuestToken { token: string; exp: number /* epoch seconds */ }

let guestToken: GuestToken | null = null;
let guestMint: Promise<GuestToken> | null = null;

function decodeExp(jwt: string, fallbackSeconds: number): number {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp === 'number') return payload.exp;
  } catch { /* fall back to expires_in */ }
  return Math.floor(Date.now() / 1000) + fallbackSeconds;
}

async function mintGuestToken(): Promise<GuestToken> {
  if (guestMint) return guestMint;
  guestMint = (async () => {
    const res = await fetch(`${API_BASE}${GUEST_TOKEN_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const ra = Number(res.headers.get('Retry-After'));
      throw new ApiError(res.status, await errorDetail(res), Number.isFinite(ra) && ra > 0 ? ra : null);
    }
    const j = await res.json() as { token: string; expires_in?: number };
    const t = { token: j.token, exp: decodeExp(j.token, j.expires_in ?? 900) };
    guestToken = t;
    return t;
  })().finally(() => { guestMint = null; });
  return guestMint;
}

async function currentGuestToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (guestToken && guestToken.exp - now > GUEST_REFRESH_MARGIN_S) return guestToken.token;
  return (await mintGuestToken()).token;
}

/** Test/QA hook: forget the in-memory guest token. */
export function resetGuestToken(): void { guestToken = null; }

// ── Shared implementation ─────────────────────────────────────────────────────

function withAuth(init: RequestInit | undefined, token: string | null): RequestInit {
  const headers = new Headers(init?.headers ?? {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers, credentials: 'omit' };
}

function assertPath(kind: Kind, path: string): void {
  if (!path.startsWith('/')) throw new Error(`apiClient: path must start with "/" (got ${path})`);
  const guest = isGuestPath(path);
  if (kind === 'app' && guest) {
    throw new Error(`apiClient: the app client must not call guest routes (${path}) — use guestApi`);
  }
  if (kind === 'guest' && !guest) {
    throw new Error(`apiClient: the guest client may only call /api/guest/* (got ${path})`);
  }
}

async function doFetch(kind: Kind, path: string, init?: RequestInit): Promise<Response> {
  assertPath(kind, path);
  const url = `${API_BASE}${path}`;
  if (kind === 'app') {
    const res = await fetch(url, withAuth(init, sessionToken()));
    if (res.status === 401) await onAppUnauthorized();
    return res;
  }
  // guest: mint on demand, one re-mint + one retry on 401
  let res = await fetch(url, withAuth(init, await currentGuestToken()));
  if (res.status === 401) {
    guestToken = null;
    res = await fetch(url, withAuth(init, await currentGuestToken()));
  }
  return res;
}

function jsonInit(method: string, body: unknown, init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers ?? {});
  if (body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return { ...init, method, headers, body: body === undefined ? init?.body : JSON.stringify(body) };
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function makeClient(kind: Kind): ApiClient {
  return {
    fetch: (path, init) => doFetch(kind, path, init),
    get:    async (path, init) => asJson(await doFetch(kind, path, { ...init, method: 'GET' })),
    post:   async (path, body, init) => asJson(await doFetch(kind, path, jsonInit('POST', body, init))),
    put:    async (path, body, init) => asJson(await doFetch(kind, path, jsonInit('PUT', body, init))),
    patch:  async (path, body, init) => asJson(await doFetch(kind, path, jsonInit('PATCH', body, init))),
    delete: async (path, init) => asJson(await doFetch(kind, path, { ...init, method: 'DELETE' })),
  };
}

/** The app client — every logged-in FastAPI call. */
export const api: ApiClient = makeClient('app');
/** The landing client — `/api/guest/*` only. */
export const guestApi: ApiClient = makeClient('guest');
