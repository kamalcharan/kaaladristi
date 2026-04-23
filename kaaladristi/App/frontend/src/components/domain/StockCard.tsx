/**
 * Shared Stock Card Components
 * ============================
 * Reusable card components for displaying stock data across
 * Scanner, Industry Transition, and Manipulation Watch.
 */

import { cn } from '@/lib/utils';
import { displaySymbol, displaySubName, navName as toNavName } from '@/lib/symbolUtils';
import { Card } from '@/components/ui';
import { useNavigate } from 'react-router-dom';
import type { ScanStock } from '@/types';
import React from 'react';
import { ZONE_LABELS, FLOW_LABELS } from '@/constants/signalScale';
import { ScanCardWrapper, VaniBadge, CardExchangeBadge } from './ScanCardShell';

export { ZONE_LABELS, FLOW_LABELS };

// ── Exchange Badge (kept for backward compat) ─────────────────

export function ExchangeBadge({ exchange }: { exchange: string | null }) {
  if (!exchange) return null;
  return (
    <span className={cn(
      'text-[8px] font-bold px-1 py-0.5 rounded border',
      exchange === 'NSE'
        ? 'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/5'
        : 'text-risk-amber border-risk-amber/30 bg-risk-amber/5',
    )}>
      {exchange}
    </span>
  );
}

// ── Signal Dots (kept for backward compat) ────────────────────

export function SignalDots({ svd, sbd, syd }: { svd: boolean; sbd: boolean; syd: boolean }) {
  if (!svd && !sbd && !syd) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {svd && (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-risk-green">
          <span className="w-2.5 h-2.5 rounded-full bg-risk-green shrink-0" />
          Volume Drive
        </span>
      )}
      {sbd && (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-accent-cyan">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-cyan shrink-0" />
          Accumulation
        </span>
      )}
      {syd && (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-risk-red">
          <span className="w-2.5 h-2.5 rounded-full bg-risk-red shrink-0" />
          Distribution
        </span>
      )}
    </div>
  );
}

// ── Metric Pill (kept for backward compat) ────────────────────

export function MetricPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-kd-bg/40 rounded-lg px-2 py-1.5 border border-kd-border min-w-[56px]">
      <p className="text-[9px] text-muted uppercase tracking-wider leading-none mb-0.5">{label}</p>
      <p className={cn('text-xs font-bold font-mono leading-none', color ?? 'text-[var(--text-primary)]')}>{value}</p>
    </div>
  );
}

// ── Internal helpers ──────────────────────────────────────────

const FLOW_DISPLAY: Record<string, { label: string; bull: boolean }> = {
  FRESH_LONGS:      { label: 'Fresh Longs',   bull: true },
  SHORT_COVERING:   { label: 'Short Covering', bull: true },
  FRESH_SHORTS:     { label: 'Fresh Shorts',   bull: false },
  LONG_LIQUIDATION: { label: 'Long Liquidation', bull: false },
  LOW_VOLUME:       { label: 'Low Volume',     bull: false },
  MIXED:            { label: 'Mixed',          bull: false },
};

function zoneColor(zone: string | null): string {
  if (zone === 'Strong Bull') return 'var(--bull)';
  if (zone === 'Mild Bull')   return 'rgba(16,185,129,0.7)';
  if (zone === 'Mild Bear')   return 'rgba(239,68,68,0.7)';
  if (zone === 'Strong Bear') return 'var(--bear)';
  return 'var(--text-muted)';
}

function zonePillStyle(zone: string | null): React.CSSProperties {
  const isBull = zone === 'Strong Bull' || zone === 'Mild Bull';
  const isBear = zone === 'Strong Bear' || zone === 'Mild Bear';
  return {
    fontFamily: 'var(--font-mono)',
    fontSize: '10.5px',
    padding: '4px 10px',
    borderRadius: '100px',
    fontWeight: 600,
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap' as const,
    background: isBull ? 'rgba(16,185,129,0.06)' : isBear ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.04)',
    color: zoneColor(zone),
  };
}

