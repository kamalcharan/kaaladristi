import { from } from '@/services/postgrest';

// ── Types ─────────────────────────────────────────────────────────────────────

// List-view type (subset of AstroRuleFull — used by RuleList and CatalogAstroSection)
export interface AstroRule {
  id: number;
  rule_code: string;
  rule_type: string;
  display_name: string;
  outcome: string | null;
  base_bias: string | null;
  scope: string[] | null;
  probability_label: string | null;
  data_source: string | null;
  is_active: boolean;
  catalog_visible: boolean;
  remarks: string | null;
}

export interface RuleConfidence {
  rule_id: number;
  confidence_score: number | null;
}

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

// ── Query functions ───────────────────────────────────────────────────────────

export async function fetchRules(): Promise<AstroRule[]> {
  const { data, error } = await from(TABLE)
    .select('id,rule_code,rule_type,display_name,outcome,base_bias,scope,probability_label,data_source,is_active,catalog_visible,remarks')
    .is('is_deleted', 'false')
    .order('rule_type')
    .order('rule_code')
    .execute();
  if (error) throw new Error(error.message);
  return (data as AstroRule[]) ?? [];
}

/** Catalog-only fetch: admin-approved rules visible to end users. */
export async function fetchCatalogRules(): Promise<AstroRule[]> {
  const { data, error } = await from(TABLE)
    .select('id,rule_code,rule_type,display_name,outcome,base_bias,scope,probability_label,data_source,is_active,catalog_visible,remarks')
    .is('is_deleted', 'false')
    .eq('catalog_visible', 'true')
    .eq('is_active', 'true')
    .order('rule_type')
    .order('rule_code')
    .execute();
  if (error) throw new Error(error.message);
  return (data as AstroRule[]) ?? [];
}

export async function fetchConfidence(): Promise<RuleConfidence[]> {
  const { data, error } = await from('km_rule_confidence')
    .select('rule_id,confidence_score')
    .execute();
  if (error) throw new Error(error.message);
  return (data as RuleConfidence[]) ?? [];
}

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
