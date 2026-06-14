import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { NewTransaction, Range } from '../types';

export function usePortfolio() {
  return useQuery({ queryKey: ['portfolio'], queryFn: api.getPortfolio });
}

export function usePortfolioHistory(range: Range) {
  return useQuery({
    queryKey: ['portfolio', 'history', range],
    queryFn: () => api.getPortfolioHistory(range),
  });
}

export function usePortfolioScores() {
  return useQuery({ queryKey: ['portfolio', 'scores'], queryFn: api.getPortfolioScores });
}

export function usePositions() {
  return useQuery({ queryKey: ['positions'], queryFn: api.getPositions });
}

export function usePositionDetail(ticker: string, range: Range) {
  return useQuery({
    queryKey: ['position', ticker, range],
    queryFn: () => api.getPositionDetail(ticker, range),
    enabled: Boolean(ticker),
  });
}

export function useRecommendations() {
  return useQuery({ queryKey: ['recommendations'], queryFn: api.getRecommendations });
}

export function useEtfs() {
  return useQuery({ queryKey: ['etfs'], queryFn: api.getEtfs });
}

export function useRefreshRecommendations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.refreshRecommendations,
    onSuccess: (data) => qc.setQueryData(['recommendations'], data),
  });
}

function invalidatePortfolio(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['portfolio'] });
  qc.invalidateQueries({ queryKey: ['positions'] });
  qc.invalidateQueries({ queryKey: ['position'] });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tx: NewTransaction) => api.addTransaction(tx),
    onSuccess: () => invalidatePortfolio(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteTransaction(id),
    onSuccess: () => invalidatePortfolio(qc),
  });
}
