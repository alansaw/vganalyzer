import {
  type HistoryOptions,
  type MarketDataProvider,
  type PricePoint,
  type Quote,
  isIntraday,
  toISODate,
} from './types.js';

// Real daily price history from stockanalysis.com (no API key):
//  - US listings:  /api/symbol/s/{sym}/history?range=5Y  -> JSON OHLCV (5y daily)
//  - TSX (.TO) and OTC listings: the quote page HTML embeds a ~1y daily series
//    as `{c:<close>,t:<unix>}` pairs.
// Used so charts show actual market history instead of the mock provider's
// synthetic sine-wave series, and as a rescue when Yahoo is rate-limited.

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// Keep request bursts polite: the recommendations engine fans out the whole
// universe at once, so gate concurrent fetches.
const MAX_CONCURRENT = 4;
let active = 0;
const waiters: Array<() => void> = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((r) => waiters.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}

export function parseApiSeries(json: unknown): PricePoint[] {
  const data = (json as { data?: Array<{ t?: string; c?: number }> })?.data;
  if (!Array.isArray(data)) return [];
  return data
    .filter((d) => typeof d.t === 'string' && typeof d.c === 'number' && Number.isFinite(d.c))
    .map((d) => ({ date: (d.t as string).slice(0, 10), close: d.c as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Extract `{c:<num>,t:<unixSeconds>}` pairs from quote-page HTML. Collapses to
// one point per calendar day (last value wins) so an intraday series cannot
// masquerade as months of history.
export function parsePageSeries(html: string): PricePoint[] {
  const byDate = new Map<string, number>();
  for (const m of html.matchAll(/\{c:([0-9.]+),t:(\d{9,11})\}/g)) {
    const date = toISODate(new Date(Number(m[2]) * 1000));
    byDate.set(date, Number(m[1]));
  }
  return [...byDate.entries()]
    .map(([date, close]) => ({ date, close }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Full available daily series (ascending) for a ticker, from the right source.
export async function fetchStockAnalysisHistory(ticker: string): Promise<PricePoint[]> {
  return withSlot(async () => {
    if (ticker.endsWith('.TO')) {
      const base = ticker.slice(0, -3);
      return parsePageSeries(await getText(`https://stockanalysis.com/quote/tsx/${base}/`));
    }
    try {
      const text = await getText(
        `https://stockanalysis.com/api/symbol/s/${ticker.toLowerCase()}/history?range=5Y`,
      );
      const series = parseApiSeries(JSON.parse(text));
      if (series.length > 0) return series;
    } catch {
      // not a US listing (or transient) — try the OTC quote page
    }
    return parsePageSeries(await getText(`https://stockanalysis.com/quote/otc/${ticker}/`));
  });
}

export type HistoryFetcher = (ticker: string) => Promise<PricePoint[]>;

// Wraps a base provider, replacing DAILY history with the real series.
//  - preferReal=true  (mock base): real history first, base as fallback.
//  - preferReal=false (yahoo base): base first, real history as rescue.
// Intraday requests (1D/5D charts) always go to the base provider.
export class RealHistoryProvider implements MarketDataProvider {
  constructor(
    private readonly base: MarketDataProvider,
    private readonly fetcher: HistoryFetcher = fetchStockAnalysisHistory,
    private readonly preferReal = true,
  ) {}

  getQuote(ticker: string): Promise<Quote | null> {
    return this.base.getQuote(ticker);
  }

  getQuotes(tickers: string[]): Promise<Quote[]> {
    return this.base.getQuotes(tickers);
  }

  async getHistory(ticker: string, opts: HistoryOptions): Promise<PricePoint[]> {
    if (isIntraday(opts.interval)) return this.base.getHistory(ticker, opts);

    const real = async (): Promise<PricePoint[]> => {
      try {
        const from = toISODate(opts.from);
        const to = toISODate(opts.to);
        return (await this.fetcher(ticker)).filter((p) => p.date >= from && p.date <= to);
      } catch (err) {
        console.warn(`[history] real series failed for ${ticker}: ${(err as Error).message}`);
        return [];
      }
    };

    if (this.preferReal) {
      const series = await real();
      if (series.length >= 2) return series;
      return this.base.getHistory(ticker, opts);
    }
    const series = await this.base.getHistory(ticker, opts);
    if (series.length >= 2) return series;
    return real();
  }
}
