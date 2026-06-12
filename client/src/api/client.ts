import type {
  AuthInfo,
  HoldingScore,
  NewTransaction,
  PortfolioHistory,
  PortfolioSummary,
  PositionDetail,
  PositionValue,
  Range,
  Recommendation,
  Transaction,
} from '../types';

const BASE = '/api';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    // Session expired mid-use: tell the auth layer to re-check and show the
    // login page. Only for DATA endpoints — a 401 from /auth/* itself must not
    // re-trigger the auth check (that would loop on the login screen).
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event('vg:unauthorized'));
    }
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getMe: () => http<AuthInfo>('/auth/me'),
  login: (username: string, password: string) =>
    http<AuthInfo>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => http<void>('/auth/logout', { method: 'POST' }),
  getPortfolio: () => http<PortfolioSummary>('/portfolio'),
  getPortfolioHistory: (range: Range) => http<PortfolioHistory>(`/portfolio/history?range=${range}`),
  getPortfolioScores: () => http<HoldingScore[]>('/portfolio/scores'),
  getPositions: () => http<PositionValue[]>('/positions'),
  getPositionDetail: (ticker: string, range: Range) =>
    http<PositionDetail>(`/positions/${encodeURIComponent(ticker)}?range=${range}`),
  getTransactions: (ticker?: string) =>
    http<Transaction[]>(`/transactions${ticker ? `?ticker=${encodeURIComponent(ticker)}` : ''}`),
  addTransaction: (tx: NewTransaction) =>
    http<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(tx) }),
  deleteTransaction: (id: number) =>
    http<void>(`/transactions/${id}`, { method: 'DELETE' }),
  getRecommendations: () => http<Recommendation[]>('/recommendations'),
  refreshRecommendations: () =>
    http<Recommendation[]>('/recommendations/refresh', { method: 'POST' }),
};
