export interface PricePoint {
  date: string;
  close: number;
}

export interface IntrinsicValue {
  base: number;
  bear?: number | null;
  best?: number | null;
}

export interface Quote {
  ticker: string;
  name: string;
  price: number | null;
  currency: string;
  pe: number | null;
  forwardPe: number | null;
  peg: number | null;
  eps: number | null;
  marketCap: number | null;
  iv?: IntrinsicValue | null;
}

export interface PositionValue {
  ticker: string;
  name: string | null;
  shares: number;
  costBasis: number;
  avgCost: number;
  realized: number;
  price: number | null;
  currency: string | null;
  pe: number | null;
  peg: number | null;
  iv: IntrinsicValue | null;
  marketValue: number;
  unrealized: number;
  totalReturn: number;
  weight: number;
}

export interface PortfolioSummary {
  positions: PositionValue[];
  totalValue: number;
  totalCost: number;
  unrealized: number;
  realized: number;
  totalGain: number;
}

export interface Transaction {
  id: number;
  ticker: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  tradedOn: string;
  notes?: string | null;
}

export interface PositionDetail {
  position: PositionValue | null;
  quote: Quote | null;
  history: PricePoint[];
  transactions: Transaction[];
}

export interface Recommendation {
  ticker: string;
  name: string;
  market: string;
  price: number | null;
  pe: number | null;
  forwardPe: number | null;
  peg: number | null;
  iv: IntrinsicValue | null;
  momentum3m: number | null;
  score: number;
  rationale: string;
  rank: number;
  generatedAt: string;
}

export type Role = 'admin' | 'user';

export interface AuthInfo {
  role: Role;
  authEnabled: boolean;
}

export interface HoldingScore {
  ticker: string;
  name: string | null;
  score: number | null;
  eligible: boolean;
  reason: string | null;
}

export interface EtfView {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  aum: string;
  totalHoldings: number;
  recommendedCount: number;
  matches: string[];
  action: 'Buy' | 'Sell' | 'Hold' | null;
  avgDiscount: number | null;
  reason: string;
}

export interface PortfolioHistory {
  range: string;
  points: PricePoint[];
}

export type Range = '1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '2y' | '5y';

export interface NewTransaction {
  ticker: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  tradedOn: string;
  notes?: string;
}
