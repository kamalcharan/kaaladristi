import { from } from './postgrest';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PipelineRun {
  id: number;
  trade_date: string;
  exchange: string;
  step: string;
  step_order: number | null;
  status: string;
  rows_count: number;
  rows_expected: number | null;
  coverage_pct: number | null;
  duration_ms: number | null;
  error_msg: string | null;
  metadata: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  triggered_by: string | null;
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

export const triggerStepRerun = (tradeDate: string, step: string, exchange: string = 'NSE') =>
  apiPost<JobResponse>('/api/pipeline/run-step', { trade_date: tradeDate, step, exchange });

export interface CoverageSummary {
  trade_date: string;
  overall: string;
  steps: {
    step: string;
    label: string;
    order: number;
    exchange: string;
    status: string;
    rows_count: number | null;
    rows_expected: number | null;
    coverage_pct: number | null;
    classification: string;
    duration_ms: number | null;
    error_msg: string | null;
  }[];
}

export const fetchCoverageSummary = (tradeDate?: string) =>
  apiGet<CoverageSummary>(`/api/pipeline/coverage-summary${tradeDate ? `?trade_date=${tradeDate}` : ''}`);

// ── Direct DB reads (PostgREST — no Pipeline API dependency) ─────────────────

/** Fetch pipeline runs for the latest available trade_date, grouped for matrix view.
 *  Skips dates that only have failed/skipped steps — finds the latest date
 *  with at least one completed step. */
export async function fetchLatestPipelineSteps(): Promise<{
  trade_date: string;
  steps: PipelineRun[];
} | null> {
  // Get recent trade_dates (check a few in case latest is all-failed)
  const { data: dateRows, error: dateErr } = await from('km_pipeline_runs')
    .select('trade_date,status')
    .order('trade_date', { ascending: false })
    .limit(200)
    .execute();

  if (dateErr || !dateRows || dateRows.length === 0) return null;

  // Find latest date with at least one completed step
  const dateSet = new Map<string, boolean>();
  for (const r of dateRows as { trade_date: string; status: string }[]) {
    if (!dateSet.has(r.trade_date)) dateSet.set(r.trade_date, false);
    if (r.status === 'completed') dateSet.set(r.trade_date, true);
  }

  let latestDate: string | null = null;
  for (const [d, hasCompleted] of dateSet) {
    if (hasCompleted) { latestDate = d; break; }
  }
  if (!latestDate) {
    // Fallback: just use the most recent date
    latestDate = (dateRows[0] as { trade_date: string }).trade_date;
  }

  // Get all steps for that date
  const { data, error } = await from('km_pipeline_runs')
    .select('*')
    .eq('trade_date', latestDate)
    .order('step_order', { ascending: true })
    .execute();

  if (error || !data) return null;

  return { trade_date: latestDate, steps: data as PipelineRun[] };
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
