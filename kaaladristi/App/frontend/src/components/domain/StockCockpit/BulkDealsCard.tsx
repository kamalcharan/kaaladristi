/**
 * BulkDealsCard — Study cockpit rail, directly under Big Money Days.
 *
 * The two cards answer different questions and sit together on purpose:
 *   Big Money  — "an unusual amount of stock changed hands" (anonymous,
 *                delivery-based, every stock, every bar)
 *   Bulk deals — "WHO crossed a disclosure line" (named counterparty, only
 *                above a regulatory threshold)
 *
 * A named institutional purchase can be completely invisible to Big Money —
 * see the ENTERO note in services/bulkDeals.ts — which is exactly why this is
 * its own card and not a badge on the other one.
 *
 * ⚠ THE COVERAGE LINE IS LOAD-BEARING, NOT DECORATION. Collection is forward-
 * only from the first ingest; there is no history. Most stocks therefore show
 * nothing, and "nothing" here does not mean a quiet stock — it usually means
 * we were not collecting. This card never renders a bare absence: it either
 * says the window was not covered, or states how many sessions it DID look at.
 */

import { Users } from 'lucide-react';
import type { BulkDeal, BulkDealsResult } from '@/services/bulkDeals';

// Pure tokens, no literal fallbacks: --bull-bg / --bear-bg are defined for
// every theme in config/theme/index.ts, and the literal ratchet in
// `npm run build` rejects new hex/rgba anywhere in src/.
const SIDE = {
  BUY:  { label: 'BOUGHT', color: 'var(--bull)', bg: 'var(--bull-bg)' },
  SELL: { label: 'SOLD',   color: 'var(--bear)', bg: 'var(--bear-bg)' },
} as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return `${String(dt.getDate()).padStart(2, '0')} ${MONTHS[dt.getMonth()]} ${String(dt.getFullYear()).slice(2)}`;
}

function fmtCr(v: number): string {
  return v >= 100 ? v.toFixed(0) : v.toFixed(1);
}

function fmtQty(q: number): string {
  if (q >= 1e7) return `${(q / 1e7).toFixed(2)} Cr`;
  if (q >= 1e5) return `${(q / 1e5).toFixed(2)} L`;
  return q.toLocaleString('en-IN');
}

function Shell({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="rounded-lg bg-kd-card border border-kd-border p-3">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-3.5 h-3.5" style={{ color: 'var(--accent-indigo)' }} />
        <span className="text-[11px] font-serif font-semibold text-primary tracking-wide">
          Bulk &amp; Block Deals
        </span>
        {count != null && <span className="ml-auto text-[9px] font-mono text-muted">{count}</span>}
      </div>
      {children}
    </div>
  );
}

/** Never a bare "none" — always says what was actually looked at. */
function coverageSentence(cov: BulkDealsResult['coverage'], hasDeals: boolean): string {
  const since = cov.collectionStart
    ? `Collection began ${fmtDay(cov.collectionStart)}`
    : 'Collection has not started';

  if (cov.windowUncovered) {
    return `${since} — none of the sessions in this window were fetched, so no deal could appear here. ` +
      `This is an evidence gap, not a quiet stock.`;
  }
  if (hasDeals) {
    return `${since}. ${cov.sessionsCovered} session${cov.sessionsCovered === 1 ? '' : 's'} in this window covered.`;
  }
  return `No disclosed deal on the ${cov.sessionsCovered} session${cov.sessionsCovered === 1 ? '' : 's'} ` +
    `of this window that were fetched. ${since}; earlier sessions were never looked at.`;
}

function DealRow({ d }: { d: BulkDeal }) {
  const side = SIDE[d.side];
  return (
    <div className="rounded-md bg-kd-elevated border border-kd-border px-2.5 py-1.5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[10px] font-mono text-[var(--text-secondary)]">{fmtDay(d.dealDate)}</span>
        <span
          className="text-[8.5px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ color: side.color, background: side.bg }}
        >
          {side.label}
        </span>
        <span className="text-[11px] font-mono font-bold" style={{ color: side.color }}>
          ₹{fmtCr(d.valueCr)} Cr
        </span>
        {d.pctOfEquity != null && (
          <span className="text-[9.5px] font-mono text-muted">{d.pctOfEquity.toFixed(2)}% of equity</span>
        )}
        <span className="ml-auto text-[9px] font-mono text-muted">
          {d.feeds.join(' + ')}
        </span>
      </div>

      {/* The name is the reason this card exists — give it the emphasis. */}
      <div className="text-[10px] text-primary font-medium leading-snug mt-0.5 break-words">
        {d.clientName}
      </div>

      <div className="text-[9px] text-muted mt-0.5 font-mono">
        {fmtQty(d.quantity)} @ ₹{d.price.toFixed(2)}
        {d.day0 && d.day0 !== d.dealDate && <> · actionable {fmtDay(d.day0)}</>}
      </div>
    </div>
  );
}

export default function BulkDealsCard({ result }: { result: BulkDealsResult | undefined }) {
  // Loading and error both land here. Neither may read as "no deals".
  if (!result) {
    return (
      <Shell>
        <p className="text-[9px] text-muted leading-snug">Loading disclosed deals…</p>
      </Shell>
    );
  }

  const { deals, coverage } = result;

  if (deals.length === 0) {
    return (
      <Shell>
        <p className="text-[9px] text-muted leading-snug">
          {coverageSentence(coverage, false)}
        </p>
      </Shell>
    );
  }

  const shown = deals.slice(0, 6);

  return (
    <Shell count={deals.length}>
      <p className="text-[9px] text-muted leading-snug mb-2.5">
        Trades disclosed by name because they crossed a regulatory line — over 0.5% of listed
        equity in a session, or a block-window trade. Unlike Big Money days, the counterparty and
        the side are stated facts, not inferred. A block trade may leave no delivery footprint at
        all, so these can appear with no Big Money day beside them.
      </p>

      <div className="flex flex-col gap-2">
        {shown.map((d, i) => (
          <DealRow key={`${d.dealDate}-${d.clientName}-${d.side}-${d.quantity}-${i}`} d={d} />
        ))}
      </div>

      {deals.length > shown.length && (
        <div className="text-[9px] text-muted mt-1.5">
          +{deals.length - shown.length} more in this window
        </div>
      )}

      <div className="text-[8.5px] text-muted mt-2 leading-snug opacity-80">
        {coverageSentence(coverage, true)}
      </div>
    </Shell>
  );
}
