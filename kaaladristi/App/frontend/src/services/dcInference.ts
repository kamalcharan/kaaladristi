import { from, rpc } from './postgrest';
import type { DcInference, DcInferenceInput } from '@/types';
import { toIso, getDaysInMonth } from '@/lib/dateUtils';

// ── Inference Evaluation ─────────────────────────────────────────────────────

export interface InferenceEvalRow {
  inference_id: number;
  astro_event: string;
  start_date: string;
  end_date: string | null;
  market_impact: string | null;
  eval_status: 'pending' | 'running' | 'completed';
  prev_close: number | null;
  peak_return_pct: number | null;
  trough_return_pct: number | null;
  final_return_pct: number | null;
  swing_attained: boolean | null;
  closed_direction: 'positive' | 'negative' | 'neutral' | null;
  outcome: 'worked' | 'partial' | 'failed' | 'inconclusive' | 'running' | 'pending' | 'turned';
  outcome_detail: string | null;
  pre_trend_pct: number | null;
  post_trend_pct: number | null;
  turn_direction: 'turned_positive' | 'turned_negative' | 'more_positive' | 'more_negative' | 'no_clear_turn' | null;
}

export interface EvalParams {
  indexName: string;
  minorThreshold: number;
  majorThreshold: number;
  lookbackDays: number;
}

export async function evaluateInferences(params: EvalParams): Promise<InferenceEvalRow[]> {
  const { data, error } = await rpc('evaluate_dc_inferences', {
    p_index_name:      params.indexName,
    p_minor_threshold: params.minorThreshold,
    p_major_threshold: params.majorThreshold,
    p_lookback_days:   params.lookbackDays,
  });
  if (error) throw new Error(`Evaluation failed: ${error.message}`);
  return (data ?? []) as InferenceEvalRow[];
}

const TABLE = 'dc_inference';

export async function fetchInferences(): Promise<DcInference[]> {
  const { data, error } = await from(TABLE)
    .select('*')
    .order('start_date', { ascending: false })
    .limit(500)
    .execute();

  if (error) throw new Error(`Failed to fetch inferences: ${error.message}`);
  return (data ?? []) as DcInference[];
}

/**
 * Fetch all inference entries active during [startDate, endDate] (ISO strings).
 * Includes multi-day events that overlap the range.
 */
export async function fetchInferencesForRange(startDate: string, endDate: string): Promise<DcInference[]> {
  const { data, error } = await from(TABLE)
    .select('*')
    .lte('start_date', endDate)
    .order('start_date', { ascending: true })
    .limit(500)
    .execute();

  if (error) throw new Error(`Failed to fetch inferences: ${error.message}`);

  // Single-day: end_date IS NULL → active only on start_date
  // Range: active when start_date <= day <= end_date
  return ((data ?? []) as DcInference[]).filter(r =>
    r.end_date === null ? r.start_date >= startDate : r.end_date >= startDate
  );
}
  const firstDay = toIso(year, month, 1);
  const lastDay  = toIso(year, month, getDaysInMonth(year, month));

  const { data, error } = await from(TABLE)
    .select('*')
    .lte('start_date', lastDay)
    .order('start_date', { ascending: true })
    .limit(500)
    .execute();

  if (error) throw new Error(`Failed to fetch inferences: ${error.message}`);

  // Keep events still active during this month:
  // null end_date = single-day event, must be within month
  // otherwise end_date must be >= firstDay
  return ((data ?? []) as DcInference[]).filter(r =>
    r.end_date === null ? r.start_date >= firstDay : r.end_date >= firstDay
  );
}

export async function createInference(input: DcInferenceInput): Promise<DcInference> {
  const { data, error } = await from(TABLE)
    .insert(input as Record<string, unknown>)
    .execute();

  if (error) throw new Error(`Failed to create inference: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Insert succeeded but returned no data');
  return row as DcInference;
}

export async function updateInference(id: number, patch: Partial<DcInferenceInput>): Promise<DcInference> {
  const { data, error } = await from(TABLE)
    .eq('id', id)
    .update(patch as Record<string, unknown>)
    .execute();

  if (error) throw new Error(`Failed to update inference: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Update succeeded but returned no data');
  return row as DcInference;
}

export async function deleteInference(id: number): Promise<void> {
  const { error } = await from(TABLE)
    .eq('id', id)
    .delete()
    .execute();

  if (error) throw new Error(`Failed to delete inference: ${error.message}`);
}
