/**
 * A stored session the server no longer accepts must end at /login, not at
 * the Connection Error screen.
 *
 * After the 2026-09-26 JWT-secret rotation every browser holding a
 * `kd_session` signed with the OLD secret got PostgREST's
 * `PGRST301 JWSError JWSInvalidSignature` on the profile read, and the
 * bootstrap filed that under `authError` — the Connection Error screen, whose
 * only control is Reload, which sends the same dead token again. Nothing the
 * user could do from that screen recovered the session.
 *
 * Seeds a token HMAC-signed with a WRONG secret (future `exp`, so the local
 * expiry check lets it through — exactly the rotation shape), mocks the
 * PostgREST profile read, and asserts, for every rejection shape the fix must
 * recognise, that the app lands on /login with `kd_session` cleared and never
 * shows Connection Error. Two controls prove the screen still exists for what
 * it is for: a 5xx and a dead network.
 *
 *   node scripts/qa/check-auth-rejection.mjs        # needs Vite on 127.0.0.1:5174
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { chromium } from 'playwright-core';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5174';
const exe = process.env.QA_BROWSER ?? '/opt/pw-browsers/chromium';

const USER_ID = '00000000-0000-4000-8000-000000000001';

/** A real HS256 token, signed with a secret the server does not hold. */
function tokenSignedWithWrongSecret() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({
    role: 'authenticated', sub: USER_ID, email: 'qa@harness.local', iss: 'kaaladristi',
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7 * 86400,
  });
  const sig = createHmac('sha256', 'not-the-secret-the-server-rotated-to').update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

// Every shape the fix must treat as an auth rejection, plus two that it must
// NOT. `respond` is what the mocked PostgREST profile read answers with.
const CASES = [
  { label: 'PGRST301 JWSError JWSInvalidSignature (the rotation shape)', rejected: true,
    respond: { status: 401, body: { code: 'PGRST301', message: 'JWSError JWSInvalidSignature', details: null, hint: null } } },
  { label: 'PGRST303 JWT expired', rejected: true,
    respond: { status: 401, body: { code: 'PGRST303', message: 'JWT expired', details: null, hint: null } } },
  { label: 'bare HTTP 401, no body', rejected: true,
    respond: { status: 401, body: null } },
  { label: 'message match only: JWSError under an unknown code', rejected: true,
    respond: { status: 400, body: { code: 'PGRST999', message: 'JWSError (CompactDecodeError Invalid number of parts)' } } },
  { label: 'PGRST302 under a 403', rejected: true,
    respond: { status: 403, body: { code: 'PGRST302', message: 'Anonymous access is disabled' } } },
  { label: 'CONTROL: 503 keeps the Connection Error screen', rejected: false,
    respond: { status: 503, body: { message: 'upstream unavailable' } } },
  { label: 'CONTROL: dead network keeps the Connection Error screen', rejected: false,
    respond: 'abort' },
];

let browser;
let failures = 0;
try {
  browser = await chromium.launch({ executablePath: exe, headless: true });
  for (const c of CASES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const token = tokenSignedWithWrongSecret();
    await ctx.addInitScript(({ token, userId }) => {
      // Seed ONLY if absent: addInitScript runs on every navigation, and the
      // whole point is to observe whether the app cleared it.
      if (localStorage.getItem('kd_session') === null && !sessionStorage.getItem('__seeded')) {
        sessionStorage.setItem('__seeded', '1');
        localStorage.setItem('kd_session', JSON.stringify({
          access_token: token,
          user: { id: userId, email: 'qa@harness.local' },
        }));
      }
    }, { token, userId: USER_ID });
    const page = await ctx.newPage();

    let profileReads = 0;
    await page.route('**/*', async (r) => {
      const url = r.request().url();
      if (!url.startsWith(base)) return r.abort();
      if (url.includes('/db/km_profiles')) {
        profileReads += 1;
        if (c.respond === 'abort') return r.abort('connectionfailed');
        return r.fulfill({
          status: c.respond.status,
          contentType: 'application/json',
          body: c.respond.body === null ? '' : JSON.stringify(c.respond.body),
        });
      }
      // Nothing else in the bootstrap may reach a backend.
      if (url.includes('/db/') || url.includes('/api/') || url.includes('/pipeline-api/')) return r.abort();
      return r.continue();
    });

    await page.goto(`${base}/workspace`);

    // The bootstrap retries the profile read once after 1.5s before it
    // decides; give it that plus margin, then read the outcome.
    await page.waitForFunction(
      () => location.pathname === '/login' || document.body.innerText.includes('Connection Error'),
      null, { timeout: 15000 },
    ).catch(() => {});
    await page.waitForTimeout(300);

    const outcome = await page.evaluate(() => ({
      path: location.pathname,
      stored: localStorage.getItem('kd_session'),
      connectionError: document.body.innerText.includes('Connection Error'),
    }));

    try {
      assert.ok(profileReads >= 1, `${c.label}: the profile read was never attempted`);
      if (c.rejected) {
        assert.equal(outcome.path, '/login', `${c.label}: landed on ${outcome.path}, not /login`);
        assert.equal(outcome.stored, null, `${c.label}: kd_session still stored after the rejection`);
        assert.equal(outcome.connectionError, false, `${c.label}: Connection Error screen shown for an auth rejection`);
      } else {
        assert.equal(outcome.connectionError, true, `${c.label}: Connection Error screen missing on a real failure`);
        assert.notEqual(outcome.path, '/login', `${c.label}: a real failure redirected to /login`);
        assert.notEqual(outcome.stored, null, `${c.label}: kd_session cleared on a failure that was not an auth rejection`);
      }
      console.log(`  ✓ ${c.label}`);
    } catch (e) {
      failures += 1;
      console.log(`  ✗ ${e.message}`);
    }
    await ctx.close();
  }
} finally {
  await browser?.close();
}

if (failures) {
  console.log(`\nauth rejection: ${failures} of ${CASES.length} checks FAILED`);
  process.exit(1);
}
console.log(`\n✓ auth rejection: ${CASES.length} checks passed`);
