import { useQuery } from '@tanstack/react-query';
import {
  fetchIndustryRotation,
  fetchIndustryStocks,
  type IndustryRotationData,
  type IndustryStockRow,
} from '@/services/industryRotation';

export function useIndustryRotation() {
  return useQuery<IndustryRotationData>({
    queryKey: ['industryRotation'],
    queryFn: fetchIndustryRotation,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useIndustryStocks(industry: string | null, tradeDate: string | null) {
  return useQuery<IndustryStockRow[]>({
    queryKey: ['industryStocks', industry, tradeDate],
    queryFn: () => fetchIndustryStocks(industry!, tradeDate!),
    enabled: !!industry && !!tradeDate,
    staleTime: 5 * 60 * 1000,
  });
}
