import React from 'react';
import type { ScanStock } from '@/types';
import { ScanCardWrapper, VaniBadge, ScanSectionLabel, CardExchangeBadge } from './ScanCardShell';

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt2(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toFixed(2);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function fmtRvol(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toFixed(1) + '×';
}

function fmtBrkPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `+${n.toFixed(2)}%`;
}

// ── Colors ────────────────────────────────────────────────────────────────────

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

function rvolColor(n: number | null | undefined): string {
  if (n == null) return 'var(--text-primary)';
  if (n >= 5) return 'var(--gold)';
  if (n >= 3) return 'var(--bull)';
  return 'var(--text-primary)';
}

function brkPctColor(n: number | null | undefined): string {
  if (n == null) return 'var(--text-secondary)';
  if (n <= 3) return 'var(--bull)';
  if (n <= 8) return 'var(--text-secondary)';
  return 'var(--caution)';
}

// ── Inline data row ───────────────────────────────────────────────────────────

interface DataItem {
  label: string;
  value: string;
  color?: string;
}

function DataRow({ items }: { items: DataItem[] }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '3px' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.06em',
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
      ))}
    </div>
  );
}

// ── Individual card ───────────────────────────────────────────────────────────

function BurstCard({ stock }: { stock: ScanStock }) {
  const isVani = stock.vaniOpportunity;
  const rvol = stock.rvol ?? null;

  return (
    <ScanCardWrapper isVani={isVani} symbol={stock.symbol}>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: '5px' }}>

        {/* Row 1 — Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' as const }}>
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
          <CardExchangeBadge exchange={stock.exchange} />
          {isVani && <VaniBadge />}
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

        {/* Row 2 — Price + indicators */}
        <DataRow items={[
          { label: 'Close',  value: fmt2(stock.close) },
          { label: 'D%',     value: fmtPct(stock.d_pct),     color: pctColor(stock.d_pct, 1.5) },
          { label: 'EMA20',  value: fmt2(stock.ema_20) },
          { label: 'RSI',    value: fmt2(stock.rsi_14),       color: rsiColor(stock.rsi_14) },
        ]} />

        {/* Row 3 — Breakout levels + returns */}
        <DataRow items={[
          { label: 'Brk Lvl',   value: fmt2(stock.breakout_level) },
          { label: 'Brk%',      value: fmtBrkPct(stock.pct_from_breakout), color: brkPctColor(stock.pct_from_breakout) },
          { label: '5D%',       value: fmtPct(stock.ret_5d),               color: pctColor(stock.ret_5d) },
          { label: '22D%',      value: fmtPct(stock.ret_22d),              color: pctColor(stock.ret_22d) },
        ]} />
      </div>

      {/* Right — RVOL hero + date */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'flex-end',
        gap: '4px',
        paddingLeft: '8px',
        borderLeft: '1px solid var(--border)',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '20px',
          fontWeight: 700,
          color: rvolColor(rvol),
          lineHeight: 1,
        }}>
          {fmtRvol(rvol)}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '8px',
          color: 'var(--text-faint)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.06em',
        }}>
          RVOL
        </span>
        {stock.trade_date && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            color: 'var(--text-faint)',
          }}>
            {stock.trade_date}
          </span>
        )}
      </div>
    </ScanCardWrapper>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function BreakoutSurgeCards({ stocks }: { stocks: ScanStock[] }) {
  const vani = stocks.filter((s) => s.vaniOpportunity);
  const rest = stocks.filter((s) => !s.vaniOpportunity);

  if (stocks.length === 0) {
    return (
      <div style={{
        padding: '48px 24px', textAlign: 'center',
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: '12px', color: 'var(--text-muted)', fontSize: '14px',
      }}>
        No stocks match Breakout Surge criteria today.
      </div>
    );
  }

  return (
    <div>
      {vani.length > 0 && (
        <>
          <ScanSectionLabel>
            <span style={{ color: 'var(--gold)', marginRight: '6px' }}>✦</span>
            VaNi Opportunity · {vani.length} stock{vani.length !== 1 ? 's' : ''}{' '}
            <span style={{ fontWeight: 400 }}>
              — RVOL &gt; 5× · breakout within 5% · RSI &lt; 75
            </span>
          </ScanSectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', marginBottom: '24px' }}>
            {vani.map((s) => <BurstCard key={s.equity_id} stock={s} />)}
          </div>
        </>
      )}

      {rest.length > 0 && (
        <>
          <ScanSectionLabel>
            All Results · {stocks.length} stock{stocks.length !== 1 ? 's' : ''} · sorted by RVOL ↓
          </ScanSectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
            {rest.map((s) => <BurstCard key={s.equity_id} stock={s} />)}
          </div>
        </>
      )}
    </div>
  );
}