function SigPill({ label, bull, bear }: { label: string; bull?: boolean; bear?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 8px',
      fontFamily: 'var(--font-mono)', fontSize: '10.5px',
      borderRadius: '5px', fontWeight: 500,
      background: bull ? 'var(--bull-bg)' : bear ? 'var(--bear-bg)' : 'rgba(255,255,255,0.04)',
      color: bull ? 'var(--bull)' : bear ? 'var(--bear)' : 'var(--text-muted)',
      border: `1px solid ${bull ? 'rgba(16,185,129,0.2)' : bear ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
    }}>
      {label}
    </span>
  );
}

function DotTag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

// Fix 2/3 — Signal tower for sniper scores (0–50 scale)
function SignalTower({ score, label, tooltip }: { score: number; label: string; tooltip: string }) {
  const filled = score > 45 ? 5 : score > 35 ? 4 : score > 25 ? 3 : score > 10 ? 2 : 1;
  const barColor = filled === 5 ? 'var(--gold)'
    : filled >= 3 ? 'var(--bull)'
    : filled === 2 ? 'var(--caution)'
    : 'var(--text-faint)';
  const heights = [3, 5, 7, 9, 11];

  return (
    <span
      title={tooltip}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '3px 8px',
        fontFamily: 'var(--font-mono)', fontSize: '10.5px',
        borderRadius: '5px', fontWeight: 500,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        cursor: 'default',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
        {heights.map((h, i) => (
          <span key={i} style={{
            width: '3px', height: `${h}px`, borderRadius: '1px',
            background: i < filled ? barColor : 'var(--border-strong)',
          }} />
        ))}
      </span>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    </span>
  );
}

// Fix 1 — MRS pill with 5-day direction bars
function MrsPill({
  value, zone, trend,
}: {
  value: number;
  zone: string | null;
  trend: (boolean | null)[];
}) {
  const isBull = zone === 'Strong Bull' || zone === 'Mild Bull';
  const isBear = zone === 'Strong Bear' || zone === 'Mild Bear';

  // Show most-recent on right → reverse so oldest is leftmost
  const bars = [...trend].reverse();

  return (
    <span
      title="Magic RS vs Nifty 500 · 144-period"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '3px 8px',
        fontFamily: 'var(--font-mono)', fontSize: '10.5px',
        borderRadius: '5px', fontWeight: 500,
        background: isBull ? 'var(--bull-bg)' : isBear ? 'var(--bear-bg)' : 'rgba(255,255,255,0.04)',
        color: isBull ? 'var(--bull)' : isBear ? 'var(--bear)' : 'var(--text-muted)',
        border: `1px solid ${isBull ? 'rgba(16,185,129,0.2)' : isBear ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
        cursor: 'default',
      }}
    >
      MRS {value.toFixed(1)}
      <span style={{ display: 'flex', alignItems: 'center', gap: '1.5px', marginLeft: '2px' }}>
        {bars.map((up, i) => (
          <span key={i} style={{
            width: '3px', height: '10px', borderRadius: '1.5px',
            background: up === true ? 'var(--bull)' : up === false ? 'var(--bear)' : 'var(--border-strong)',
            opacity: up == null ? 0.4 : 1,
          }} />
        ))}
      </span>
    </span>
  );
}

// ── Stock Card — 3-zone grid layout ──────────────────────────

