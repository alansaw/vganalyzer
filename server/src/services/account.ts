import type { Interval, MarketDataProvider, PricePoint, Quote } from '../providers/index.js';
import { distinctTickers, listTransactions } from '../repositories/transactions.js';
import {
  computeHoldings,
  computePortfolioHistory,
  valuePositions,
  type PortfolioSummary,
  type PositionValue,
  type Transaction,
} from './portfolio.js';
import { resolveIntrinsicValue } from './intrinsicValue.js';
import { computeMomentum3m } from './recommendations.js';
import { computeFactorScores, scoreStock, type StockMetrics } from './scoring.js';

// Ensure a quote carries an intrinsic value: keep the pinned one, else compute.
function withIv(q: Quote): Quote {
  return {
    ...q,
    iv: resolveIntrinsicValue(q.iv, { price: q.price, pe: q.pe, forwardPe: q.forwardPe, peg: q.peg }),
  };
}

export type Range = '1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '2y' | '5y';

const RANGE_DAYS: Record<Range, number> = {
  '1d': 1,
  '5d': 5,
  '1m': 31,
  '3m': 95,
  '6m': 186,
  '1y': 366,
  '2y': 731,
  '5y': 1827,
};

// Short ranges use intraday granularity so the chart isn't a single dot.
const RANGE_INTERVAL: Partial<Record<Range, Interval>> = {
  '1d': '60m',
  '5d': '60m',
};

export function rangeToFrom(range: Range, asOf = new Date()): Date {
  return new Date(asOf.getTime() - (RANGE_DAYS[range] ?? 366) * 24 * 60 * 60 * 1000);
}

export function rangeToInterval(range: Range): Interval {
  return RANGE_INTERVAL[range] ?? '1d';
}

async function quotesFor(provider: MarketDataProvider, tickers: string[]): Promise<Map<string, Quote>> {
  if (tickers.length === 0) return new Map();
  const quotes = await provider.getQuotes(tickers);
  return new Map(quotes.map((q) => [q.ticker, withIv(q)]));
}

export async function getPortfolioSummary(provider: MarketDataProvider): Promise<PortfolioSummary> {
  const txns = await listTransactions();
  const holdings = computeHoldings(txns);
  const openTickers = holdings.filter((h) => h.shares > 0).map((h) => h.ticker);
  const quotes = await quotesFor(provider, openTickers);
  return valuePositions(holdings, quotes);
}

export async function getPortfolioHistory(
  provider: MarketDataProvider,
  range: Range,
): Promise<PricePoint[]> {
  const txns = await listTransactions();
  if (txns.length === 0) return [];

  const tickers = await distinctTickers();
  const from = rangeToFrom(range);
  const to = new Date();
  const interval = rangeToInterval(range);

  const histories = new Map<string, PricePoint[]>();
  await Promise.all(
    tickers.map(async (t) => {
      const h = await provider.getHistory(t, { from, to, interval });
      if (h.length > 0) histories.set(t, h);
    }),
  );

  const series = computePortfolioHistory(txns, histories);
  // Works for both date-only (daily) and datetime (intraday) point keys.
  const fromDay = from.toISOString().slice(0, 10);
  return series.filter((p) => p.date >= fromDay);
}

export interface HoldingScore {
  ticker: string;
  name: string | null;
  score: number | null; // ungated factor score; null if PE/PEG unavailable
  eligible: boolean; // would it pass the recommendation gates?
  reason: string | null; // gate reason when ineligible
}

// Grade portfolio holdings with the same factor formula as recommendations,
// but WITHOUT the eligibility gates — you own these, so they get a score even
// when they would be excluded from the screen (the exclusion is reported).
export async function getHoldingScores(provider: MarketDataProvider): Promise<HoldingScore[]> {
  const txns = await listTransactions();
  const holdings = computeHoldings(txns).filter((h) => h.shares > 0);

  const out: HoldingScore[] = [];
  for (const h of holdings) {
    const raw = await provider.getQuote(h.ticker);
    if (!raw) {
      out.push({ ticker: h.ticker, name: null, score: null, eligible: false, reason: 'No quote available.' });
      continue;
    }
    const quote = withIv(raw);
    const momentum3m = await computeMomentum3m(provider, h.ticker);
    const iv = quote.iv ?? null;
    const ivDiscount =
      iv && quote.price !== null && iv.base > 0 ? (iv.base - quote.price) / iv.base : null;

    const metrics: StockMetrics = {
      ticker: h.ticker,
      pe: quote.forwardPe ?? quote.pe,
      peg: quote.peg,
      momentum3m,
      ivDiscount,
    };
    const factors = computeFactorScores(metrics);
    const gated = scoreStock(metrics);
    out.push({
      ticker: h.ticker,
      name: quote.name,
      score: factors?.score ?? null,
      eligible: gated.eligible,
      reason: gated.eligible ? null : gated.rationale,
    });
  }

  out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return out;
}

export interface PositionDetail {
  position: PositionValue | null;
  quote: Quote | null;
  history: PricePoint[];
  transactions: Transaction[];
}

export async function getPositionDetail(
  provider: MarketDataProvider,
  ticker: string,
  range: Range,
): Promise<PositionDetail> {
  const symbol = ticker.toUpperCase();
  const txns = await listTransactions(symbol);

  const [rawQuote, history] = await Promise.all([
    provider.getQuote(symbol),
    provider.getHistory(symbol, {
      from: rangeToFrom(range),
      to: new Date(),
      interval: rangeToInterval(range),
    }),
  ]);
  const quote = rawQuote ? withIv(rawQuote) : null;

  const holdings = computeHoldings(txns);
  const quotes = new Map<string, Quote>();
  if (quote) quotes.set(symbol, quote);
  const valued = valuePositions(holdings, quotes);
  const position = valued.positions.find((p) => p.ticker === symbol) ?? null;

  return { position, quote, history, transactions: txns };
}
