import { describe, expect, it } from 'vitest';
import { OverrideProvider, type Overrides } from '../../src/providers/override.js';
import { MockProvider } from '../../src/providers/mock.js';

const overrides: Overrides = {
  NVDA: { price: 205.1, peg: 0.46, iv: { bear: 175, base: 250, best: 330 } },
  SE: { price: 86.56, peg: 0.34, iv: { base: 125 } },
  TCEHY: { price: 56.9, peg: 0.81 },
};

describe('OverrideProvider', () => {
  it('forces overridden price and PEG, keeps other fields from the base', async () => {
    const p = new OverrideProvider(new MockProvider(), overrides);
    const q = await p.getQuote('NVDA');
    expect(q?.price).toBe(205.1);
    expect(q?.peg).toBe(0.46);
    expect(q?.iv).toEqual({ bear: 175, base: 250, best: 330 });
    expect(q?.pe).not.toBeNull(); // pe still flows from the base (not overridden)
  });

  it('leaves non-overridden tickers untouched', async () => {
    const base = new MockProvider();
    const p = new OverrideProvider(base, overrides);
    const [baseQuote] = await base.getQuotes(['AAPL']);
    const q = await p.getQuote('AAPL');
    expect(q?.price).toBe(baseQuote.price);
    expect(q?.iv ?? null).toBeNull();
  });

  it('synthesizes a quote when the base cannot price an overridden ticker', async () => {
    const empty = {
      getQuote: async () => null,
      getQuotes: async () => [],
      getHistory: async () => [],
    };
    const p = new OverrideProvider(empty, overrides);
    const q = await p.getQuote('SE');
    expect(q).toMatchObject({ ticker: 'SE', price: 86.56, peg: 0.34, currency: 'USD' });
    expect(q?.iv).toEqual({ base: 125 });
  });

  it('applies overrides across getQuotes preserving order', async () => {
    const p = new OverrideProvider(new MockProvider(), overrides);
    const quotes = await p.getQuotes(['NVDA', 'AAPL', 'TCEHY']);
    expect(quotes.map((q) => q.ticker)).toEqual(['NVDA', 'AAPL', 'TCEHY']);
    const byTicker = new Map(quotes.map((q) => [q.ticker, q.price]));
    expect(byTicker.get('NVDA')).toBe(205.1);
    expect(byTicker.get('TCEHY')).toBe(56.9);
  });

  it('scales history so the final point equals the override price', async () => {
    const p = new OverrideProvider(new MockProvider(), overrides);
    const hist = await p.getHistory('NVDA', {
      from: new Date(Date.now() - 30 * 864e5),
      to: new Date(),
      interval: '1d',
    });
    expect(hist.length).toBeGreaterThan(0);
    expect(hist[hist.length - 1].close).toBeCloseTo(205.1, 1);
  });
});
