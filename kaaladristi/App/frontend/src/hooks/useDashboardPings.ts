import { useMemo } from 'react';
import { useIndustryRotation, useOutlookInferences } from '@/hooks';
import type { IndustryRotationItem, DcInference } from '@/types';
import type { KickerTier } from '@/components/domain/DashboardV3/Kicker';

export interface DashboardPing {
  id: string;
  type: 'industry' | 'astro';
  tier: KickerTier;
  kicker: string;
  kickerTag: string;
  headline: string;
  subHeadline: string;
  trail: string[];
  sparkValues: number[];
  score: string;
  scoreLbl: string;
}

/** Build a synthetic 6-point sparkline from available rank/RS fields */
function industrySparkline(item: IndustryRotationItem): number[] {
  const end = item.avg_magic_rs ?? 50;
  const isRising = item.rank_change > 0;
  const mid = isRising ? end * 0.82 : end * 1.12;
  const start = isRising ? end * 0.65 : end * 1.2;
  return [start, start * 1.05, mid * 0.98, mid, end * 0.97, end].map(v =>
    Math.max(0, Math.round(v * 10) / 10)
  );
}

/** Pick the most significant upcoming astro inference */
function topAstroInference(inferences: DcInference[]): DcInference | null {
  const ranked = [...inferences]
    .filter(i => i.market_impact && i.market_impact !== 'neutral' && i.confidence)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  return ranked[0] ?? inferences[0] ?? null;
}

function industryHeadline(item: IndustryRotationItem): { headline: string; sub: string } {
  if (item.rank_change >= 15)
    return {
      headline: `${item.industry} just came into focus.`,
      sub: `Rank improved ${item.rank_change} positions — fresh rotation building.`,
    };
  if (item.rank_change >= 8)
    return {
      headline: `Something is shifting in ${item.industry}.`,
      sub: `Rank up ${item.rank_change} in the last 5 sessions. Watch for follow-through.`,
    };
  return {
    headline: `${item.industry} is rotating in.`,
    sub: `Rank up ${item.rank_change} positions. RS building above peers.`,
  };
}

function leadingHeadline(item: IndustryRotationItem): { headline: string; sub: string } {
  return {
    headline: `${item.industry} is holding leadership.`,
    sub: `Rank ${item.industry_rank} · ${Math.round(item.pct_strong_bull ?? 0)}% of stocks in strong bull zone.`,
  };
}

function astroHeadline(inf: DcInference): { headline: string; sub: string } {
  const event = inf.astro_event ?? 'Upcoming planetary event';
  const impact = inf.market_impact?.replace(/_/g, ' ') ?? '';
  return {
    headline: `${event}.`,
    sub: inf.inference ?? `${impact} impact — ${inf.confidence ?? '—'}% confidence.`,
  };
}

/** Derives up to 3 dashboard pings from existing hooks — no new API calls */
export function useDashboardPings(date: string): {
  pings: DashboardPing[];
  isLoading: boolean;
} {
  const rotation = useIndustryRotation();
  const inferences = useOutlookInferences(date);

  const pings = useMemo<DashboardPing[]>(() => {
    const result: DashboardPing[] = [];

    const rotatingIn = rotation.data?.rotatingIn ?? [];
    const leading = rotation.data?.leading ?? [];

    // Ping 1 — top rotating-in industry opportunity
    if (rotatingIn.length > 0) {
      const top = rotatingIn[0];
      const { headline, sub } = industryHeadline(top);
      result.push({
        id: `industry-rotating-${top.industry}`,
        type: 'industry',
        tier: 'opportunity',
        kicker: '✦ Opportunity · industry',
        kickerTag: top.industry,
        headline,
        subHeadline: sub,
        trail: [
          `RS · ${top.avg_magic_rs?.toFixed(1) ?? '—'}`,
          `${top.stock_count} stocks`,
          `Rank +${top.rank_change}`,
          top.pct_strong_bull != null ? `${Math.round(top.pct_strong_bull)}% strong bull` : '',
        ].filter(Boolean),
        sparkValues: industrySparkline(top),
        score: `+${top.rank_change}`,
        scoreLbl: 'rank ↑',
      });
    }

    // Ping 2 — top leading industry
    if (leading.length > 0) {
      const top = leading[0];
      const { headline, sub } = leadingHeadline(top);
      result.push({
        id: `industry-leading-${top.industry}`,
        type: 'industry',
        tier: 'opportunity',
        kicker: '✦ Opportunity · industry',
        kickerTag: top.industry,
        headline,
        subHeadline: sub,
        trail: [
          `RS · ${top.avg_magic_rs?.toFixed(1) ?? '—'}`,
          `Rank #${top.industry_rank}`,
          `${top.stock_count} stocks`,
          top.pct_accumulation != null ? `${Math.round(top.pct_accumulation)}% accumulation` : '',
        ].filter(Boolean),
        sparkValues: industrySparkline(top),
        score: `#${top.industry_rank}`,
        scoreLbl: 'rank',
      });
    }

    // Ping 3 — upcoming astro heads-up
    const infList = (inferences.data ?? []) as DcInference[];
    const top = topAstroInference(infList);
    if (top) {
      const { headline, sub } = astroHeadline(top);
      const daysAway = Math.ceil(
        (new Date(top.start_date).getTime() - new Date(date).getTime()) / 86_400_000
      );
      result.push({
        id: `astro-${top.id}`,
        type: 'astro',
        tier: 'heads-up',
        kicker: `◆ Heads-up · ${daysAway <= 1 ? 'tomorrow' : `${daysAway} days ahead`}`,
        kickerTag: top.start_date,
        headline,
        subHeadline: sub,
        trail: [
          `Confidence · ${top.confidence ?? '—'}%`,
          top.market_impact ? `Impact · ${top.market_impact.replace(/_/g, ' ')}` : '',
        ].filter(Boolean),
        sparkValues: [1, -1, 1, -1, -1, 1, -1, -1].map((v, i) => 50 + v * 15 + i * 2),
        score: `${top.confidence ?? '—'}%`,
        scoreLbl: 'confidence',
      });
    }

    return result;
  }, [rotation.data, inferences.data, date]);

  return {
    pings,
    isLoading: rotation.isLoading || inferences.isLoading,
  };
}
