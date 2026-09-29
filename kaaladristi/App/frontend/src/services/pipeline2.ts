// Pipeline API client — /api/pipeline2/* routes on pipeline2_api.py.

import { api } from '@/services/apiClient';

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
  api.get<HealthGrid>(`/api/pipeline2/health?days=${days}`);

export const fetchJobs = (limit = 20, dimension?: string, status?: string) => {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (dimension) qs.set('dimension', dimension);
  if (status) qs.set('status', status);
  return api.get<JobsResponse>(`/api/pipeline2/jobs?${qs.toString()}`);
};

export const fetchJob = (id: number) =>
  api.get<Job>(`/api/pipeline2/jobs/${id}`);

export const enqueueFix = (body: {
  dimension: string;
  trade_date: string;
  exchange?: string | null;
  force?: boolean;
}) => api.post<{ job_id: number; status: string }>('/api/pipeline2/fix', body);

export const enqueueDailyRun = (body: {
  trade_date?: string;
  force?: boolean;
} = {}) =>
  api.post<{ job_id: number; status: string }>('/api/pipeline2/daily-run', body);

export const enqueueBackfill = (body: {
  dimension: string;        // dim key or 'all'
  date_from: string;
  date_to: string;
  exchange?: string | null;
  force?: boolean;
}) => api.post<BackfillResponse>('/api/pipeline2/backfill', body);

export interface CancelResponse {
  status: string;
  count: number;
  cancelled_job_ids: number[];
}

export const cancelJob = (jobId: number) =>
  api.post<CancelResponse>('/api/pipeline2/cancel', { job_id: jobId });

export const cancelBatch = (batchId: string) =>
  api.post<CancelResponse>('/api/pipeline2/cancel', { batch_id: batchId });

export type CalendarMarkStatus = 'holiday' | 'no_data' | 'clear';

export interface CalendarMarkResponse {
  trade_date: string;
  status: CalendarMarkStatus;
  exchanges: string[];
  rows_affected: number;
}

export const markCalendar = (tradeDate: string, status: CalendarMarkStatus) =>
  api.post<CalendarMarkResponse>('/api/pipeline2/calendar/mark', {
    trade_date: tradeDate,
    status,
  });

export const fetchDimensions = () =>
  api.get<DimensionsList>('/api/pipeline2/dimensions');

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
  api.get<SchedulerInfo>('/api/pipeline2/scheduler');

export interface LastRun {
  exists: boolean;
  id?: number;
  trade_date?: string | null;
  status?: JobStatus;
  error_msg?: string | null;
  progress_text?: string | null;
  rows_affected?: number | null;
  completed_at?: string | null;
  has_error?: boolean;
}

export const fetchLastRun = () =>
  api.get<LastRun>('/api/pipeline2/last-run');

// ── Filing read checks — the admin's second opinion (migration 233) ─────────
// Owner, 2026-09-29: Qwen reads every filing; Haiku is asked for on chosen rows.

export interface FilingCheckRequestResult {
  queued: number;
  already: number;
  same_backend: number;
  no_read: number;
  capped: number;
  runner_started: boolean;
}

export interface FilingCheckSummary {
  compared: number;
  agree_impact: number;
  agree_magnitude: number;
  by_type: { event_type: string; n: number; impact: number; magnitude: number }[];
  queue: Record<string, Record<string, number>>;
  cost_usd: number;
  paid_reads_without_local_check: number;
  paid_per_request: number;
  runner: { running: boolean; started_at: string | null; finished_at: string | null;
            waiting_until: string | null;
            last: Record<string, number | string> | null; error: string | null };
}

export const requestFilingChecks = (body: { event_ids: number[]; backend: 'anthropic' | 'local' }) =>
  api.post<FilingCheckRequestResult>('/api/admin/filing-checks', body);

export const queueLocalFilingChecks = () =>
  api.post<{ queued: number; runner_started: boolean }>('/api/admin/filing-checks/queue-local');

export const runFilingChecks = () =>
  api.post<{ pending: number; runner_started: boolean }>('/api/admin/filing-checks/run');

export const fetchFilingCheckSummary = () =>
  api.get<FilingCheckSummary>('/api/admin/filing-checks/summary');

export const restartFilingRead = (eventId: number) =>
  api.post<{ event_id: number; status: string }>(`/api/admin/filing-reads/${eventId}/restart`);
