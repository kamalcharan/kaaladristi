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

// ── Vocabulary mapping (kept for backward compat with IndustryTransitionView, ManipulationWatchView) ──

export const ZONE_LABELS: Record<string, { label: string; color: string }> = {
  'Strong Bull': { label: 'Strong Bull', color: 'text-risk-green' },
  'Mild Bull':   { label: 'Mild Bull',   color: 'text-risk-green/70' },
  'Neutral':     { label: 'Neutral',     color: 'text-muted' },
  'Mild Bear':   { label: 'Mild Bear',   color: 'text-risk-red/70' },
  'Strong Bear': { label: 'Strong Bear', color: 'text-risk-red' },
};

export const FLOW_LABELS: Record<string, { label: string; color: string }> = {
  FRESH_LONGS:      { label: 'Fresh Longs',      color: 'text-risk-green' },
  FRESH_SHORTS:     { label: 'Fresh Shorts',     color: 'text-risk-red' },
  SHORT_COVERING:   { label: 'Short Covering',   color: 'text-risk-amber' },
  LONG_LIQUIDATION: { label: 'Liquidation',      color: 'text-risk-red/80' },
  LOW_VOLUME:       { label: 'Low Volume',        color: 'text-muted' },
  MIXED:            { label: 'Mixed',             color: 'text-muted' },
};

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

// ── Internal helpers for new StockCard ───────────────────────

const FLOW_DISPLAY: Record<string, { label: string; bull: boolean }> = {
  FRESH_LONGS:      { label: 'Fresh Longs',   bull: true },
  SHORT_COVERING:   { label: 'Short Covering', bull: true },
  FRESH_SHORTS:     { label: 'Fresh Shorts',   bull: false },
  LONG_LIQUIDATION: { label: 'Liquidation',    bull: false },
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

function SigPill({
  label, bull, bear,
}: {
  label: string;
  bull?: boolean;
  bear?: boolean;
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 8px',
      fontFamily: 'var(--font-mono)',
      fontSize: '10.5px',
      borderRadius: '5px',
      fontWeight: 500,
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

// ── Stock Card — 3-zone grid layout ──────────────────────────

import React from 'react';

export function StockCard({ stock }: { stock: ScanStock }) {
  const navigate = useNavigate();
  const heroName = displaySymbol(stock);
  const subName = displaySubName(stock);
  const flowCfg = FLOW_DISPLAY[stock.flow_type ?? ''];
  const isBullFlow = stock.flow_type === 'FRESH_LONGS' || stock.flow_type === 'SHORT_COVERING';

  const pct = stock.pct_chng ?? 0;
  const isUp = pct >= 0;

  const rp = stock.rewardPct;
  const rewardColor = rp == null
    ? 'var(--text-faint)'
    : rp >= 0.7 ? 'var(--bull)'
    : rp >= 0.3 ? 'var(--caution)'
    : 'var(--bear)';

  const handleClick = () => navigate(
    `/chart/equity/${stock.equity_id}?name=${encodeURIComponent(toNavName(stock))}`,
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      style={{
        background: 'var(--card)',
        border: `1px solid ${stock.vaniOpportunity ? 'rgba(212,168,75,0.25)' : 'var(--border)'}`,
        borderRadius: '12px',
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '1fr 120px 100px',
        gap: '18px',
        alignItems: 'center',
        boxShadow: stock.vaniOpportunity
          ? '0 0 0 1px rgba(212,168,75,0.2), 0 8px 20px rgba(0,0,0,0.15)'
          : undefined,
        transition: 'all 0.18s',
      }}
    >
      {/* Zone 1: Identity + Evidence strip */}
      <div style={{ minWidth: 0 }}>
        {/* Symbol + badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '15px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}>
            {heroName}
          </span>
          {stock.exchange && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '9px', padding: '2px 5px',
              borderRadius: '4px', letterSpacing: '0.1em', fontWeight: 600,
              background: stock.exchange === 'NSE' ? 'rgba(6,182,212,0.12)' : 'rgba(251,191,36,0.12)',
              color: stock.exchange === 'NSE' ? '#06b6d4' : '#fbbf24',
              border: `1px solid ${stock.exchange === 'NSE' ? 'rgba(6,182,212,0.25)' : 'rgba(251,191,36,0.25)'}`,
            }}>
              {stock.exchange}
            </span>
          )}
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
          {stock.vaniOpportunity && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px',
              fontFamily: 'var(--font-mono)', fontSize: '9.5px',
              borderRadius: '5px', letterSpacing: '0.06em',
              textTransform: 'uppercase', fontWeight: 700,
              background: 'var(--gold)', color: '#1a1410', whiteSpace: 'nowrap',
            }}>
              ✦ Opportunity
            </span>
          )}
        </div>

        {/* Company + industry */}
        <div style={{
          fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {subName}
          {subName && stock.industry && (
            <span style={{ color: 'var(--text-faint)', margin: '0 5px' }}>·</span>
          )}
          {stock.industry && (
            <span style={{ color: 'var(--text-faint)' }}>{stock.industry}</span>
          )}
        </div>

        {/* Evidence strip — selective signals */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
          {stock.magic_rs != null && (
            <SigPill
              label={`RS ${stock.magic_rs.toFixed(1)}`}
              bull={stock.magic_rs_zone === 'Strong Bull' || stock.magic_rs_zone === 'Mild Bull'}
              bear={stock.magic_rs_zone === 'Strong Bear' || stock.magic_rs_zone === 'Mild Bear'}
            />
          )}
          {stock.rsi_14 != null && (stock.rsi_14 > 60 || stock.rsi_14 < 40) && (
            <SigPill label={`RSI ${stock.rsi_14.toFixed(0)}`} bull={stock.rsi_14 > 60} bear={stock.rsi_14 < 40} />
          )}
          {(stock.sniper_inst ?? 0) > 15 && (
            <SigPill label={`Smart Money +${stock.sniper_inst!.toFixed(0)}`} />
          )}
          {stock.accum_distrib === 'ACCUMULATION' && (
            <SigPill label="Accumulation" bull />
          )}
          {stock.accum_distrib === 'DISTRIBUTION' && (
            <SigPill label="Distribution" bear />
          )}
          {stock.rvol != null && (
            <SigPill label={`RVOL ${stock.rvol.toFixed(1)}`} bull={stock.rvol >= 1.5} />
          )}
          {(stock.delivery_pct ?? 0) > 60 && (
            <SigPill label={`Delivery ${stock.delivery_pct!.toFixed(0)}%`} bull />
          )}
        </div>

        {/* Signal dots — only if any present */}
        {(stock.has_recent_svd || stock.has_recent_sbd || stock.has_recent_syd) && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '7px' }}>
            {stock.has_recent_svd && <DotTag label="Volume Drive" color="var(--bull)" />}
            {stock.has_recent_sbd && <DotTag label="Accumulation" color="#06b6d4" />}
            {stock.has_recent_syd && <DotTag label="Distribution" color="var(--bear)" />}
          </div>
        )}
      </div>

      {/* Zone 2: Price + % change + Reward */}
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
        {stock.reward != null && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', marginTop: '5px',
            color: rewardColor,
          }}>
            ₹{Math.abs(stock.reward).toFixed(1)} {stock.reward >= 0 ? 'reward' : 'risk'}
          </div>
        )}
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
  );
}
