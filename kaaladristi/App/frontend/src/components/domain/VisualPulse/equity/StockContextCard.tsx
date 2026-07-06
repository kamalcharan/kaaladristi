/**
 * StockContextCard — merged Scan Presence + Industry Context
 * ===========================================================
 * The two cards both answer "where does this stock sit right now?" —
 * merged into one compact card so the equity Pulse sidebar fits without
 * scrolling (VP layout pass, 2026-07-06). The standalone ScanPresenceCard
 * stays untouched for the Study cockpit rail.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, TrendingUp, TrendingDown, Crown, Minus } from 'lucide-react';
import type { ScanStock } from '@/types';
import type { IndustryContext } from '@/hooks/useEquityVisualPulse';

const CATEGORY_CONFIG = {
  rotating_in:  { label: 'Rotating In',  icon: TrendingUp,   color: 'text-risk-green', bg: 'bg-risk-green/10' },
  leading:      { label: 'Leading',      icon: Crown,        color: 'text-accent-gold', bg: 'bg-accent-gold/10' },
  rotating_out: { label: 'Rotating Out', icon: TrendingDown, color: 'text-risk-red',   bg: 'bg-risk-red/10' },
  stable:       { label: 'Stable',       icon: Minus,        color: 'text-muted',      bg: 'bg-kd-elevated' },
} as const;

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

interface StockContextCardProps {
  stock: ScanStock | null;
  matchedScans: { id: string; name: string; vani?: boolean }[];
  industry: string | null;
  context: IndustryContext | null;
}

export default function StockContextCard({ stock, matchedScans, industry, context }: StockContextCardProps) {
  const hasIndustry = !!(industry && context);
  const hasScans = !!stock;
  if (!hasIndustry && !hasScans) return null;

  const config = hasIndustry ? CATEGORY_CONFIG[context!.category] : null;
  const Icon = config?.icon;

  return (
    <div className="rounded-lg bg-kd-card border border-kd-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <Compass className="w-3.5 h-3.5 text-accent-indigo" />
        <span className="text-[11px] font-serif font-semibold text-primary tracking-wide">
          Context
        </span>
      </div>

      {/* Industry rotation */}
      {hasIndustry && config && Icon && (
        <div className="space-y-1.5">
          <Link
            to={`/industry-transition?expand=${encodeURIComponent(industry!)}`}
            className="text-xs font-serif text-primary hover:text-accent-indigo transition-colors"
          >
            {industry}
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono ${config.color} ${config.bg}`}>
              <Icon className="w-3 h-3" />
              {config.label}
            </span>
            <span className="text-[10px] font-mono text-secondary">
              {context!.percentile}%ile
              {context!.prevPercentile != null && `, was ${context!.prevPercentile}%ile`}
            </span>
          </div>
          {context!.stockRank != null && context!.industryStockCount > 0 && (
            <div className="text-[10px] font-mono text-muted">
              {context!.stockRank}{ordinal(context!.stockRank)} of {context!.industryStockCount} in industry by RS
            </div>
          )}
        </div>
      )}

      {/* Scan presence */}
      {hasScans && (
        <div className={hasIndustry ? 'mt-2.5 pt-2.5 border-t border-kd-border' : ''}>
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted mb-1.5">
            In scans today
          </div>
          {matchedScans.length > 0 ? (
            <div className="flex flex-col gap-1">
              {matchedScans.map((scan) => (
                <Link key={scan.id} to={`/scanner/${scan.id}`} className="flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-indigo shrink-0" />
                  <span className="text-[11px] font-mono text-secondary group-hover:text-accent-indigo transition-colors truncate">
                    {scan.name}
                  </span>
                  {scan.vani && (
                    <span
                      title="✦ VaNi Highlight within this scan — independent confirmation from another dimension"
                      className="text-[10px] shrink-0"
                      style={{ color: 'var(--gold, #d4a84b)' }}
                    >
                      ✦
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-muted group-hover:text-accent-indigo transition-colors">
                    →
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted italic">Not surfacing in any scans today.</p>
          )}
        </div>
      )}
    </div>
  );
}
