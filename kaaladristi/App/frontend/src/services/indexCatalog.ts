import { from } from './postgrest';
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
