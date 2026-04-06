import { from } from './postgrest';

export interface PipelineRun {
  id: number;
  trade_date: string;
  exchange: string;
  step: string;
  status: string;
  rows_count: number;
  duration_ms: number | null;
  error_msg: string | null;
  metadata: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface TradingCalendarDay {
  trade_date: string;
  exchange: string;
  is_holiday: boolean;
  holiday_name: string | null;
  status: string;
}

export async function fetchPipelineRuns(days: number = 14): Promise<PipelineRun[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];

  const { data, error } = await from('km_pipeline_runs')
    .select('*')
    .gte('trade_date', sinceStr)
    .order('trade_date', { ascending: false })
    .limit(500)
    .execute();

  if (error) throw new Error(`Failed to fetch pipeline runs: ${error.message}`);
  return (data ?? []) as PipelineRun[];
}

export async function fetchTradingCalendar(days: number = 30): Promise<TradingCalendarDay[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];

  const { data, error } = await from('km_trading_calendar')
    .select('*')
    .gte('trade_date', sinceStr)
    .order('trade_date', { ascending: false })
    .limit(200)
    .execute();

  if (error) throw new Error(`Failed to fetch trading calendar: ${error.message}`);
  return (data ?? []) as TradingCalendarDay[];
}
