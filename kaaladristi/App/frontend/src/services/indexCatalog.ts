import { from, rpc } from './postgrest';
import type { IndexCatalogItem } from '@/types';

export async function fetchIndexCatalog(): Promise<IndexCatalogItem[]> {
  const { data, error } = await from('mv_index_catalog')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })
    .execute();

  if (error) throw new Error(`Failed to fetch index catalog: ${error.message}`);
  return (data ?? []) as IndexCatalogItem[];
}

export async function toggleIndexActive(id: number, isActive: boolean): Promise<void> {
  const { error } = await from('km_index_symbols')
    .eq('id', id)
    .update({ is_active: isActive } as Record<string, unknown>)
    .execute();

  if (error) throw new Error(`Failed to update index: ${error.message}`);

  // Refresh the materialized view so the catalog reflects the change
  await rpc('refresh_index_catalog');
}
