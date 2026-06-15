import { describe, expect, it } from 'vitest';
import { OverrideProvider, type Overrides } from '../../src/providers/override.js';
import { MockProvider } from '../../src/providers/mock.js';
import type { HistoryOptions, MarketDataProvider, Quote } from '../../src/providers/types.js';

const overrides: Overrides = {
  NVDA: { price: 205.1, peg: 0.46, iv: { bear: 175, base: 250, best: 330 } },
  SE: { price: 86.56, peg: 0.34, iv: { base: 125 } },
  TCEHY: { price: 56.9, peg: 0.81 },
};

// A base that returns a live price, so we can prove the pinned price does NOT win.
function liveBase(price: number): MarketDataProvider {
  const q = (t: string): Quote => ({
    ticker: t, name: t, price, currency: 'USD', pe: 30, forwardPe: 20, peg: null, eps: 5, marketCap: 1,
  });
  return {
    getQuote: async (t) => q(t),
    getQuotes: async (ts) => ts.map(q),
    getHistory: async (_t, _o: HistoryOptions) => [{ date: '2026-06-15', close: price }],
  };
}

describe('OverrideProvider', () => {
  it('lets the LIVE price win and only overlays pe/peg/iv (price no longer frozen)', async () => {
    const p = new OverrideProvider(liveBase(212.45), overrides);
    const q = await p.getQuote('NVDA');
    expect(q?.price).toBe(212.45); // live, not the pinned 205.1
    expect(q?.peg).toBe(0.46); // overlaid
    expect(q?.iv).toEqual({ bear: 175, base: 250, best: 330 });
  });

  it('uses the pinned price only as a FALLBACK when the base has none', async () => {
    const noPrice: MarketDataProvider = {
      getQuote: async () => null,
      getQuotes: async () => [],
      getHistory: async () => [],
    };
    const p = new OverrideProvider(noPrice, overrides);
    const q = await p.getQuote('SE');
    expect(q).toMatchObject({ ticker: 'SE', price: 86.56, peg: 0.34, currency: 'USD' });
    expect(q?.iv).toEqual({ base: 125 });
  });

  it('leaves non-overridden tickers untouched', async () => {
    const base = new MockProvider();
    const p = new OverrideProvider(base, overrides);
    const [baseQuote] = await base.getQuotes(['AAPL']);
    const q = await p.getQuote('AAPL');
    expect(q?.price).toBe(baseQuote.price);
    expect(q?.iv ?? null).toBeNull();
  });

  it('applies overlays across getQuotes preserving order, keeping live prices', async () => {
    const p = new OverrideProvider(liveBase(100), overrides);
    const quotes = await p.getQuotes(['NVDA', 'AAPL', 'TCEHY']);
    expect(quotes.map((q) => q.ticker)).toEqual(['NVDA', 'AAPL', 'TCEHY']);
    expect(quotes.every((q) => q.price === 100)).toBe(true); // live price preserved
    expect(quotes.find((q) => q.ticker === 'NVDA')?.peg).toBe(0.46);
  });

  it('passes history through unchanged (no rescaling to a pinned price)', async () => {
    const p = new OverrideProvider(liveBase(212.45), overrides);
    const hist = await p.getHistory('NVDA', { from: new Date('2026-06-01'), to: new Date(), interval: '1d' });
    expect(hist).toEqual([{ date: '2026-06-15', close: 212.45 }]);
  });
});
