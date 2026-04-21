import React from 'react';
import type { ScanStock } from '@/types';

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt2(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toFixed(2);
}

function fmtCr(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toFixed(2) + ' Cr';
}

function fmtSurge(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toFixed(2) + '×';
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function fmtDistFromHigh(n: number | null | undefined): string {
  if (n == null) return '—';
  return `-${n.toFixed(1)}%`;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function pctColor(n: number | null | undefined, threshold = 2): string {
  if (n == null) return 'var(--text-secondary)';
  if (n > threshold) return 'var(--bull)';
  if (n < -threshold) return 'var(--bear)';
  return 'var(--text-secondary)';
}

function rsiColor(n: number | null | undefined): string {
  if (n == null) return 'var(--text-secondary)';
  if (n > 70) return 'var(--caution)';
  if (n > 55) return 'var(--bull)';
  if (n < 45) return 'var(--bear)';
  return 'var(--text-secondary)';
}

function rssColor(n: number | null | undefined): string {
  if (n == null) return 'var(--text-secondary)';
  if (n > 70) return 'var(--caution)';
  if (n > 50) return 'var(--bull)';
  if (n < 30) return 'var(--bear)';
  return 'var(--text-secondary)';
}

function surgeColor(n: number | null | undefined): string {
  if (n == null) return 'var(--text-primary)';
  return n >= 2 ? 'var(--gold)' : 'var(--text-primary)';
}

function distColor(n: number | null | undefined): string {
  if (n == null) return 'var(--text-secondary)';
  if (n < 10) return 'var(--bull)';
  if (n < 25) return 'var(--text-secondary)';
  return 'var(--bear)';
}

// ── Inline row ────────────────────────────────────────────────────────────────

interface DataItem {
  label: string;
  value: string;
  color?: string;
}

const DOT: React.CSSProperties = {
  color: 'var(--border-strong)',
  fontSize: '10px',
  padding: '0 7px',
  userSelect: 'none' as const,
  flexShrink: 0,
};

function DataRow({ items }: { items: DataItem[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, rowGap: '4px' }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={DOT}>·</span>}
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px', flexShrink: 0 }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.07em',
              color: 'var(--text-faint)',
            }}>
              {item.label}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 500,
              color: item.color ?? 'var(--text-primary)',
            }}>
              {item.value}
            </span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Individual card ───────────────────────────────────────────────────────────

function FlowCard({ stock }: { stock: ScanStock }) {
  const isVani = stock.vaniOpportunity;
  const surge  = stock.delivery_surge_x ?? null;

  return (
    <div style={{
      background: isVani
        ? 'linear-gradient(135deg, rgba(212,168,75,0.07) 0%, var(--card) 60%)'
        : 'var(--card)',
      border: `1px solid ${isVani ? 'var(--border-gold)' : 'var(--border)'}`,
      borderLeft: isVani ? '3px solid var(--gold)' : '3px solid transparent',
      borderRadius: '12px',
      padding: '11px 16px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '7px',
    }}>

      {/* Row 1 — Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        {/* Left: symbol + badges + company */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' as const, minWidth: 0 }}>
          {isVani && (
            <span style={{ color: 'var(--gold)', fontSize: '10px', lineHeight: 1, flexShrink: 0 }}>✦</span>
          )}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            fontWeight: 700,
            color: isVani ? 'var(--gold)' : 'var(--text-primary)',
            letterSpacing: '-0.01em',
            flexShrink: 0,
          }}>
            {stock.symbol}
          </span>
          {stock.exchange && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '8px',
              color: 'var(--text-faint)',
              padding: '1px 4px',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              flexShrink: 0,
            }}>
              {stock.exchange}
            </span>
          )}
          {isVani && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              padding: '1px 7px',
              background: 'var(--gold-bg)',
              border: '1px solid var(--border-gold)',
              borderRadius: '100px',
              fontFamily: 'var(--font-mono)',
              fontSize: '8px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--gold)',
              textTransform: 'uppercase' as const,
              flexShrink: 0,
            }}>
              VaNi Opportunity
            </span>
          )}
          {stock.company_name && (
            <span style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const,
              minWidth: 0,
            }}>
              {stock.company_name}
            </span>
          )}
        </div>

        {/* Right: date + surge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {stock.trade_date && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-faint)',
            }}>
              {stock.trade_date}
            </span>
          )}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '18px',
            fontWeight: 700,
            color: surgeColor(surge),
            lineHeight: 1,
          }}>
            {fmtSurge(surge)}
          </span>
        </div>
      </div>

      {/* Thin rule */}
      <div style={{ height: '1px', background: 'var(--border)', opacity: 0.6 }} />

      {/* Row 2 — Price · Momentum */}
      <DataRow items={[
        { label: 'Close',  value: fmt2(stock.close) },
        { label: 'D%',     value: fmtPct(stock.d_pct),   color: pctColor(stock.d_pct, 1.5) },
        { label: 'EMA20',  value: fmt2(stock.ema_20) },
        { label: 'RSI',    value: fmt2(stock.rsi_14),     color: rsiColor(stock.rsi_14) },
        { label: 'RSS',    value: fmt2(stock.rss_value),  color: rssColor(stock.rss_value) },
      ]} />

      {/* Row 3 — Delivery */}
      <DataRow items={[
        { label: '5D Avg',     value: fmtCr(stock.avg_amt_5d) },
        { label: '22D Avg',    value: fmtCr(stock.avg_amt_22d) },
        { label: 'Today Deliv', value: fmtCr(stock.deliv_value_cr) },
      ]} />

      {/* Row 4 — 52w · Returns */}
      <DataRow items={[
        { label: '52w',   value: fmt2(stock.w52_high) },
        { label: 'Dist',  value: fmtDistFromHigh(stock.pctBelow52wHigh), color: distColor(stock.pctBelow52wHigh) },
        { label: '5D%',   value: fmtPct(stock.ret_5d),   color: pctColor(stock.ret_5d) },
        { label: '22D%',  value: fmtPct(stock.ret_22d),  color: pctColor(stock.ret_22d) },
        { label: '66D%',  value: fmtPct(stock.ret_66d),  color: pctColor(stock.ret_66d) },
      ]} />
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '6px 0 8px',
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
      color: 'var(--text-faint)',
    }}>
      {children}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ConvictionFlowCards({ stocks }: { stocks: ScanStock[] }) {
  const vani = stocks.filter((s) => s.vaniOpportunity);
  const rest = stocks.filter((s) => !s.vaniOpportunity);

  if (stocks.length === 0) {
    return (
      <div style={{
        padding: '48px 24px', textAlign: 'center',
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: '12px', color: 'var(--text-muted)', fontSize: '14px',
      }}>
        No stocks match Conviction Flow criteria today.
      </div>
    );
  }

  return (
    <div>
      {vani.length > 0 && (
        <>
          <SectionLabel>
            <span style={{ color: 'var(--gold)', marginRight: '6px' }}>✦</span>
            VaNi Opportunity · {vani.length} stock{vani.length !== 1 ? 's' : ''}{' '}
            <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>
              — surge &gt; 2× · price near EMA20 · avg 22D &gt; 2 Cr
            </span>
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
            {vani.map((s) => <FlowCard key={s.equity_id} stock={s} />)}
          </div>
        </>
      )}

      {rest.length > 0 && (
        <>
          <SectionLabel>
            All Results · {stocks.length} stock{stocks.length !== 1 ? 's' : ''} · sorted by Surge ↓
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rest.map((s) => <FlowCard key={s.equity_id} stock={s} />)}
          </div>
        </>
      )}
    </div>
  );
}
