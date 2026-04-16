/**
 * PumpDumpBanner — Conditional manipulation warning
 * ===================================================
 * Shows amber (pump) or red (dump) banner if stock matches
 * Manipulation Watch conditions. Returns null if clean.
 *
 * Uses same thresholds as scanEngine.ts isPumpSignal / isDumpSignal.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PumpDumpBannerProps {
  rssValue: number | null;
  rssSpread: number | null;
  flowType: string | null;
  volumeDivFlag: string | null;
  sniperInst: number | null;
  sniperInstPrev5: number | null; // sniper_inst from 5 bars ago
}

function isPumpSuspect(props: PumpDumpBannerProps): boolean {
  return (
    (props.rssValue ?? 0) > 75 &&
    (props.rssSpread ?? 0) < -200 &&
    props.flowType === 'SHORT_COVERING' &&
    props.volumeDivFlag === 'VOLUME_DIV_UP'
  );
}

function isDumpSuspect(props: PumpDumpBannerProps): boolean {
  if ((props.rssValue ?? 100) >= 25) return false;
  if (props.flowType !== 'LONG_LIQUIDATION') return false;
  if (props.volumeDivFlag !== 'VOLUME_DIV_DOWN') return false;
  const sniperSlope = (props.sniperInst ?? 0) - (props.sniperInstPrev5 ?? 0);
  return sniperSlope < -2;
}

function buildPumpReasons(props: PumpDumpBannerProps): string {
  const rss = Math.round(props.rssValue ?? 0);
  const spread = Math.round(props.rssSpread ?? 0);
  return `RSS overbought (${rss}) + spread broken (${spread}) + short covering on volume divergence.`;
}

function buildDumpReasons(props: PumpDumpBannerProps): string {
  const rss = Math.round(props.rssValue ?? 0);
  return `RSS oversold (${rss}) + long liquidation + volume diverging down + smart money exiting.`;
}

export default function PumpDumpBanner(props: PumpDumpBannerProps) {
  const pump = isPumpSuspect(props);
  const dump = isDumpSuspect(props);

  if (!pump && !dump) return null;

  const isPump = pump;
  const label = isPump ? 'PUMP SUSPECT' : 'DUMP SUSPECT';
  const reasons = isPump ? buildPumpReasons(props) : buildDumpReasons(props);

  const borderColor = isPump ? 'border-risk-amber' : 'border-risk-red';
  const bgColor = isPump ? 'bg-risk-amber/8' : 'bg-risk-red/8';
  const textColor = isPump ? 'text-risk-amber' : 'text-risk-red';
  const iconColor = isPump ? 'text-risk-amber' : 'text-risk-red';

  return (
    <div className={`rounded-lg border-l-4 ${borderColor} ${bgColor} px-4 py-3`}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className={`w-4 h-4 ${iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-mono font-bold ${textColor} tracking-wide`}>
            {label}
          </div>
          <p className="text-[11px] text-secondary mt-1 leading-relaxed">
            This stock is currently flagged in Manipulation Watch. {reasons}
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