export function StockCard({ stock }: { stock: ScanStock }) {
  const navigate = useNavigate();
  const heroName = displaySymbol(stock);
  const subName = displaySubName(stock);
  const flowCfg = FLOW_DISPLAY[stock.flow_type ?? ''];
  const isBullFlow = stock.flow_type === 'FRESH_LONGS' || stock.flow_type === 'SHORT_COVERING';

  const pct = stock.pct_chng ?? 0;
  const isUp = pct >= 0;

  // Fix 5 — EMA20 distance %
  const ema20 = stock.ema_20;
  const ema20Label = ema20 == null ? '—'
    : ema20 >= 1000
      ? ema20.toLocaleString('en-IN', { maximumFractionDigits: 2 })
      : ema20.toFixed(2);

  // Fix 4 — Reward color
  const rp = stock.rewardPct;
  const rewardColor = rp == null ? 'var(--text-faint)'
    : rp >= 0.7 ? 'var(--bull)'
    : rp >= 0.3 ? 'var(--caution)'
    : 'var(--bear)';

  const handleClick = () => navigate(
    `/chart/equity/${stock.equity_id}?name=${encodeURIComponent(toNavName(stock))}`,
  );

  return (
    <ScanCardWrapper isVani={!!stock.vaniOpportunity} symbol={stock.symbol} onClick={handleClick}>
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: '1fr 120px 100px', gap: '18px', alignItems: 'center' }}>
      {/* Zone 1: Identity + Evidence strip */}
      <div style={{ minWidth: 0 }}>
        {/* Symbol + badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
          {stock.vaniOpportunity && (
            <span style={{ color: 'var(--gold)', fontSize: '10px', lineHeight: 1, flexShrink: 0 }}>✦</span>
          )}
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700,
            color: stock.vaniOpportunity ? 'var(--gold)' : 'var(--text-primary)', letterSpacing: '-0.01em',
          }}>
            {heroName}
          </span>
          <CardExchangeBadge exchange={stock.exchange} />
          {flowCfg && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '2px 7px',
              borderRadius: '5px', fontWeight: 500,
              background: isBullFlow ? 'var(--bull-bg)' : 'rgba(255,255,255,0.04)',
              color: isBullFlow ? 'var(--bull)' : 'var(--text-muted)',
              border: `1px solid ${isBullFlow ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
            }}>
              {flowCfg.label}
            </span>
          )}
          {stock.vaniOpportunity && <VaniBadge />}
        </div>

        {/* Company + industry */}
        <div style={{
          fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {subName}
          {subName && stock.industry && <span style={{ color: 'var(--text-faint)', margin: '0 5px' }}>·</span>}
          {stock.industry && <span style={{ color: 'var(--text-faint)' }}>{stock.industry}</span>}
        </div>

        {/* Evidence strip */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>

          {/* Fix 1 — MRS pill with direction bars */}
          {stock.magic_rs != null && (
            <MrsPill
              value={stock.magic_rs}
              zone={stock.magic_rs_zone}
              trend={stock.magicRsTrend ?? []}
            />
          )}

          {/* RSI — badge if >70, pill if 61-70, red pill if <40 */}
          {stock.rsi_14 != null && stock.rsi_14 > 70 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '3px 9px', fontFamily: 'var(--font-mono)', fontSize: '10px',
              borderRadius: '5px', letterSpacing: '0.06em', textTransform: 'uppercase',
              fontWeight: 700, background: 'var(--bull)', color: '#0a1f16', whiteSpace: 'nowrap',
            }}>
              RSI {stock.rsi_14.toFixed(0)}
            </span>
          )}
          {stock.rsi_14 != null && stock.rsi_14 > 60 && stock.rsi_14 <= 70 && (
            <SigPill label={`RSI ${stock.rsi_14.toFixed(0)}`} bull />
          )}
          {stock.rsi_14 != null && stock.rsi_14 < 40 && (
            <SigPill label={`RSI ${stock.rsi_14.toFixed(0)}`} bear />
          )}

          {/* Fix 2 — Smart Money signal tower */}
          {(stock.sniper_inst ?? 0) > 15 && (
            <SignalTower
              score={stock.sniper_inst!}
              label="Institution"
              tooltip={`Smart Money ${stock.sniper_inst!.toFixed(0)}/50 · Institutional RSI`}
            />
          )}

          {/* Fix 3 — Momentum signal tower */}
          {(stock.sniper_hot ?? 0) > 15 && (
            <SignalTower
              score={stock.sniper_hot!}
              label="Momentum"
              tooltip={`Momentum ${stock.sniper_hot!.toFixed(0)}/50 · Hot Money RSI`}
            />
          )}

          {/* Accum / Distrib */}
          {stock.accum_distrib === 'ACCUMULATION' && <SigPill label="Accumulation" bull />}
          {stock.accum_distrib === 'DISTRIBUTION' && <SigPill label="Distribution" bear />}

          {/* RVOL */}
          {stock.rvol != null && (
            <SigPill label={`RVOL ${stock.rvol.toFixed(1)}`} bull={stock.rvol >= 1.5} />
          )}

          {/* Delivery */}
          {(stock.delivery_pct ?? 0) > 60 && (
            <SigPill label={`Delivery ${stock.delivery_pct!.toFixed(0)}%`} bull />
          )}
        </div>

        {/* Signal dots */}
        {(stock.has_recent_svd || stock.has_recent_sbd || stock.has_recent_syd) && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '7px' }}>
            {stock.has_recent_svd && <DotTag label="Volume Drive" color="var(--bull)" />}
            {stock.has_recent_sbd && <DotTag label="Accumulation" color="#06b6d4" />}
            {stock.has_recent_syd && <DotTag label="Distribution" color="var(--bear)" />}
          </div>
        )}
      </div>

      {/* Zone 2: Price + % change + Fix 5 EMA20 dist + Fix 4 Reward+ATR */}
      <div style={{ textAlign: 'right', minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 500,
          color: 'var(--text-primary)', letterSpacing: '-0.01em',
        }}>
          {stock.close >= 1000
            ? stock.close.toLocaleString('en-IN', { maximumFractionDigits: 2 })
            : stock.close.toFixed(2)}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '12px', marginTop: '2px',
          color: isUp ? 'var(--bull)' : 'var(--bear)',
        }}>
          {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{pct.toFixed(2)}%
        </div>

        {/* EMA20 price */}
        <div
          title="20-day EMA price"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', marginTop: '5px', color: 'var(--text-muted)' }}
        >
          EMA20 {ema20Label}
        </div>

        {/* Reward + ATR — single line */}
        <div
          title="Reward = (EMA 20 + ATR 14) − Close · ATR = 14-day Average True Range"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', marginTop: '3px', color: 'var(--text-muted)' }}
        >
          <span style={{ color: rewardColor }}>
            {stock.reward != null ? `₹${stock.reward.toFixed(1)}` : '—'}
          </span>
          {stock.atr_14 != null && (
            <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
              ATR ₹{stock.atr_14.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Zone 3: RS zone pill + 52W% */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
        {stock.magic_rs_zone && (
          <span style={zonePillStyle(stock.magic_rs_zone)}>
            {stock.magic_rs_zone}
          </span>
        )}
        {stock.pctBelow52wHigh != null && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            color: stock.pctBelow52wHigh < 5 ? 'var(--bull)' : 'var(--text-faint)',
          }}>
            {stock.pctBelow52wHigh.toFixed(1)}% off high
          </span>
        )}
      </div>
    </div>
  </ScanCardWrapper>
  );
}
