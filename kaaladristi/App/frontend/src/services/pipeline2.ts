// Pipeline v2 API client.
// All endpoints under /api/pipeline2. Runs on a separate uvicorn process;
// nginx proxies /api/pipeline2/ to pipeline-api2:8101.

const PIPELINE_API = (
  import.meta.env.VITE_PIPELINE_API_URL?.trim() || 'http://localhost:8101'
);

async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${PIPELINE_API}${path}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${resp.status}`);
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
    throw new Error(err.detail || `API error ${resp.status}`);
  }
  return resp.json();
}

// ── Types ──────────────────────────────────────────────────────────────────

export type DayCellStatus =
  | 'ok' | 'partial' | 'missing' | 'holiday' | 'no_data' | 'future';

export interface DayCell {
  trade_date: string;
  status: DayCellStatus;
  total: number;
  populated: number;
  fill_rate: number | null;
}

export type DimensionGroup = 'download' | 'compute';

export interface DimensionHealth {
  dimension: string;
  label: string;
  group: DimensionGroup;
  latest_ok: string | null;
  days: DayCell[];
  error?: string;
}

export interface HealthGrid {
  days: number;
  dimensions: DimensionHealth[];
  generated_at: string;
}

export type JobStatus =
  | 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';

export type JobType = 'daily_run' | 'fix' | 'backfill';

export interface Job {
  id: number;
  job_type: JobType;
  dimension: string | null;
  trade_date: string | null;
  date_from: string | null;
  date_to: string | null;
  batch_id: string | null;
  exchange: string | null;
  force: boolean;
  status: JobStatus;
  progress_text: string | null;
  progress_pct: number | null;
  rows_affected: number | null;
  fill_rate_before: number | null;
  fill_rate_after: number | null;
  error_msg: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
}

export interface BackfillResponse {
  batch_id: string;
  job_count: number;
  jobs: { job_id: number; dimension: string }[];
  status: string;
}

export interface JobsResponse {
  jobs: Job[];
  count: number;
}

export interface DimensionInfo {
  key: string;
  label: string;
  group: DimensionGroup;
  fixable: boolean;
  ok_threshold: number | null;
}

export interface DimensionsList {
  dimensions: DimensionInfo[];
}

// ── Endpoints ──────────────────────────────────────────────────────────────

export const fetchHealthGrid = (days = 30) =>
  apiGet<HealthGrid>(`/api/pipeline2/health?days=${days}`);

export const fetchJobs = (limit = 20, dimension?: string, status?: string) => {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (dimension) qs.set('dimension', dimension);
  if (status) qs.set('status', status);
  return apiGet<JobsResponse>(`/api/pipeline2/jobs?${qs.toString()}`);
};

export const fetchJob = (id: number) =>
  apiGet<Job>(`/api/pipeline2/jobs/${id}`);

export const enqueueFix = (body: {
  dimension: string;
  trade_date: string;
  exchange?: string | null;
  force?: boolean;
}) => apiPost<{ job_id: number; status: string }>('/api/pipeline2/fix', body);

export const enqueueDailyRun = (body: {
  trade_date?: string;
  force?: boolean;
} = {}) =>
  apiPost<{ job_id: number; status: string }>('/api/pipeline2/daily-run', body);

export const enqueueBackfill = (body: {
  dimension: string;        // dim key or 'all'
  date_from: string;
  date_to: string;
  exchange?: string | null;
  force?: boolean;
}) => apiPost<BackfillResponse>('/api/pipeline2/backfill', body);

export interface CancelResponse {
  status: string;
  count: number;
  cancelled_job_ids: number[];
}

export const cancelJob = (jobId: number) =>
  apiPost<CancelResponse>('/api/pipeline2/cancel', { job_id: jobId });

export const cancelBatch = (batchId: string) =>
  apiPost<CancelResponse>('/api/pipeline2/cancel', { batch_id: batchId });

export type CalendarMarkStatus = 'holiday' | 'no_data' | 'clear';

export interface CalendarMarkResponse {
  trade_date: string;
  status: CalendarMarkStatus;
  exchanges: string[];
  rows_affected: number;
}

export const markCalendar = (tradeDate: string, status: CalendarMarkStatus) =>
  apiPost<CalendarMarkResponse>('/api/pipeline2/calendar/mark', {
    trade_date: tradeDate,
    status,
  });

export const fetchDimensions = () =>
  apiGet<DimensionsList>('/api/pipeline2/dimensions');

export interface SchedulerJobInfo {
  next: string | null;
  trigger: string;
}

export interface SchedulerInfo {
  active: boolean;
  daily_run: SchedulerJobInfo;
  gap_sweep: SchedulerJobInfo;
}

export const fetchSchedulerInfo = () =>
  apiGet<SchedulerInfo>('/api/pipeline2/scheduler');
