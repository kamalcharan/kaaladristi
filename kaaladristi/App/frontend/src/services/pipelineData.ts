import { from } from './postgrest';

// ── Types ────────────────────────────────────────────────────────────────────

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

export interface PipelineHealth {
  db: string;
  breeze: string;
  last_sync: string | null;
  scheduler_next_run: string | null;
  active_jobs: number;
}

export interface PipelineStatus {
  today: string;
  today_steps: PipelineRun[];
  calendar: TradingCalendarDay[];
  recent_runs: PipelineRun[];
  active_jobs: Record<string, any>;
}

export interface BreezeStatus {
  status: string;
  connected_at: string | null;
  expires_at: string | null;
  last_error: string | null;
  api_key_hint: string | null;
  login_url: string;
}

export interface SchedulerStatus {
  active: boolean;
  next_run: string | null;
  trigger: string;
}

export interface DownloadType {
  type: string;
  label: string;
  last_sync: string | null;
  status: string;
  gap_days: number;
  depends_on?: string;
  run_exchange?: string;   // which exchange to trigger when "Run" is clicked
}

export interface JobResponse {
  job_id: string;
  status: string;
  message: string;
}

// ── Pipeline API Base URL ────────────────────────────────────────────────────

const PIPELINE_API = (
  import.meta.env.VITE_PIPELINE_API_URL?.trim() || 'http://localhost:8100'
);

async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${PIPELINE_API}${path}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `API error: ${resp.status}`);
  }
  return resp.json();
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const resp = await fetch(`${PIPELINE_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `API error: ${resp.status}`);
  }
  return resp.json();
}

// ── Pipeline API Calls ───────────────────────────────────────────────────────

export const fetchPipelineHealth = () => apiGet<PipelineHealth>('/api/pipeline/health');
export const fetchPipelineStatus = () => apiGet<PipelineStatus>('/api/pipeline/status');
export const fetchBreezeStatus = () => apiGet<BreezeStatus>('/api/pipeline/breeze-status');
export const fetchSchedulerStatus = () => apiGet<SchedulerStatus>('/api/pipeline/scheduler');
export const fetchDownloadTypes = () => apiGet<DownloadType[]>('/api/pipeline/downloads');

export const triggerPipelineRun = (date?: string, exchange: string = 'ALL', force: boolean = false) =>
  apiPost<JobResponse>('/api/pipeline/run', { date, exchange, force });

export const triggerBackfill = (dateFrom: string, dateTo: string, exchange: string = 'ALL') =>
  apiPost<JobResponse>('/api/pipeline/backfill', { date_from: dateFrom, date_to: dateTo, exchange });

export const connectBreeze = (sessionToken: string) =>
  apiPost<{ status: string; message: string }>('/api/pipeline/breeze-connect', { session_token: sessionToken });

// ── Direct DB reads (for history — doesn't need pipeline API) ────────────────

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
