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
  tags: string[];
}

export interface RuleConfidence {
  rule_id: number;
  confidence_score: number | null;
  total_occurrences: number | null;
  avg_return_matched: number | null;
  /** Which hypothesis the numbers were tested against (migration 138):
   *  'inference' = the rule's active expert inference; 'base_bias' = seeded fallback. */
  hypothesis_source: 'inference' | 'base_bias' | null;
  /** The tested claim's impact value at scoring time (12-value vocabulary). */
  hypothesis_impact: string | null;
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
  tags?: string[];
  catalog_visible?: boolean;
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
  catalog_visible: boolean;
  tags: string[];
  created_at: string;
  updated_at: string | null;
}

const TABLE = 'km_astro_rule_master';

// ── Query functions ───────────────────────────────────────────────────────────

export async function fetchRules(): Promise<AstroRule[]> {
  const { data, error } = await from(TABLE)
    .select('id,rule_code,rule_type,display_name,outcome,base_bias,scope,probability_label,data_source,is_active,catalog_visible,remarks,tags')
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
    .select('id,rule_code,rule_type,display_name,outcome,base_bias,scope,probability_label,data_source,is_active,catalog_visible,remarks,tags')
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
  // total_occurrences + avg_return_matched feed the chart band tooltip's
  // at-a-glance stats line (Overlap Visibility Phase 2) — same shared
  // ['rule-engine','confidence'] query Catalog + Rules already use.
  const { data, error } = await from('km_rule_confidence')
    .select('rule_id,confidence_score,total_occurrences,avg_return_matched,hypothesis_source,hypothesis_impact')
    .execute();
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as RuleConfidence[]) : [];
}

export interface TransitDateInfo {
  rule_id: number;
  last_end: string | null;   // most recent end_date on or before today
  next_start: string | null; // earliest start_date on or after today
}

/**
 * Fetch last + next transit dates for all rules from km_rule_transits.
 * Uses two queries (past/future) with a 3-year window each, then reduces
 * per rule_id in JS. Suitable for the admin rules table — stale 5 min.
 */
export async function fetchTransitDates(): Promise<TransitDateInfo[]> {
  const today = new Date().toISOString().slice(0, 10);
  const past3y = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const future3y = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [pastRes, futureRes] = await Promise.all([
    from('km_rule_transits')
      .select('rule_id,end_date')
      .gte('end_date', past3y)
      .lte('end_date', today)
      .order('end_date', { ascending: false })
      .limit(5000)
      .execute(),
    from('km_rule_transits')
      .select('rule_id,start_date')
      .gte('start_date', today)
      .lte('start_date', future3y)
      .order('start_date')
      .limit(5000)
      .execute(),
  ]);

  if (pastRes.error) throw new Error(pastRes.error.message);
  if (futureRes.error) throw new Error(futureRes.error.message);

  const map = new Map<number, TransitDateInfo>();

  for (const row of (pastRes.data as { rule_id: number; end_date: string }[]) ?? []) {
    if (!map.has(row.rule_id)) {
      map.set(row.rule_id, { rule_id: row.rule_id, last_end: row.end_date, next_start: null });
    }
    // rows ordered DESC — first seen is already the most recent
  }

  for (const row of (futureRes.data as { rule_id: number; start_date: string }[]) ?? []) {
    if (!map.has(row.rule_id)) {
      map.set(row.rule_id, { rule_id: row.rule_id, last_end: null, next_start: row.start_date });
    } else {
      const entry = map.get(row.rule_id)!;
      if (!entry.next_start) entry.next_start = row.start_date;
      // rows ordered ASC — first seen is already the earliest upcoming
    }
  }

  return Array.from(map.values());
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

export async function toggleCatalogVisible(id: number, visible: boolean): Promise<void> {
  const { error } = await from(TABLE)
    .eq('id', id)
    .update({ catalog_visible: visible } as Record<string, unknown>)
    .execute();

  if (error) throw new Error(`Failed to toggle catalog visibility: ${error.message}`);
}

export async function softDeleteRule(id: number): Promise<void> {
  const { error } = await from(TABLE)
    .eq('id', id)
    .update({ is_deleted: true, is_active: false } as Record<string, unknown>)
    .execute();

  if (error) throw new Error(`Failed to delete rule: ${error.message}`);
}
