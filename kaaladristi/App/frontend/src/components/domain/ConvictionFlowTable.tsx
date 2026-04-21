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

// ── Field cell ────────────────────────────────────────────────────────────────

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.07em',
        color: 'var(--text-faint)',
        whiteSpace: 'nowrap' as const,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        fontWeight: 500,
        color: color ?? 'var(--text-primary)',
        lineHeight: 1,
        whiteSpace: 'nowrap' as const,
      }}>
        {value}
      </span>
    </div>
  );
}

function HR() {
  return <div style={{ height: '1px', background: 'var(--border)', margin: '12px 0' }} />;
}

// ── Individual card ───────────────────────────────────────────────────────────

function FlowCard({ stock }: { stock: ScanStock }) {
  const isVani = stock.vaniOpportunity;
  const surge  = stock.delivery_surge_x ?? null;
  const dist52 = stock.pctBelow52wHigh;

  return (
    <div style={{
      background: isVani
        ? 'linear-gradient(150deg, rgba(212,168,75,0.08) 0%, var(--card) 65%)'
        : 'var(--card)',
      border: `1px solid ${isVani ? 'var(--border-gold)' : 'var(--border)'}`,
      borderRadius: '16px',
      padding: '18px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Gold top bar */}
      {isVani && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, var(--gold) 0%, transparent 100%)',
        }} />
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const }}>
          {isVani && (
            <span style={{ color: 'var(--gold)', fontSize: '11px', lineHeight: 1 }}>✦</span>
          )}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '16px',
            fontWeight: 700,
            color: isVani ? 'var(--gold)' : 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}>
            {stock.symbol}
          </span>
          {stock.exchange && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              color: 'var(--text-faint)',
              padding: '2px 5px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
            }}>
              {stock.exchange}
            </span>
          )}
          {isVani && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '2px 9px',
              background: 'var(--gold-bg)',
              border: '1px solid var(--border-gold)',
              borderRadius: '100px',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--gold)',
              textTransform: 'uppercase' as const,
            }}>
              VaNi Opportunity
            </span>
          )}
        </div>

        {stock.trade_date && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--text-faint)',
            flexShrink: 0,
            paddingTop: '2px',
          }}>
            {stock.trade_date}
          </span>
        )}
      </div>

      {stock.company_name && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.3 }}>
          {stock.company_name}
        </div>
      )}

      <HR />

      {/* ── Row 1: Price · Momentum ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '2px' }}>
        <Field label="Close"  value={fmt2(stock.close)} />
        <Field label="D%"     value={fmtPct(stock.d_pct)}   color={pctColor(stock.d_pct, 1.5)} />
        <Field label="20 EMA" value={fmt2(stock.ema_20)} />
        <Field label="RSI"    value={fmt2(stock.rsi_14)}     color={rsiColor(stock.rsi_14)} />
        <Field label="RSS"    value={fmt2(stock.rss_value)}  color={rssColor(stock.rss_value)} />
      </div>

      <HR />

      {/* ── Row 2: Delivery ────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr auto',
        gap: '16px',
        alignItems: 'flex-end',
        marginBottom: '2px',
      }}>
        <Field label="5D Avg Amt"     value={fmtCr(stock.avg_amt_5d)} />
        <Field label="22D Avg Amt"    value={fmtCr(stock.avg_amt_22d)} />
        <Field label="Today Delivery" value={fmtCr(stock.deliv_value_cr)} />

        {/* Delivery Surge hero */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.07em',
            color: 'var(--text-faint)',
          }}>
            Delivery Surge
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '24px',
            fontWeight: 700,
            color: surgeColor(surge),
            lineHeight: 1,
          }}>
            {fmtSurge(surge)}
          </span>
        </div>
      </div>

      <HR />

      {/* ── Row 3: 52w Levels · Returns ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        <Field label="52w High"  value={fmt2(stock.w52_high)} />
        <Field label="Dist 52w%" value={fmtDistFromHigh(dist52)}   color={distColor(dist52)} />
        <Field label="5D%"       value={fmtPct(stock.ret_5d)}      color={pctColor(stock.ret_5d)} />
        <Field label="22D%"      value={fmtPct(stock.ret_22d)}     color={pctColor(stock.ret_22d)} />
        <Field label="66D%"      value={fmtPct(stock.ret_66d)}     color={pctColor(stock.ret_66d)} />
      </div>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '6px 0 10px',
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
        borderRadius: '16px', color: 'var(--text-muted)', fontSize: '14px',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
            {vani.map((s) => <FlowCard key={s.equity_id} stock={s} />)}
          </div>
        </>
      )}

      {rest.length > 0 && (
        <>
          <SectionLabel>
            All Results · {stocks.length} stock{stocks.length !== 1 ? 's' : ''} · sorted by Surge ↓
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rest.map((s) => <FlowCard key={s.equity_id} stock={s} />)}
          </div>
        </>
      )}
    </div>
  );
}
