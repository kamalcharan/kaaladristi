/**
 * Minimal client for the read-only postgres-mcp SSE endpoint
 * (https://mcp-db.dristiq.com — same connector the repo's .mcp.json uses).
 *
 * Auth: env KD_MCP_BASIC (base64 "claude:<password>", already the .mcp.json
 * convention). Read-only by construction: the DB role is SELECT-only with
 * default_transaction_read_only=on and a 30s statement timeout.
 *
 * Wire format quirk this file exists to hide: postgres-mcp returns query
 * results as a *Python repr* string, e.g.
 *   [{'j': '[{"id":61,...}]'}]
 * so every query is wrapped server-side as
 *   SELECT coalesce(json_agg(t),'[]')::text AS j FROM (<query>) t
 * — one row, one column, whose value is real JSON — and the repr wrapper is
 * stripped with a small unescaper instead of a full Python parser.
 */

const BASE = process.env.KD_MCP_URL || 'https://mcp-db.dristiq.com';

export async function createClient({ concurrency = 3, verbose = false } = {}) {
  if (!process.env.KD_MCP_BASIC) throw new Error('KD_MCP_BASIC env var not set');
  const AUTH = 'Basic ' + process.env.KD_MCP_BASIC;

  const sse = await fetch(BASE + '/sse', {
    headers: { Authorization: AUTH, Accept: 'text/event-stream' },
  });
  if (!sse.ok) throw new Error(`SSE connect failed: HTTP ${sse.status}`);

  const pending = new Map();
  let endpoint = null;

  (async () => {
    const reader = sse.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const ev = /^event: (.*)$/m.exec(frame)?.[1];
        const data = frame
          .split('\n')
          .filter((l) => l.startsWith('data: '))
          .map((l) => l.slice(6))
          .join('');
        if (ev === 'endpoint') endpoint = data;
        else if (data) {
          try {
            const msg = JSON.parse(data);
            if (msg.id != null && pending.has(msg.id)) {
              const { resolve } = pending.get(msg.id);
              pending.delete(msg.id);
              resolve(msg);
            }
          } catch {
            /* non-JSON keepalive frame — ignore */
          }
        }
      }
    }
    // Stream closed: fail anything still pending so callers don't hang.
    for (const [, { reject }] of pending) reject(new Error('SSE stream closed'));
    pending.clear();
  })();

  const t0 = Date.now();
  while (!endpoint) {
    if (Date.now() - t0 > 15000) throw new Error('No endpoint event within 15s');
    await new Promise((r) => setTimeout(r, 50));
  }

  let rpcId = 0;
  async function rpc(method, params) {
    const id = ++rpcId;
    const p = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    const res = await fetch(BASE + endpoint, {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    });
    if (res.status >= 300) {
      pending.delete(id);
      throw new Error(`RPC POST ${method} → HTTP ${res.status}: ${await res.text()}`);
    }
    return p;
  }

  await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'scan-parity', version: '1' },
  });
  await fetch(BASE + endpoint, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });

  // ── Python-repr → JSON extraction ────────────────────────────────────────
  // The tool result text is repr([{'j': '<json>'}]). The JSON payload sits in
  // a Python single-quoted string; unescape \', \\, \n, \t, \r, \xNN, \uNNNN.
  function extractJson(text) {
    const m = /^\[\{'j':\s*'([\s\S]*)'\}\]$/.exec(text.trim());
    if (!m) throw new Error('Unexpected result shape: ' + text.slice(0, 200));
    const unescaped = m[1].replace(
      /\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|[\s\S])/g,
      (_, esc) => {
        if (esc[0] === 'x') return String.fromCharCode(parseInt(esc.slice(1), 16));
        if (esc[0] === 'u') return String.fromCharCode(parseInt(esc.slice(1), 16));
        const map = { n: '\n', t: '\t', r: '\r', "'": "'", '"': '"', '\\': '\\', '0': '\0' };
        return map[esc] ?? esc;
      },
    );
    return JSON.parse(unescaped);
  }

  // ── Concurrency-limited queue ────────────────────────────────────────────
  let active = 0;
  const waiters = [];
  async function withSlot(fn) {
    if (active >= concurrency) await new Promise((r) => waiters.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      waiters.shift()?.();
    }
  }

  let queryCount = 0;
  async function sql(query) {
    return withSlot(async () => {
      const n = ++queryCount;
      const started = Date.now();
      const wrapped = `SELECT coalesce(json_agg(t),'[]'::json)::text AS j FROM (${query}) t`;
      const msg = await rpc('tools/call', { name: 'execute_sql', arguments: { sql: wrapped } });
      const content = msg.result?.content?.[0]?.text ?? '';
      if (msg.result?.isError) throw new Error(`SQL error: ${content.slice(0, 400)}\n-- query: ${query.slice(0, 200)}`);
      const rows = extractJson(content);
      if (verbose) console.log(`  [sql #${n}] ${rows.length} rows in ${Date.now() - started}ms  ${query.slice(0, 90).replace(/\s+/g, ' ')}`);
      return rows;
    });
  }

  return { sql, stats: () => ({ queryCount }) };
}
