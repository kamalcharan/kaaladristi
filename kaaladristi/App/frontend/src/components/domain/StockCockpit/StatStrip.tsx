/**
 * StatStrip — Study cockpit header cards (POA Phase 1.1).
 * Four evidence cards: Price + day range · Momentum · Liquidity · Returns.
 * All values come from the latest chart row + symbol meta — no extra fetches.
 * Index instruments hide the delivery lines (no delivery data on indices).
 */

import { cn } from '@/lib/utils';

const num = (v: number | null | undefined, dec = 2) =>
  v == null ? '—' : v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const pct = (v: number | null | undefined) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

const pctColor = (v: number | null | undefined) =>
  v == null ? 'text-muted' : v >= 0 ? 'text-risk-green' : 'text-risk-red';

/** % distance of close from a moving average. */
function distFrom(close: number | null | undefined, ma: number | null | undefined): number | null {
  if (close == null || ma == null || ma <= 0) return null;
  return ((close - ma) / ma) * 100;
}

interface LatestRow {
  score_5d?: number | null; score_22d?: number | null; delivery_surge_x?: number | null;
  close?: number | null; pct_chng?: number | null;
  high?: number | null; low?: number | null;
  rsi_14?: number | null;
  ema_20?: number | null; sma_50?: number | null; sma_150?: number | null;
  volume?: number | null; delivery_qty?: number | null; delivery_pct?: number | null;
  ret_5d?: number | null; ret_22d?: number | null; ret_66d?: number | null;
  value_cr?: number | null;
}

function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-xl px-4 py-3 min-w-0">
      <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px] leading-relaxed">
      <span className="text-muted">{label}</span>
      <span className={cn('font-mono font-semibold', valueClass ?? 'text-[var(--text-secondary)]')}>{value}</span>
    </div>
  );
}

export default function StatStrip({
  latest, mcapCr, isEquity,
}: {
  latest: LatestRow | null;
  mcapCr?: number | null;
  isEquity: boolean;
}) {
  if (!latest) return null;

  const close = latest.close ?? null;
  const dayLow = latest.low ?? null;
  const dayHigh = latest.high ?? null;
  const rangePos =
    close != null && dayLow != null && dayHigh != null && dayHigh > dayLow
      ? Math.min(100, Math.max(0, ((close - dayLow) / (dayHigh - dayLow)) * 100))
      : null;

  const rsi = latest.rsi_14 ?? null;
  const rsiTone = rsi == null ? null : rsi >= 60 ? 'Elevated' : rsi <= 40 ? 'Subdued' : 'Neutral';
  const rsiToneClass =
    rsi == null ? '' : rsi >= 60 ? 'text-risk-green bg-risk-green/10' : rsi <= 40 ? 'text-risk-red bg-risk-red/10' : 'text-risk-amber bg-risk-amber/10';

  // Conviction (Score 5D/22D + Deliv Surge) moved to the rail Conviction
  // SignalFlipCard so it isn't rendered twice; header strip is now 4 cards.
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
      {/* ── Current price + day range ── */}
      <CardShell title="Current Price">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-lg font-mono font-bold text-[var(--text-primary)]">
            {isEquity ? '₹' : ''}{num(close)}
          </span>
          <span className={cn('text-xs font-mono font-semibold', pctColor(latest.pct_chng))}>
            {pct(latest.pct_chng)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-muted mb-1">
          <span>{num(dayLow, 0)}</span>
          <span className="text-[9px] uppercase tracking-wider">Day Range</span>
          <span>{num(dayHigh, 0)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-kd-elevated overflow-hidden">
          {rangePos != null && (
            <div className="h-full rounded-full bg-risk-green" style={{ width: `${rangePos}%` }} />
          )}
        </div>
      </CardShell>

      {/* ── Momentum ── */}
      <CardShell title="Momentum">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-lg font-mono font-bold text-[var(--text-primary)]">
            {rsi != null ? rsi.toFixed(0) : '—'}
          </span>
          <span className="text-[10px] text-muted">RSI (14)</span>
          {rsiTone && (
            <span className={cn('ml-auto text-[9px] font-mono font-bold px-1.5 py-0.5 rounded', rsiToneClass)}>
              {rsiTone}
            </span>
          )}
        </div>
        <Row label="20-DMA" value={pct(distFrom(close, latest.ema_20))} valueClass={pctColor(distFrom(close, latest.ema_20))} />
        <Row label="50-DMA" value={pct(distFrom(close, latest.sma_50))} valueClass={pctColor(distFrom(close, latest.sma_50))} />
        <Row label="150-DMA" value={pct(distFrom(close, latest.sma_150))} valueClass={pctColor(distFrom(close, latest.sma_150))} />
      </CardShell>

      {/* ── Liquidity ── */}
      <CardShell title="Liquidity">
        <Row label="Volume" value={latest.volume != null ? latest.volume.toLocaleString('en-IN') : '—'} />
        {isEquity ? (
          <>
            <Row label="Delivery" value={latest.delivery_qty != null ? latest.delivery_qty.toLocaleString('en-IN') : '—'} />
            <Row label="Delivery %" value={latest.delivery_pct != null ? `${latest.delivery_pct.toFixed(1)}%` : '—'} />
            <Row label="Market Cap" value={mcapCr != null ? `₹${num(mcapCr)} Cr` : '—'} />
          </>
        ) : (
          <Row label="Traded Value" value={latest.value_cr != null ? `₹${num(latest.value_cr, 1)} Cr` : '—'} />
        )}
      </CardShell>

      {/* ── Returns ── */}
      <CardShell title="Returns">
        <Row label="5 Days" value={pct(latest.ret_5d)} valueClass={pctColor(latest.ret_5d)} />
        <Row label="22 Days" value={pct(latest.ret_22d)} valueClass={pctColor(latest.ret_22d)} />
        <Row label="66 Days" value={pct(latest.ret_66d)} valueClass={pctColor(latest.ret_66d)} />
      </CardShell>
    </div>
  );
}
