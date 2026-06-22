import React from 'react';
import type { ScanStock } from '@/types';
import { ScanCardWrapper, VaniBadge, ScanSectionLabel, CardExchangeBadge } from './ScanCardShell';
import { displaySymbol } from '@/lib/symbolUtils';
import { getColor, getLabel } from '@/config/fieldConfig';

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

function distColor(n: number | null | undefined): string {
  if (n == null) return 'var(--text-secondary)';
  if (n < 10) return 'var(--bull)';
  if (n < 25) return 'var(--text-secondary)';
  return 'var(--bear)';
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
    <ScanCardWrapper isVani={isVani} symbol={stock.symbol}>
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
            {displaySymbol(stock)}
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

        {/* Row 2 — Price + Delivery combined */}
        <DataRow items={[
          { label: 'Close',      value: fmt2(stock.close) },
          { label: 'D%',         value: fmtPct(stock.d_pct),        color: pctColor(stock.d_pct, 1.5) },
          { label: 'EMA20',      value: fmt2(stock.ema_20) },
          { label: 'RSI',        value: fmt2(stock.rsi_14),          color: getColor('rsi_14', stock.rsi_14) },
          { label: 'RSS',        value: fmt2(stock.rss_value),       color: getColor('rss_value', stock.rss_value) },
          { label: getLabel('avg_amt_5d'),  value: fmtCr(stock.avg_amt_5d) },
          { label: getLabel('avg_amt_22d'), value: fmtCr(stock.avg_amt_22d) },
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
          color: getColor('delivery_surge_x', surge),
          lineHeight: 1,
        }}>
          {fmtSurge(surge)}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}>
          Delivery Surge
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
          <ScanSectionLabel>
            <span style={{ color: 'var(--gold)', marginRight: '6px' }}>✦</span>
            VaNi Opportunity · {vani.length} stock{vani.length !== 1 ? 's' : ''}{' '}
            <span style={{ fontWeight: 400 }}>
              — surge &gt; 2× · near EMA20 · avg 22D &gt; 2 Cr
            </span>
          </ScanSectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', marginBottom: '24px' }}>
            {vani.map((s) => <FlowCard key={s.equity_id} stock={s} />)}
          </div>
        </>
      )}

      {rest.length > 0 && (
        <>
          <ScanSectionLabel>
            All Results · {stocks.length} stock{stocks.length !== 1 ? 's' : ''} · sorted by Surge ↓
          </ScanSectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
            {rest.map((s) => <FlowCard key={s.equity_id} stock={s} />)}
          </div>
        </>
      )}
    </div>
  );
}
