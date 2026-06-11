// Intrinsic value estimate. `base` is the central estimate; `bear`/`best`
// bound an optional range. Supplied via manual overrides (or a future DCF).
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
  pe: number | null; // trailing P/E
  forwardPe: number | null;
  peg: number | null;
  eps: number | null;
  marketCap: number | null;
  iv?: IntrinsicValue | null; // intrinsic value (from overrides), if known
}

export interface PricePoint {
  date: string; // ISO YYYY-MM-DD
  close: number;
}

export type Interval = '5m' | '15m' | '30m' | '60m' | '1h' | '1d' | '1wk' | '1mo';

export interface HistoryOptions {
  from: Date;
  to: Date;
  interval?: Interval;
}

const INTRADAY = new Set<Interval>(['5m', '15m', '30m', '60m', '1h']);
export function isIntraday(interval?: Interval): boolean {
  return interval !== undefined && INTRADAY.has(interval);
}

export interface MarketDataProvider {
  getQuote(ticker: string): Promise<Quote | null>;
  getQuotes(tickers: string[]): Promise<Quote[]>;
  getHistory(ticker: string, opts: HistoryOptions): Promise<PricePoint[]>;
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
