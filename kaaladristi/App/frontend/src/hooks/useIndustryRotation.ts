import { useQuery } from '@tanstack/react-query';
import {
  fetchIndustryRotation,
  fetchIndustryStocks,
  fetchFullIndustryTransition,
  fetchIndustryTransitionStocks,
  fetchIndustryLeadershipMap,
  type IndustryRotationData,
  type IndustryStockRow,
  type IndustryTransitionData,
  type IndustryTransitionStocksResult,
  type IndustryLeadershipMap,
} from '@/services/industryRotation';

export function useIndustryRotation() {
  return useQuery<IndustryRotationData>({
    queryKey: ['industryRotation'],
    queryFn: fetchIndustryRotation,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useIndustryTransition() {
  return useQuery<IndustryTransitionData>({
    queryKey: ['industryTransition'],
    queryFn: fetchFullIndustryTransition,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useIndustryTransitionStocks() {
  return useQuery<IndustryTransitionStocksResult>({
    queryKey: ['industryTransitionStocks'],
    queryFn: fetchIndustryTransitionStocks,
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

export function useIndustryLeadershipMap(tradeDate: string | null) {
  return useQuery<IndustryLeadershipMap>({
    queryKey: ['industryLeadershipMap', tradeDate],
    queryFn: () => fetchIndustryLeadershipMap(tradeDate!),
    enabled: !!tradeDate,
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
