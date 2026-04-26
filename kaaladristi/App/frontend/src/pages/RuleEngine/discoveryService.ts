const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || '');

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

async function postJson(url: string): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res;
}

export async function runFullDiscovery(): Promise<{ job_id: string }> {
  const res = await postJson(`${PIPELINE_API}/api/discovery/run-all`);
  return res.json();
}

export async function runMissingDiscovery(): Promise<{ job_id: string; rules_to_process: number }> {
  const res = await postJson(`${PIPELINE_API}/api/discovery/run-missing`);
  return res.json();
}

export async function runRuleDiscovery(ruleId: number): Promise<{ job_id: string }> {
  const res = await postJson(`${PIPELINE_API}/api/discovery/run-rule/${ruleId}`);
  return res.json();
}

export async function fetchDiscoveryStatus(): Promise<DiscoveryStatus> {
  const res = await fetch(`${PIPELINE_API}/api/discovery/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchSignalCounts(): Promise<SignalCount[]> {
  const res = await fetch(`${PIPELINE_API}/api/discovery/signal-counts`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function cancelDiscovery(): Promise<{ status: string }> {
  const res = await postJson(`${PIPELINE_API}/api/discovery/cancel`);
  return res.json();
}

export async function runCleanDiscovery(): Promise<{ job_id: string; signals_deleted: number }> {
  const res = await postJson(`${PIPELINE_API}/api/discovery/run-clean`);
  return res.json();
}

export async function computeConfidence(): Promise<{ job_id: string }> {
  const res = await postJson(`${PIPELINE_API}/api/confidence/compute`);
  return res.json();
}

export async function dropRuleSignals(ruleId: number): Promise<{ signals_deleted: number; transits_deleted: number }> {
  const res = await postJson(`${PIPELINE_API}/api/discovery/rule/${ruleId}/drop-signals`);
  return res.json();
}

export async function runDiagnose(): Promise<Record<string, unknown>> {
  const res = await fetch(`${PIPELINE_API}/api/discovery/diagnose`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
