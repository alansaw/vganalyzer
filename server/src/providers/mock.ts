import {
  type HistoryOptions,
  type MarketDataProvider,
  type PricePoint,
  type Quote,
  isIntraday,
  toISODate,
} from './types.js';

// Deterministic, offline market data used for tests, E2E and the seeded demo.
// Every metric is a pure function of the ticker string, so results are stable.

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff; // 0..1
}

interface Fixture {
  name: string;
  currency: string;
  price: number;
  pe: number | null;
  peg: number | null;
  momentum3m: number; // fractional 3-month return baked into history
}

// A handful of hand-tuned fixtures so the demo has recognisable, sensible numbers.
const FIXTURES: Record<string, Fixture> = {
  AAPL: { name: 'Apple Inc.', currency: 'USD', price: 190.12, pe: 31.2, peg: 2.6, momentum3m: 0.14 },
  INTC: { name: 'Intel Corporation', currency: 'USD', price: 31.05, pe: 9.4, peg: 0.7, momentum3m: -0.12 },
  PFE: { name: 'Pfizer Inc.', currency: 'USD', price: 28.4, pe: 11.1, peg: 0.9, momentum3m: -0.08 },
  F: { name: 'Ford Motor Company', currency: 'USD', price: 11.9, pe: 7.2, peg: 0.8, momentum3m: -0.04 },
  CVS: { name: 'CVS Health Corporation', currency: 'USD', price: 58.3, pe: 9.9, peg: 0.85, momentum3m: -0.15 },
  VZ: { name: 'Verizon Communications', currency: 'USD', price: 40.1, pe: 9.1, peg: 1.1, momentum3m: -0.02 },
  TD: { name: 'Toronto-Dominion Bank', currency: 'CAD', price: 78.5, pe: 10.8, peg: 1.2, momentum3m: -0.06 },
  'ENB.TO': { name: 'Enbridge Inc.', currency: 'CAD', price: 49.2, pe: 18.0, peg: 1.4, momentum3m: -0.01 },
  'BNS.TO': { name: 'Bank of Nova Scotia', currency: 'CAD', price: 64.8, pe: 10.2, peg: 0.95, momentum3m: -0.1 },
  'SU.TO': { name: 'Suncor Energy Inc.', currency: 'CAD', price: 52.0, pe: 8.7, peg: 0.6, momentum3m: -0.05 },
  NVDA: { name: 'NVIDIA Corporation', currency: 'USD', price: 880.0, pe: 65.0, peg: 1.8, momentum3m: 0.35 },
  KO: { name: 'The Coca-Cola Company', currency: 'USD', price: 60.5, pe: 24.0, peg: 2.9, momentum3m: 0.06 },
};

function fixtureFor(ticker: string): Fixture {
  const fixed = FIXTURES[ticker];
  if (fixed) return fixed;
  // Synthesize a stable fixture for any other ticker.
  const r = hash(ticker);
  const r2 = hash(ticker + '#2');
  const r3 = hash(ticker + '#3');
  return {
    name: ticker,
    currency: ticker.endsWith('.TO') ? 'CAD' : 'USD',
    price: 10 + r * 240,
    pe: 6 + r2 * 40,
    peg: 0.5 + r3 * 2.5,
    momentum3m: -0.2 + r * 0.5,
  };
}

export class MockProvider implements MarketDataProvider {
  async getQuote(ticker: string): Promise<Quote | null> {
    const f = fixtureFor(ticker);
    return {
      ticker,
      name: f.name,
      price: round(f.price, 2),
      currency: f.currency,
      pe: f.pe,
      forwardPe: f.pe === null ? null : round(f.pe * 0.9, 2),
      peg: f.peg,
      eps: f.pe ? round(f.price / f.pe, 2) : null,
      marketCap: Math.round(f.price * 1_000_000_00),
    };
  }

  async getQuotes(tickers: string[]): Promise<Quote[]> {
    const quotes = await Promise.all(tickers.map((t) => this.getQuote(t)));
    return quotes.filter((q): q is Quote => q !== null);
  }

  async getHistory(ticker: string, opts: HistoryOptions): Promise<PricePoint[]> {
    const f = fixtureFor(ticker);
    const intraday = isIntraday(opts.interval);
    const stamps = intraday ? hourList(opts.from, opts.to) : dayList(opts.from, opts.to);
    if (stamps.length === 0) return [];

    // Build a smooth path ending at the current price. Scale the 3-month move to
    // the visible span so short (1D/5D) ranges aren't absurdly steep.
    const end = f.price;
    const spanDays = Math.max(1, (opts.to.getTime() - opts.from.getTime()) / 86_400_000);
    const totalReturn = f.momentum3m * Math.min(1, spanDays / 90);
    const start = end / (1 + totalReturn);
    const seed = hash(ticker);
    const amp = intraday ? 0.004 : 0.02;

    return stamps.map((d, i) => {
      const t = stamps.length === 1 ? 1 : i / (stamps.length - 1);
      const trend = start + (end - start) * t;
      const wiggle = Math.sin((i + seed * 50) * 0.6) * trend * amp;
      return { date: intraday ? d.toISOString() : toISODate(d), close: round(trend + wiggle, 2) };
    });
  }
}

function dayList(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cur <= end) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(new Date(cur)); // weekdays only
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

// Hourly timestamps across US market hours (14:00–20:00 UTC ≈ 9:30–16:00 ET) on
// weekdays within [from, to], capped at `to`. Used for intraday (1D/5D) charts.
function hourList(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const endDay = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cur <= endDay) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      for (let h = 14; h <= 20; h++) {
        const ts = new Date(cur);
        ts.setUTCHours(h);
        if (ts >= from && ts <= to) out.push(ts);
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
