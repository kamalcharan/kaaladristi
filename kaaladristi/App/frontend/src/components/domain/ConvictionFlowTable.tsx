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

// ── Avatar ────────────────────────────────────────────────────────────────────

// Deterministic hue from symbol so each stock gets a consistent colour
const AVATAR_PALETTES = [
  { bg: '#1e3a5f', fg: '#7eb8f7' },
  { bg: '#1e3d2f', fg: '#6ecf9a' },
  { bg: '#3b2a1a', fg: '#d4a84b' },
  { bg: '#2d1e3e', fg: '#b07ef7' },
  { bg: '#2a1f1f', fg: '#e07070' },
  { bg: '#1a3040', fg: '#5ec8d8' },
];

function avatarPalette(symbol: string, isVani: boolean) {
  if (isVani) return { bg: 'var(--gold)', fg: '#1a1410' };
  const idx = symbol.charCodeAt(0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
}

function Avatar({ symbol, isVani }: { symbol: string; isVani: boolean }) {
  const { bg, fg } = avatarPalette(symbol, isVani);
  const initials = symbol.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: '42px',
      height: '42px',
      borderRadius: '50%',
      background: bg,
      color: fg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      fontWeight: 700,
      letterSpacing: '0.02em',
      flexShrink: 0,
      border: isVani ? '1.5px solid rgba(212,168,75,0.4)' : '1.5px solid rgba(255,255,255,0.06)',
    }}>
      {initials}
    </div>
  );
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

function FlowCard({ stock }: { stock: ScanStock }) {
  const isVani = stock.vaniOpportunity;
  const surge  = stock.delivery_surge_x ?? null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      background: isVani
        ? 'linear-gradient(135deg, rgba(212,168,75,0.06) 0%, var(--card) 55%)'
        : 'var(--card)',
      border: '1px solid var(--border)',
      borderLeft: isVani ? '3px solid var(--gold)' : '3px solid transparent',
      borderRadius: '12px',
      padding: '12px 16px 12px 14px',
      transition: 'border-color 0.15s',
    }}>

      {/* Avatar */}
      <Avatar symbol={stock.symbol} isVani={isVani} />

      {/* Info — 4 rows */}
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
          {stock.exchange && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '8px',
              fontWeight: 600,
              color: 'var(--text-faint)',
              padding: '1px 5px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              flexShrink: 0,
            }}>
              {stock.exchange}
            </span>
          )}
          {isVani && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '1px 8px',
              background: 'var(--gold-bg)',
              border: '1px solid var(--border-gold)',
              borderRadius: '100px',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              color: 'var(--gold)',
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

        {/* Row 2 — Price + Delivery combined */}
        <DataRow items={[
          { label: 'Close',      value: fmt2(stock.close) },
          { label: 'D%',         value: fmtPct(stock.d_pct),        color: pctColor(stock.d_pct, 1.5) },
          { label: 'EMA20',      value: fmt2(stock.ema_20) },
          { label: 'RSI',        value: fmt2(stock.rsi_14),          color: rsiColor(stock.rsi_14) },
          { label: 'RSS',        value: fmt2(stock.rss_value),       color: rssColor(stock.rss_value) },
          { label: '5D Avg',     value: fmtCr(stock.avg_amt_5d) },
          { label: '22D Avg',    value: fmtCr(stock.avg_amt_22d) },
          { label: 'Today Deliv', value: fmtCr(stock.deliv_value_cr) },
        ]} />

        {/* Row 3 — Levels + Returns */}
        <DataRow items={[
          { label: '52w',  value: fmt2(stock.w52_high) },
          { label: 'Dist', value: fmtDistFromHigh(stock.pctBelow52wHigh), color: distColor(stock.pctBelow52wHigh) },
          { label: '5D%',  value: fmtPct(stock.ret_5d),  color: pctColor(stock.ret_5d) },
          { label: '22D%', value: fmtPct(stock.ret_22d), color: pctColor(stock.ret_22d) },
          { label: '66D%', value: fmtPct(stock.ret_66d), color: pctColor(stock.ret_66d) },
        ]} />
      </div>

      {/* Right — surge + date */}
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
          color: surgeColor(surge),
          lineHeight: 1,
        }}>
          {fmtSurge(surge)}
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
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '4px 0 8px',
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
            <span style={{ fontWeight: 400 }}>
              — surge &gt; 2× · near EMA20 · avg 22D &gt; 2 Cr
            </span>
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', marginBottom: '24px' }}>
            {vani.map((s) => <FlowCard key={s.equity_id} stock={s} />)}
          </div>
        </>
      )}

      {rest.length > 0 && (
        <>
          <SectionLabel>
            All Results · {stocks.length} stock{stocks.length !== 1 ? 's' : ''} · sorted by Surge ↓
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
            {rest.map((s) => <FlowCard key={s.equity_id} stock={s} />)}
          </div>
        </>
      )}
    </div>
  );
}
