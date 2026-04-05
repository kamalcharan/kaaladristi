import { from } from './postgrest';

export interface DcLookupItem {
  id: number;
  category: 'sector' | 'index' | 'commodity';
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export async function fetchLookupByCategory(
  category: 'sector' | 'index' | 'commodity',
): Promise<DcLookupItem[]> {
  const { data, error } = await from('dc_lookup')
    .select('id,category,code,label,sort_order,is_active')
    .eq('category', category)
    .eq('is_active', 'true')
    .order('sort_order', { ascending: true })
    .execute();

  if (error) throw new Error(error.message);
  return (data ?? []) as DcLookupItem[];
}

export async function fetchAllLookups(): Promise<DcLookupItem[]> {
  const { data, error } = await from('dc_lookup')
    .select('id,category,code,label,sort_order,is_active')
    .eq('is_active', 'true')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .execute();

  if (error) throw new Error(error.message);
  return (data ?? []) as DcLookupItem[];
}
