import { from } from '@/services/postgrest';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RuleInput {
  rule_code: string;
  rule_type: string;
  display_name: string;
  outcome: string;
  base_bias?: string | null;
  scope?: string[] | null;
  probability_label?: string | null;
  conditions?: Record<string, unknown> | null;
  remarks?: string | null;
}

export interface AstroRuleFull {
  id: number;
  rule_code: string;
  rule_type: string;
  display_name: string;
  outcome: string | null;
  base_bias: string | null;
  scope: string[] | null;
  probability_label: string | null;
  probability: string | null;     // legacy column from migration 047
  data_source: string | null;
  remarks: string | null;
  conditions: Record<string, unknown> | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string | null;
}

const TABLE = 'km_astro_rule_master';

// ── CRUD functions ────────────────────────────────────────────────────────────

export async function createRule(input: RuleInput): Promise<AstroRuleFull> {
  const { data, error } = await from(TABLE)
    .insert({
      ...input,
      is_active: true,
      is_deleted: false,
      data_source: 'user_defined',
    } as Record<string, unknown>)
    .execute();

  if (error) {
    if (error.message.includes('unique') || error.code === '23505') {
      throw new Error('Rule code already exists — choose a different code');
    }
    throw new Error(`Failed to create rule: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Insert succeeded but returned no data');
  return row as AstroRuleFull;
}

export async function updateRule(id: number, patch: Partial<RuleInput>): Promise<void> {
  const { error } = await from(TABLE)
    .eq('id', id)
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .execute();

  if (error) throw new Error(`Failed to update rule: ${error.message}`);
}

export async function toggleRuleActive(id: number, isActive: boolean): Promise<void> {
  const { error } = await from(TABLE)
    .eq('id', id)
    .update({ is_active: isActive } as Record<string, unknown>)
    .execute();

  if (error) throw new Error(`Failed to toggle rule: ${error.message}`);
}

export async function softDeleteRule(id: number): Promise<void> {
  const { error } = await from(TABLE)
    .eq('id', id)
    .update({ is_deleted: true, is_active: false } as Record<string, unknown>)
    .execute();

  if (error) throw new Error(`Failed to delete rule: ${error.message}`);
}
