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

// Retained for the operational Job Monitor, including cancellation of old jobs.
export async function fetchDiscoveryStatus(): Promise<DiscoveryStatus> {
 return api.get<DiscoveryStatus>('/api/discovery/status');
}
export async function cancelDiscovery(): Promise<{status:string}> {
 return api.post<{status:string}>('/api/discovery/cancel',{});
}
