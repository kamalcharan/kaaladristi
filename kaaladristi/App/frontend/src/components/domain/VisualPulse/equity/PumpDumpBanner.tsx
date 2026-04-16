/**
 * PumpDumpBanner — Conditional manipulation warning
 * ===================================================
 * Shows amber (pump) or red (dump) banner if stock was flagged
 * in Manipulation Watch within the lookback period.
 *
 * Accepts pre-computed flags — the caller scans across bar history,
 * not just the latest bar. This ensures a stock flagged on day -15
 * still shows the banner even if today's bar is clean.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PulseBar } from '@/services/visualPulseEngine';

export interface PumpDumpResult {
  isPump: boolean;
  isDump: boolean;
  pumpReasons: string;
  dumpReasons: string;
  triggerCount: number;
  latestTriggerDate: string | null;
}

/** Scan bars for pump/dump signals across a lookback window (default 30 bars) */
export function scanBarsForManipulation(bars: PulseBar[], lookback = 30): PumpDumpResult {
  const result: PumpDumpResult = {
    isPump: false,
    isDump: false,
    pumpReasons: '',
    dumpReasons: '',
    triggerCount: 0,
    latestTriggerDate: null,
  };

  // Scan the last N bars (most recent first)
  const startIdx = Math.max(0, bars.length - lookback);
  for (let i = bars.length - 1; i >= startIdx; i--) {
    const bar = bars[i];

    // Pump check
    if (
      (bar.rss_value ?? 0) > 75 &&
      (bar.rss_spread ?? 0) < -200 &&
      bar.flow_type === 'SHORT_COVERING' &&
      bar.volume_divergence_flag === 'VOLUME_DIV_UP'
    ) {
      if (!result.isPump) {
        result.isPump = true;
        result.pumpReasons = `RSS overbought (${Math.round(bar.rss_value ?? 0)}) + spread broken (${Math.round(bar.rss_spread ?? 0)}) + short covering on volume divergence.`;
        result.latestTriggerDate = bar.trade_date;
      }
      result.triggerCount++;
    }

    // Dump check
    if (
      (bar.rss_value ?? 100) < 25 &&
      bar.flow_type === 'LONG_LIQUIDATION' &&
      bar.volume_divergence_flag === 'VOLUME_DIV_DOWN'
    ) {
      if (!result.isDump) {
        result.isDump = true;
        result.dumpReasons = `RSS oversold (${Math.round(bar.rss_value ?? 0)}) + long liquidation + volume diverging down.`;
        if (!result.latestTriggerDate) result.latestTriggerDate = bar.trade_date;
      }
      result.triggerCount++;
    }
  }

  return result;
}

interface PumpDumpBannerProps {
  result: PumpDumpResult;
}

export default function PumpDumpBanner({ result }: PumpDumpBannerProps) {
  if (!result.isPump && !result.isDump) return null;

  // Show pump if both (pump is more urgent)
  const showPump = result.isPump;
  const label = showPump ? 'PUMP SUSPECT' : 'DUMP SUSPECT';
  const reasons = showPump ? result.pumpReasons : result.dumpReasons;

  const borderColor = showPump ? 'border-risk-amber' : 'border-risk-red';
  const bgColor = showPump ? 'bg-risk-amber/8' : 'bg-risk-red/8';
  const textColor = showPump ? 'text-risk-amber' : 'text-risk-red';
  const iconColor = showPump ? 'text-risk-amber' : 'text-risk-red';

  return (
    <div className={`rounded-lg border-l-4 ${borderColor} ${bgColor} px-4 py-3`}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className={`w-4 h-4 ${iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono font-bold ${textColor} tracking-wide`}>
              {label}
            </span>
            {result.triggerCount > 1 && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${showPump ? 'bg-risk-amber/15 text-risk-amber' : 'bg-risk-red/15 text-risk-red'}`}>
                {result.triggerCount}x in last 30 days
              </span>
            )}
          </div>
          <p className="text-[11px] text-secondary mt-1 leading-relaxed">
            Flagged in Manipulation Watch. {reasons}
            {result.latestTriggerDate && (
              <span className="text-muted"> Last triggered: {result.latestTriggerDate}</span>
            )}
          </p>
          <Link
            to="/manipulation-watch"
            className={`inline-block text-[10px] font-mono ${textColor} hover:underline mt-1.5`}
          >
            View in Manipulation Watch &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
