import { rpc } from './postgrest';
import type { ConvictionFlowStock } from '@/types';

export async function fetchConvictionFlow(date?: string): Promise<ConvictionFlowStock[]> {
  const params: Record<string, unknown> = date ? { p_date: date } : {};
  const { data, error } = await rpc('get_conviction_flow', params);
  if (error) throw new Error(`[conviction_flow] ${error.message}`);
  return (data ?? []) as ConvictionFlowStock[];
}
