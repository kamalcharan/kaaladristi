import { from } from './postgrest';
import type { DcInference, DcInferenceInput } from '@/types';
import { toIso, getDaysInMonth } from '@/lib/dateUtils';

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
 * Fetch all inference entries active during a given month.
 * Includes multi-month events (e.g. Saturn-Mars Conjunction Apr–May).
 */
export async function fetchInferencesForMonth(year: number, month: number): Promise<DcInference[]> {
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
