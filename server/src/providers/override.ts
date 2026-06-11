import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  HistoryOptions,
  IntrinsicValue,
  MarketDataProvider,
  PricePoint,
  Quote,
} from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
// server/src/providers -> server/data/manual-prices.json (and dist/providers -> server/data)
const OVERRIDE_FILE = join(here, '..', '..', 'data', 'manual-prices.json');

// Per-ticker manual override. Any field present wins over the upstream provider.
export interface TickerOverride {
  price?: number;
  pe?: number;
  forwardPe?: number;
  peg?: number;
  eps?: number;
  iv?: IntrinsicValue | null;
}

export type Overrides = Record<string, TickerOverride>;

function numOrUndef(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseIv(v: unknown): IntrinsicValue | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? { base: v } : undefined;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const base = numOrUndef(o.base);
    if (base === undefined) return undefined;
    return { base, bear: numOrUndef(o.bear) ?? null, best: numOrUndef(o.best) ?? null };
  }
  return undefined;
}

export function loadOverrides(file = OVERRIDE_FILE): { overrides: Overrides; asOf?: string } {
  try {
    if (!existsSync(file)) return { overrides: {} };
    const raw = JSON.parse(readFileSync(file, 'utf8')) as {
      overrides?: Record<string, Record<string, unknown>>;
      asOf?: string;
    };
    const overrides: Overrides = {};
    for (const [ticker, o] of Object.entries(raw.overrides ?? {})) {
      const entry: TickerOverride = {};
      const price = numOrUndef(o.price);
      const pe = numOrUndef(o.pe);
      const forwardPe = numOrUndef(o.forwardPe);
      const peg = numOrUndef(o.peg);
      const eps = numOrUndef(o.eps);
      const iv = parseIv(o.iv);
      if (price !== undefined) entry.price = price;
      if (pe !== undefined) entry.pe = pe;
      if (forwardPe !== undefined) entry.forwardPe = forwardPe;
      if (peg !== undefined) entry.peg = peg;
      if (eps !== undefined) entry.eps = eps;
      if (iv !== undefined) entry.iv = iv;
      if (Object.keys(entry).length > 0) overrides[ticker.toUpperCase()] = entry;
    }
    return { overrides, asOf: raw.asOf };
  } catch (err) {
    console.warn(`[override] failed to read ${file}: ${(err as Error).message}`);
    return { overrides: {} };
  }
}

// Wraps a base provider and applies user-supplied price / P/E / PEG / intrinsic
// value for specific tickers. The quote price AND the tail of the history chart
// are anchored to the override price so the whole app stays consistent.
export class OverrideProvider implements MarketDataProvider {
  constructor(
    private readonly base: MarketDataProvider,
    private readonly overrides: Overrides,
  ) {}

  private overrideFor(ticker: string): TickerOverride | undefined {
    return this.overrides[ticker.toUpperCase()];
  }

  async getQuote(ticker: string): Promise<Quote | null> {
    return this.applyQuote(ticker, await this.base.getQuote(ticker));
  }

  async getQuotes(tickers: string[]): Promise<Quote[]> {
    const quotes = await this.base.getQuotes(tickers);
    const byTicker = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q]));
    const out: Quote[] = [];
    for (const t of tickers) {
      const applied = this.applyQuote(t, byTicker.get(t.toUpperCase()) ?? null);
      if (applied) out.push(applied);
    }
    return out;
  }

  private applyQuote(ticker: string, q: Quote | null): Quote | null {
    const o = this.overrideFor(ticker);
    if (!o) return q;
    const merged: Quote = q ?? {
      ticker: ticker.toUpperCase(),
      name: ticker.toUpperCase(),
      price: null,
      currency: 'USD',
      pe: null,
      forwardPe: null,
      peg: null,
      eps: null,
      marketCap: null,
      iv: null,
    };
    return {
      ...merged,
      price: o.price ?? merged.price,
      pe: o.pe ?? merged.pe,
      forwardPe: o.forwardPe ?? merged.forwardPe,
      peg: o.peg ?? merged.peg,
      eps: o.eps ?? merged.eps,
      iv: o.iv ?? merged.iv ?? null,
    };
  }

  async getHistory(ticker: string, opts: HistoryOptions): Promise<PricePoint[]> {
    const history = await this.base.getHistory(ticker, opts);
    const price = this.overrideFor(ticker)?.price;
    if (price === undefined || history.length === 0) return history;
    const last = history[history.length - 1].close;
    if (!last) return history;
    // Scale so the series ends exactly at the override price; preserves shape.
    const scale = price / last;
    return history.map((p) => ({ date: p.date, close: Math.round(p.close * scale * 100) / 100 }));
  }
}
