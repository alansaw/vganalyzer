import type { HistoryOptions, MarketDataProvider, PricePoint, Quote } from './types.js';

interface Entry<T> {
  value: T;
  expires: number;
}

/**
 * Wraps a provider with a small in-memory TTL cache so repeated requests for the
 * same ticker (every portfolio page load, every poll) are served from memory
 * instead of re-hitting the upstream API. This is the main defence against
 * Yahoo rate-limiting under normal app usage.
 *
 * Successful results are cached for the full TTL; failures (null quote / empty
 * history) are cached only briefly so a transient outage recovers quickly
 * without hammering the API in the meantime.
 */
export class CachingProvider implements MarketDataProvider {
  private readonly quoteCache = new Map<string, Entry<Quote | null>>();
  private readonly historyCache = new Map<string, Entry<PricePoint[]>>();

  constructor(
    private readonly base: MarketDataProvider,
    private readonly quoteTtlMs: number,
    private readonly historyTtlMs: number,
    private readonly negativeTtlMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  private fresh<T>(cache: Map<string, Entry<T>>, key: string): Entry<T> | undefined {
    const e = cache.get(key);
    if (e && e.expires > this.now()) return e;
    if (e) cache.delete(key);
    return undefined;
  }

  private ttlFor(ok: boolean, base: number): number {
    return this.now() + (ok ? base : this.negativeTtlMs);
  }

  async getQuote(ticker: string): Promise<Quote | null> {
    const key = ticker.toUpperCase();
    const hit = this.fresh(this.quoteCache, key);
    if (hit) return hit.value;
    const value = await this.base.getQuote(ticker);
    this.quoteCache.set(key, { value, expires: this.ttlFor(value !== null, this.quoteTtlMs) });
    return value;
  }

  // Pass the richer single-ticker quote straight through to the base (used by
  // the on-demand evaluator; not worth caching the same way as bulk quotes).
  async getQuoteWithRatios(ticker: string): Promise<Quote | null> {
    return this.base.getQuoteWithRatios ? this.base.getQuoteWithRatios(ticker) : this.base.getQuote(ticker);
  }

  async getQuotes(tickers: string[]): Promise<Quote[]> {
    // Only fetch the tickers we don't already have cached.
    const misses = tickers.filter((t) => !this.fresh(this.quoteCache, t.toUpperCase()));
    if (misses.length > 0) {
      const fetched = await this.base.getQuotes(misses);
      const byTicker = new Map(fetched.map((q) => [q.ticker.toUpperCase(), q]));
      for (const t of misses) {
        const q = byTicker.get(t.toUpperCase()) ?? null;
        this.quoteCache.set(t.toUpperCase(), { value: q, expires: this.ttlFor(q !== null, this.quoteTtlMs) });
      }
    }
    // Rebuild in input order from cache.
    const out: Quote[] = [];
    for (const t of tickers) {
      const e = this.fresh(this.quoteCache, t.toUpperCase());
      if (e?.value) out.push(e.value);
    }
    return out;
  }

  async getHistory(ticker: string, opts: HistoryOptions): Promise<PricePoint[]> {
    // Bucket by ~range length so a moving `to=now` doesn't bust the cache each call.
    const days = Math.round((opts.to.getTime() - opts.from.getTime()) / 86_400_000);
    const key = `${ticker.toUpperCase()}:${opts.interval ?? '1d'}:${days}`;
    const hit = this.fresh(this.historyCache, key);
    if (hit) return hit.value;
    const value = await this.base.getHistory(ticker, opts);
    this.historyCache.set(key, { value, expires: this.ttlFor(value.length > 0, this.historyTtlMs) });
    return value;
  }
}
