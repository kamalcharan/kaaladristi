import { useQuery } from '@tanstack/react-query';
import { fetchBookmarkMarketData, type BookmarkMarketData } from '@/services/bookmarks';

export function useBookmarkMarketData(equityIds: number[]) {
  const key = [...equityIds].sort((a, b) => a - b).join(',');
  const query = useQuery({
    queryKey: ['bookmark-market-data', key],
    queryFn: () => fetchBookmarkMarketData(equityIds),
    staleTime: 3 * 60 * 1000,
    enabled: equityIds.length > 0,
  });

  return {
    dataByEquity: query.data ?? new Map<number, BookmarkMarketData>(),
    isLoading: query.isLoading,
  };
}
