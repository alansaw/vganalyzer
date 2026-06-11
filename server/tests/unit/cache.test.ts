import { describe, expect, it, vi } from 'vitest';
import { CachingProvider } from '../../src/providers/cache.js';
import type { HistoryOptions, MarketDataProvider, Quote } from '../../src/providers/types.js';

function quote(ticker: string, price: number): Quote {
  return { ticker, name: ticker, price, currency: 'USD', pe: null, forwardPe: null, peg: null, eps: null, marketCap: null };
}

// Spy base provider that counts upstream calls.
function spyBase() {
  const calls = { getQuote: 0, getQuotes: 0, getHistory: 0 };
  const base: MarketDataProvider = {
    async getQuote(t) {
      calls.getQuote++;
      return quote(t, 100);
    },
    async getQuotes(ts) {
      calls.getQuotes++;
      return ts.map((t) => quote(t, 100));
    },
    async getHistory(_t, _o: HistoryOptions) {
      calls.getHistory++;
      return [{ date: '2026-06-05', close: 100 }];
    },
  };
  return { base, calls };
}

describe('CachingProvider', () => {
  it('serves repeated getQuote from cache within the TTL (one upstream call)', async () => {
    const { base, calls } = spyBase();
    const c = new CachingProvider(base, 60_000, 60_000);
    await c.getQuote('NVDA');
    await c.getQuote('NVDA');
    await c.getQuote('NVDA');
    expect(calls.getQuote).toBe(1);
  });

  it('only fetches uncached tickers in getQuotes', async () => {
    const { base, calls } = spyBase();
    const c = new CachingProvider(base, 60_000, 60_000);
    await c.getQuotes(['NVDA', 'SE']);
    const second = await c.getQuotes(['NVDA', 'SE', 'TCEHY']); // only TCEHY is new
    expect(calls.getQuotes).toBe(2);
    expect(second.map((q) => q.ticker).sort()).toEqual(['NVDA', 'SE', 'TCEHY']);
  });

  it('re-fetches after the TTL expires', async () => {
    let t = 1_000_000;
    const { base, calls } = spyBase();
    const c = new CachingProvider(base, 10_000, 10_000, 60_000, () => t);
    await c.getQuote('NVDA');
    t += 11_000; // advance past TTL
    await c.getQuote('NVDA');
    expect(calls.getQuote).toBe(2);
  });

  it('caches history and reuses it for the same range bucket', async () => {
    const { base, calls } = spyBase();
    const c = new CachingProvider(base, 60_000, 60_000);
    // Mirror real usage: from = now - rangeDays, to = now. A few hours later both
    // shift by the same delta, so the span (and cache key) is unchanged.
    const span = 92 * 86_400_000;
    const t1 = new Date('2026-06-01T00:00:00').getTime();
    await c.getHistory('NVDA', { from: new Date(t1 - span), to: new Date(t1), interval: '1d' });
    const t2 = t1 + 6 * 3_600_000;
    await c.getHistory('NVDA', { from: new Date(t2 - span), to: new Date(t2), interval: '1d' });
    expect(calls.getHistory).toBe(1);
  });

  it('caches failures only briefly (negative TTL)', async () => {
    let t = 0;
    let calls = 0;
    const base: MarketDataProvider = {
      async getQuote() {
        calls++;
        return null;
      },
      async getQuotes() {
        return [];
      },
      async getHistory() {
        return [];
      },
    };
    const c = new CachingProvider(base, 600_000, 600_000, 1_000, () => t);
    await c.getQuote('X'); // null cached for 1s
    t += 1_500;
    await c.getQuote('X'); // negative TTL expired -> refetch
    expect(calls).toBe(2);
  });
});
