import { from } from './postgrest'
import type { InstrumentRef } from '@/types/framework'

export interface IndexOption extends InstrumentRef {
  display_name: string
}

export async function fetchActiveIndices(): Promise<IndexOption[]> {
  const { data, error } = await from('km_index_symbols')
    .select('id,name')
    .is('is_active', 'true')
    .order('name', { ascending: true })
    .execute()

  if (error || !data) return []

  return (data as { id: number; name: string }[]).map(row => ({
    id:           row.id,
    symbol:       row.name,   // km_index_symbols.name is the canonical display string
    display_name: row.name,
    type:         'index' as const,
  }))
}
