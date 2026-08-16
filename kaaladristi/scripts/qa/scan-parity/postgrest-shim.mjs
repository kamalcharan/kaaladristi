/**
 * Drop-in replacement for src/services/postgrest.ts used by the parity
 * harness. Implements the same QueryBuilder surface, but execute() translates
 * the accumulated filters into SQL run over the read-only MCP endpoint
 * instead of a PostgREST HTTP call — so the REAL scanEngine.ts code runs
 * unmodified against live data with no PostgREST/JWT access needed.
 *
 * Faithfulness rules:
 *  - Only the builder methods scanEngine actually uses are implemented
 *    (select/eq/gte/lte/gt/lt/neq/in/is/notNull/order/limit). Anything else
 *    throws immediately — silent divergence is the one unacceptable failure.
 *  - Filters translate 1:1 to WHERE clauses; `.is('x','true')` → `x IS TRUE`,
 *    matching PostgREST `is.true` semantics.
 *  - Large `.in()` lists are transparently split into sub-queries and
 *    concatenated. This is only valid because the callers' LIMITs never bind
 *    (chunk limits are far above real row counts) — asserted at runtime:
 *    if any sub-query returns exactly its LIMIT, we abort loudly.
 *
 * PARITY_LIFT_SYMBOL_CAP=1: raises the km_equity_symbols LIMIT from the
 * production 8000 to 20000. Production truncates the 10k+ active universe at
 * 8000 rows in arbitrary order (found 2026-08-15 — see the audit report);
 * lifting the cap isolates LOGIC parity from that data-visibility bug.
 */

import { createClient } from './mcp-sql.mjs';

const LIFT_SYMBOL_CAP = process.env.PARITY_LIFT_SYMBOL_CAP === '1';
const IN_CHUNK = 100;

let _client = null;
async function client() {
  if (!_client) _client = await createClient({ concurrency: 3, verbose: process.env.PARITY_VERBOSE === '1' });
  return _client;
}

