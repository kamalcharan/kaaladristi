import { from } from './postgrest';
import type { DcInference, DcInferenceInput } from '@/types';

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

export async function createInference(input: DcInferenceInput): Promise<DcInference> {
  const { data, error } = await from(TABLE)
    .insert(input as Record<string, unknown>)
    .execute();

  if (error) throw new Error(`Failed to create inference: ${error.message}`);
  // PostgREST returns array on insert with Prefer: return=representation
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
