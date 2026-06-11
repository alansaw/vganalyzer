import yahooFinanceDefault from 'yahoo-finance2';
import {
  type HistoryOptions,
  type MarketDataProvider,
  type PricePoint,
  type Quote,
  num,
  toISODate,
} from './types.js';

// In yahoo-finance2 v2 the default export is the `YahooFinance` CLASS — the
// callable methods (quoteSummary/chart/suppressNotices) live on instances, not
// on the export itself. The bundled .d.ts doesn't surface them cleanly either,
// so we describe the slice of the instance API we use.
interface QuoteSummaryResult {
  price?: {
    longName?: string;
    shortName?: string;
    regularMarketPrice?: number;
    currency?: string;
    marketCap?: number;
  };
  summaryDetail?: { trailingPE?: number; forwardPE?: number };
  defaultKeyStatistics?: { forwardPE?: number; pegRatio?: number; trailingEps?: number };
  financialData?: { earningsGrowth?: number; revenueGrowth?: number };
}

interface ChartResult {
  quotes: Array<{ date?: Date | string | number; close?: number | null }>;
}

interface YahooFinanceInstance {
  suppressNotices(notices: string[]): void;
  quoteSummary(symbol: string, opts: { modules: string[] }): Promise<QuoteSummaryResult>;
  chart(
    symbol: string,
    opts: { period1: Date; period2: Date; interval?: string },
  ): Promise<ChartResult>;
}

type YahooFinanceConstructor = new () => YahooFinanceInstance;

// yahoo-finance2's default export has shifted between releases: in some it's a
// ready-made singleton (methods directly on the object), in others it's the
// `YahooFinance` class you must `new`. Resolve both so a version bump can't
// silently break live data. Lazy so importing this module (e.g. when the mock
// provider is selected) never runs Yahoo setup.
let client: YahooFinanceInstance | null = null;
function getClient(): YahooFinanceInstance {
  if (!client) {
    const exported = yahooFinanceDefault as unknown;
    const maybeInstance = exported as Partial<YahooFinanceInstance>;
    if (typeof maybeInstance.quoteSummary === 'function') {
      client = maybeInstance as YahooFinanceInstance; // singleton form
    } else if (typeof exported === 'function') {
      const Ctor = exported as YahooFinanceConstructor; // class form
      client = new Ctor();
    } else {
      throw new Error('yahoo-finance2: unrecognised default export shape');
    }
    try {
      client.suppressNotices(['yahooSurvey']);
    } catch {
      // older builds may not expose suppressNotices — non-fatal
    }
  }
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimit(err: unknown): boolean {
  const msg = (err as Error)?.message ?? '';
  return /too many requests|429|rate limit/i.test(msg);
}

// Retry transient Yahoo failures (esp. HTTP 429) with exponential backoff +
// jitter. Yahoo throttles bursts aggressively, so a few spaced retries usually
// get through where an immediate parallel fan-out fails.
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !isRateLimit(err)) break;
      const backoff = 600 * 2 ** i + Math.floor(Math.random() * 300);
      console.warn(`[yahoo] rate-limited on ${label}; retry ${i + 1}/${attempts - 1} in ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

// Run async tasks with bounded concurrency so we don't fan out dozens of
// simultaneous requests and trip Yahoo's rate limiter.
async function mapLimit<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]> {
  const results = new Array<O>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

export class YahooProvider implements MarketDataProvider {
  async getQuote(ticker: string): Promise<Quote | null> {
    const [q] = await this.getQuotes([ticker]);
    return q ?? null;
  }

  async getQuotes(tickers: string[]): Promise<Quote[]> {
    const results = await mapLimit(tickers, 3, (t) => this.fetchOne(t));
    return results.filter((q): q is Quote => q !== null);
  }

  private async fetchOne(ticker: string): Promise<Quote | null> {
    try {
      const summary = await withRetry(
        () =>
          getClient().quoteSummary(ticker, {
            modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData'],
          }),
        `quote ${ticker}`,
      );
      const price = summary.price;
      const detail = summary.summaryDetail;
      const stats = summary.defaultKeyStatistics;
      const financial = summary.financialData;

      const pe = num(detail?.trailingPE);
      // Yahoo frequently returns null pegRatio nowadays. Fall back to the
      // textbook definition: PEG = P/E ÷ (annual earnings growth %).
      // earningsGrowth is a fraction (0.15 = 15%), so PEG = pe / (growth * 100).
      const growth = num(financial?.earningsGrowth);
      const pegFallback = pe !== null && growth !== null && growth > 0 ? pe / (growth * 100) : null;

      return {
        ticker,
        name: price?.longName ?? price?.shortName ?? ticker,
        price: num(price?.regularMarketPrice),
        currency: price?.currency ?? 'USD',
        pe,
        forwardPe: num(detail?.forwardPE ?? stats?.forwardPE),
        peg: num(stats?.pegRatio) ?? pegFallback,
        eps: num(stats?.trailingEps),
        marketCap: num(price?.marketCap),
      };
    } catch (err) {
      console.warn(`[yahoo] quote failed for ${ticker}: ${(err as Error).message}`);
      return null;
    }
  }

  async getHistory(ticker: string, opts: HistoryOptions): Promise<PricePoint[]> {
    try {
      const chart = await withRetry(
        () =>
          getClient().chart(ticker, {
            period1: opts.from,
            period2: opts.to,
            interval: opts.interval ?? '1d',
          }),
        `history ${ticker}`,
      );
      return chart.quotes
        .filter((q) => q.close != null && q.date != null)
        .map((q) => ({
          date: toISODate(new Date(q.date as string | number | Date)),
          close: Number(q.close),
        }));
    } catch (err) {
      console.warn(`[yahoo] history failed for ${ticker}: ${(err as Error).message}`);
      return [];
    }
  }
}