function q(v) {
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.columns = '*';
    this.wheres = [];       // SQL fragments
    this.inFilters = [];    // { column, values } — kept separate for chunking
    this.orders = [];
    this._limit = null;
  }

  select(columns = '*') {
    if (columns.includes('(')) throw new Error(`shim: embedded/aggregate select not supported: ${columns}`);
    this.columns = columns;
    return this;
  }
  eq(c, v)  { this.wheres.push(`${c} = ${q(v)}`); return this; }
  gte(c, v) { this.wheres.push(`${c} >= ${q(v)}`); return this; }
  lte(c, v) { this.wheres.push(`${c} <= ${q(v)}`); return this; }
  gt(c, v)  { this.wheres.push(`${c} > ${q(v)}`); return this; }
  lt(c, v)  { this.wheres.push(`${c} < ${q(v)}`); return this; }
  neq(c, v) { this.wheres.push(`${c} <> ${q(v)}`); return this; }
  in(c, values) { this.inFilters.push({ column: c, values: [...values] }); return this; }
  is(c, v) {
    if (v === 'null') this.wheres.push(`${c} IS NULL`);
    else if (v === 'true') this.wheres.push(`${c} IS TRUE`);
    else if (v === 'false') this.wheres.push(`${c} IS FALSE`);
    else throw new Error(`shim: is(${v}) unsupported`);
    return this;
  }
  notNull(c) { this.wheres.push(`${c} IS NOT NULL`); return this; }
  order(c, opts) {
    const dir = opts?.ascending === false ? 'DESC' : 'ASC';
    const nulls = opts?.nullsFirst === true ? ' NULLS FIRST' : opts?.nullsFirst === false ? ' NULLS LAST' : '';
    this.orders.push(`${c} ${dir}${nulls}`);
    return this;
  }
  limit(n) { this._limit = n; return this; }

  // Everything else in the real builder is a loud failure here.
  ilike()      { throw new Error('shim: ilike not implemented'); }
  contains()   { throw new Error('shim: contains not implemented'); }
  withCount()  { throw new Error('shim: withCount not implemented'); }
  range()      { throw new Error('shim: range not implemented'); }
  single()     { throw new Error('shim: single not implemented'); }
  maybeSingle(){ throw new Error('shim: maybeSingle not implemented'); }
  insert()     { throw new Error('shim: read-only harness — insert forbidden'); }
  upsert()     { throw new Error('shim: read-only harness — upsert forbidden'); }
  update()     { throw new Error('shim: read-only harness — update forbidden'); }
  delete()     { throw new Error('shim: read-only harness — delete forbidden'); }
  group()      { throw new Error('shim: group() is not a PostgREST capability'); }
  having()     { throw new Error('shim: having() is not a PostgREST capability'); }

  _buildSql(extraIn) {
    const wheres = [...this.wheres];
    for (const f of extraIn) {
      wheres.push(`${f.column} IN (${f.values.map(q).join(',')})`);
    }
    let sql = `SELECT ${this.columns} FROM ${this.table}`;
    if (wheres.length) sql += ` WHERE ${wheres.join(' AND ')}`;
    if (this.orders.length) sql += ` ORDER BY ${this.orders.join(', ')}`;
    if (this._limit != null) sql += ` LIMIT ${this._limit}`;
    return sql;
  }

  async execute() {
    const c = await client();
    let limit = this._limit;
    if (LIFT_SYMBOL_CAP && this.table === 'km_equity_symbols' && limit === 8000) {
      limit = 20000;
      this._limit = limit;
      console.log('  [shim] PARITY_LIFT_SYMBOL_CAP: km_equity_symbols limit 8000 → 20000');
    }
    // Second production data-visibility cap found 2026-08-15: the industry
    // history query needs 20d × ~171 industries ≈ 3,400 rows but is capped at
    // 1,000 — truncating rotation classifications to ~6 recent days. Lifted
    // under the same flag so the cap-lifted run reflects intended semantics.
    if (LIFT_SYMBOL_CAP && this.table === 'km_industry_eod' && limit === 1000) {
      limit = 8000;
      this._limit = limit;
      console.log('  [shim] PARITY_LIFT_SYMBOL_CAP: km_industry_eod limit 1000 → 8000');
    }
    try {
      let data;
      const bigIn = this.inFilters.find((f) => f.values.length > IN_CHUNK);
      if (!bigIn) {
        data = await c.sql(this._buildSql(this.inFilters));
      } else {
        if (this.inFilters.length !== 1) throw new Error('shim: multiple in() with chunking unsupported');
        data = [];
        for (let i = 0; i < bigIn.values.length; i += IN_CHUNK) {
          const part = { column: bigIn.column, values: bigIn.values.slice(i, i + IN_CHUNK) };
          const rows = await c.sql(this._buildSql([part]));
          if (limit != null && rows.length >= limit) {
            throw new Error(`shim: sub-chunk hit LIMIT ${limit} — chunk-split would change semantics, aborting`);
          }
          data.push(...rows);
        }
      }
      if (limit != null && !bigIn && data.length === limit && this.table !== 'km_equity_eod') {
        // A bound LIMIT is fine when the caller expects it (e.g. limit(1)
        // resolvers); flag only the suspicious truncation cases.
        if (limit >= 1000) console.warn(`  [shim] WARNING: ${this.table} returned exactly LIMIT=${limit} rows — possible truncation (production behaves the same way)`);
      }
      return { data, error: null };
    } catch (err) {
      // Match the real client's contract: resolve with {data:null, error}.
      // scanEngine's resolvers rely on that (they check `error`, not throws).
      console.error(`  [shim] query failed on ${this.table}:`, err.message);
      return { data: null, error: { message: err.message, code: 'SHIM_ERROR' } };
    }
  }
}

export function from(table) {
  return new QueryBuilder(table);
}

export async function rpc() {
  throw new Error('shim: rpc not implemented (nothing in scanEngine should call it)');
}

export const db = { from, rpc };
export default db;

/** Direct SQL escape hatch for the harness itself (not used by scanEngine). */
export async function rawSql(query) {
  const c = await client();
  return c.sql(query);
}
