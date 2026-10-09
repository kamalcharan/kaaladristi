import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAstroHorizon } from './useAstroHorizon';
import { astroToday, fetchAstroEvents } from '@/services/astroEvents';
import { validStudyDate } from '@/services/astroStudy';

/** Event metadata only. Prices, indicators and rendering belong to ChartView. */
export function useChartAstroContext(params: URLSearchParams, enabled: boolean) {
  const horizon = useAstroHorizon();
  const today = astroToday();
  const date = params.get('date');
  const anchor = validStudyDate(date) ? date : today;
  const year = Number(anchor.slice(0, 4));
  const [yearsBack, setYearsBack] = useState(2);
  const start = `${Math.max(1990, year - yearsBack)}-01-01`;
  const end = [`${Math.max(year,Number(today.slice(0,4)))}-12-31`, horizon.cutoffIso].sort()[0];
  const query = useQuery({
    queryKey: ['astro', 'chart-occurrences', start, end],
    queryFn: () => fetchAstroEvents(start, end),
    enabled: enabled && start <= end,
    staleTime: 300_000,
  });
  const events = [...(query.data ?? [])].sort((a,b) => b.start_date.localeCompare(a.start_date) || a.event_key.localeCompare(b.event_key));
  const requested = events.find(e => e.event_key === params.get('event'));
  const event = requested;
  return { ...query, events, event, anchor, start, end, loadEarlier: () => setYearsBack(n => n + 3) };
}
