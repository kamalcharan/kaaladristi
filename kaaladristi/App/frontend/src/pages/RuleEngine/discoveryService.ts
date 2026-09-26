import { api } from '@/services/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiscoveryStatus {
  job_id: string | null;
  running: boolean;
  cancel_requested: boolean;
  started_at: string | null;
  finished_at: string | null;
  rules_total: number;
  rules_done: number;
  signals_inserted: number;
  transits_inserted: number;
  current_rule_code: string | null;
  phase: string | null;
  errors: { rule_code: string; error: string }[];
  confidence_computed_at: string | null;
  confidence_error: string | null;
  summary: {
    rules_with_signals: number;
    rules_without_signals: number;
    total_signals: number;
  };
}

export interface SignalCount {
  rule_id: number;
  count: number;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function runFullDiscovery(): Promise<{ job_id: string }> {
  return api.post<{ job_id: string }>('/api/discovery/run-all', {});
}

export async function runMissingDiscovery(): Promise<{ job_id: string; rules_to_process: number }> {
  return api.post<{ job_id: string; rules_to_process: number }>('/api/discovery/run-missing', {});
}

export async function runRuleDiscovery(ruleId: number): Promise<{ job_id: string }> {
  return api.post<{ job_id: string }>(`/api/discovery/run-rule/${ruleId}`, {});
}

export async function fetchDiscoveryStatus(): Promise<DiscoveryStatus> {
  return api.get<DiscoveryStatus>('/api/discovery/status');
}

export async function fetchSignalCounts(): Promise<SignalCount[]> {
  return api.get<SignalCount[]>('/api/discovery/signal-counts');
}

export async function cancelDiscovery(): Promise<{ status: string }> {
  return api.post<{ status: string }>('/api/discovery/cancel', {});
}

export async function runCleanDiscovery(): Promise<{ job_id: string; signals_deleted: number }> {
  return api.post<{ job_id: string; signals_deleted: number }>('/api/discovery/run-clean', {});
}

export async function computeConfidence(): Promise<{ job_id: string }> {
  return api.post<{ job_id: string }>('/api/confidence/compute', {});
}

export async function dropRuleSignals(ruleId: number): Promise<{ signals_deleted: number; transits_deleted: number }> {
  return api.post<{ signals_deleted: number; transits_deleted: number }>(`/api/discovery/rule/${ruleId}/drop-signals`, {});
}

export async function runDiagnose(): Promise<Record<string, unknown>> {
  return api.get<Record<string, unknown>>('/api/discovery/diagnose');
}
