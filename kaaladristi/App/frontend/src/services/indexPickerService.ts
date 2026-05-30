import { from } from './postgrest'
import type { InstrumentRef } from '@/types/framework'

export interface IndexOption extends InstrumentRef {
  display_name: string
}

export async function fetchActiveIndices(): Promise<IndexOption[]> {
  const { data, error } = await from('km_index_symbols')
    .select('id,symbol,display_name')
    .is('is_active', 'true')
    .order('display_name', { ascending: true })
    .execute()

  if (error || !data) return []

  return (data as { id: number; symbol: string; display_name: string }[]).map(row => ({
    id: row.id,
    symbol: row.symbol,
    display_name: row.display_name,
    type: 'index' as const,
  }))
}
