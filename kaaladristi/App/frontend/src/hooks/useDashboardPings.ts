import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useIndustryRotation, useOutlookInferences } from '@/hooks';
import { fetchIndustrySparklines } from '@/services/industryRotation';
import { fetchRecentAstroScores } from '@/services/astro';
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

// ── Headline generators ───────────────────────────────────────────────────────

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
    sub: `Rank #${item.industry_rank} · ${Math.round(item.pct_strong_bull ?? 0)}% of stocks in strong bull zone.`,
  };
}

function astroHeadline(inf: DcInference): { headline: string; sub: string } {
  return {
    headline: `${inf.astro_event}.`,
    sub: inf.inference ?? `${(inf.market_impact ?? '').replace(/_/g, ' ')} impact — ${inf.confidence ?? '—'}% confidence.`,
  };
}

function topAstroInference(list: DcInference[]): DcInference | null {
  return (
    [...list]
      .filter(i => i.market_impact && i.market_impact !== 'neutral' && i.confidence)
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0] ?? list[0] ?? null
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDashboardPings(date: string): {
  pings: DashboardPing[];
  isLoading: boolean;
} {
  const rotation    = useIndustryRotation();
  const inferences  = useOutlookInferences(date);

  // Which industries do we need sparklines for?
  const targetIndustries = useMemo(() => {
    const ri = rotation.data?.rotatingIn[0]?.industry;
    const le = rotation.data?.leading[0]?.industry;
    return [ri, le].filter((v): v is string => !!v && v !== le || v === ri);
  }, [rotation.data]);

  // Deduplicated list for the query key
  const uniqueIndustries = useMemo(
    () => [...new Set(targetIndustries)],
    [targetIndustries]
  );

  // Real 6-day industry sparklines
  const sparklines = useQuery({
    queryKey: ['industry_sparklines', uniqueIndustries],
    queryFn: () => fetchIndustrySparklines(uniqueIndustries, 6),
    enabled: uniqueIndustries.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Real astro net_score trend (last 7 trading days up to today)
  const astroScores = useQuery({
    queryKey: ['astro_scores_sparkline', date],
    queryFn: () => fetchRecentAstroScores(date, 7),
    enabled: !!date,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const pings = useMemo<DashboardPing[]>(() => {
    const result: DashboardPing[] = [];
    const rotatingIn = rotation.data?.rotatingIn ?? [];
    const leading    = rotation.data?.leading ?? [];
    const sparks     = sparklines.data ?? {};
    const astroSpark = astroScores.data ?? [];

    // Ping 1 — top rotating-in industry
    if (rotatingIn.length > 0) {
      const top = rotatingIn[0];
      const { headline, sub } = industryHeadline(top);
      result.push({
        id:           `industry-rotating-${top.industry}`,
        type:         'industry',
        tier:         'opportunity',
        kicker:       '✦ Opportunity · industry',
        kickerTag:    top.industry,
        headline,
        subHeadline:  sub,
        trail: [
          `RS · ${top.avg_magic_rs?.toFixed(1) ?? '—'}`,
          `${top.stock_count} stocks`,
          `Rank +${top.rank_change}`,
          top.pct_strong_bull != null ? `${Math.round(top.pct_strong_bull)}% strong uptrend` : '',
        ].filter(Boolean),
        sparkValues:  sparks[top.industry] ?? [],
        score:        `+${top.rank_change}`,
        scoreLbl:     'rank ↑',
      });
    }

    // Ping 2 — top leading industry
    if (leading.length > 0) {
      const top = leading[0];
      const { headline, sub } = leadingHeadline(top);
      result.push({
        id:           `industry-leading-${top.industry}`,
        type:         'industry',
        tier:         'opportunity',
        kicker:       '✦ Opportunity · industry',
        kickerTag:    top.industry,
        headline,
        subHeadline:  sub,
        trail: [
          `RS · ${top.avg_magic_rs?.toFixed(1) ?? '—'}`,
          `Rank #${top.industry_rank}`,
          `${top.stock_count} stocks`,
          top.pct_accumulation != null ? `${Math.round(top.pct_accumulation)}% accumulation` : '',
        ].filter(Boolean),
        sparkValues:  sparks[top.industry] ?? [],
        score:        `#${top.industry_rank}`,
        scoreLbl:     'rank',
      });
    }

    // Ping 3 — upcoming astro heads-up
    const infList = (inferences.data ?? []) as DcInference[];
    const topInf  = topAstroInference(infList);
    if (topInf) {
      const { headline, sub } = astroHeadline(topInf);
      const daysAway = Math.ceil(
        (new Date(topInf.start_date).getTime() - new Date(date).getTime()) / 86_400_000
      );
      result.push({
        id:           `astro-${topInf.id}`,
        type:         'astro',
        tier:         'heads-up',
        kicker:       `◆ Heads-up · ${daysAway <= 1 ? 'tomorrow' : `${daysAway} days ahead`}`,
        kickerTag:    topInf.start_date,
        headline,
        subHeadline:  sub,
        trail: [
          `Confidence · ${topInf.confidence ?? '—'}%`,
          topInf.market_impact ? `Impact · ${topInf.market_impact.replace(/_/g, ' ')}` : '',
        ].filter(Boolean),
        sparkValues:  astroSpark,
        score:        `${topInf.confidence ?? '—'}%`,
        scoreLbl:     'confidence',
      });
    }

    return result;
  }, [rotation.data, inferences.data, sparklines.data, astroScores.data, date]);

  return {
    pings,
    isLoading: rotation.isLoading || inferences.isLoading || sparklines.isLoading,
  };
}
