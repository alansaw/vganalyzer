import {
  type HistoryOptions,
  type MarketDataProvider,
  type PricePoint,
  type Quote,
  num,
} from './types.js';
import { fetchStockAnalysisHistory } from './realHistory.js';

// Live quotes from stockanalysis.com (no API key). Provides the LATEST price
// (regular-session last, refreshing through the day), not just a frozen close.
// History delegates to the existing real-history fetcher.
//
//   US:  /api/quotes/s/{SYM}            -> { data: { p, c, cp, u, ms, n, ... } }
//   TSX: quote page embeds quote:{...}  (the quotes API rejects .TO symbols)

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

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

// Page titles look like "Suncor Energy (TSX:SU) Stock Price & Overview".
// Keep just the company name, strip the exchange tag/suffix, decode entities.
export function cleanName(raw: string | undefined, ticker: string): string {
  if (!raw) return ticker.toUpperCase();
  let n = raw
    .replace(/\s*\([^)]*\)\s*/g, ' ') // drop any "(TSX:SU)" / "(AMZN)" tag
    .replace(/\s*[-|]?\s*(Stock Price|Price|Quote|Overview|& Overview).*$/i, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
  return n || ticker.toUpperCase();
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// The quotes API carries PRICE data only (no PE/EPS/name). That's by design
// here: this provider supplies the live price; PE/PEG/EPS/IV come from the
// manual overrides layered on top.
interface SaQuote {
  p?: number; // last price (regular session)
}

function toQuote(ticker: string, d: SaQuote, currency: string): Quote {
  return {
    ticker: ticker.toUpperCase(),
    name: ticker.toUpperCase(),
    price: num(d.p),
    currency,
    pe: null,
    forwardPe: null,
    peg: null,
    eps: null,
    marketCap: null,
  };
}

export class StockAnalysisProvider implements MarketDataProvider {
  async getQuote(ticker: string): Promise<Quote | null> {
    return withSlot(async () => {
      try {
        if (ticker.endsWith('.TO')) return await this.fetchTsxQuote(ticker);
        const text = await getText(`https://stockanalysis.com/api/quotes/s/${ticker.toLowerCase()}`);
        const json = JSON.parse(text) as { status?: number; data?: SaQuote };
        if (json.status === 200 && json.data && json.data.p != null) {
          return toQuote(ticker, json.data, ticker.endsWith('.TO') ? 'CAD' : 'USD');
        }
        // Not a US listing (e.g. OTC like TCEHY) — try the OTC quote page.
        return await this.fetchPageQuote(`https://stockanalysis.com/quote/otc/${ticker}/`, ticker, 'USD');
      } catch (err) {
        console.warn(`[stockanalysis] quote failed for ${ticker}: ${(err as Error).message}`);
        return null;
      }
    });
  }

  async getQuotes(tickers: string[]): Promise<Quote[]> {
    const results = await Promise.all(tickers.map((t) => this.getQuote(t)));
    return results.filter((q): q is Quote => q !== null);
  }

  private async fetchTsxQuote(ticker: string): Promise<Quote | null> {
    const base = ticker.slice(0, -3);
    return this.fetchPageQuote(`https://stockanalysis.com/quote/tsx/${base}/`, ticker, 'CAD');
  }

  // Extract the embedded `quote:{...}` object from a quote page (TSX / OTC).
  private async fetchPageQuote(url: string, ticker: string, currency: string): Promise<Quote | null> {
    const html = await getText(url);
    const m = html.match(/quote:\{([^}]*)\}/);
    if (!m) return null;
    const body = m[1];
    const field = (k: string) => {
      const mm = body.match(new RegExp(`(?:^|,)${k}:([0-9.-]+)`));
      return mm ? Number(mm[1]) : undefined;
    };
    const price = field('p');
    if (price == null) return null;
    const nameMatch = html.match(/<title>([^<|]+)/);
    return {
      ticker: ticker.toUpperCase(),
      name: cleanName(nameMatch?.[1], ticker),
      price,
      currency,
      pe: null,
      forwardPe: null,
      peg: null,
      eps: null,
      marketCap: null,
    };
  }

  // Richer quote used by the on-demand "Evaluate Stock" tool: pulls trailing +
  // forward P/E and EPS (and derives PEG) from the ticker's page, so an
  // arbitrary symbol can actually be scored without a manual override. Heavier
  // than getQuote (fetches a full page), so it's not used for the bulk universe.
  async getQuoteWithRatios(ticker: string): Promise<Quote | null> {
    return withSlot(async () => {
      const sym = ticker.toUpperCase();
      const url = sym.endsWith('.TO')
        ? `https://stockanalysis.com/quote/tsx/${sym.slice(0, -3)}/`
        : `https://stockanalysis.com/stocks/${ticker.toLowerCase()}/`;
      try {
        let html: string;
        try {
          html = await getText(url);
        } catch {
          // OTC / ADR (e.g. TCEHY) live under /quote/otc/
          html = await getText(`https://stockanalysis.com/quote/otc/${sym}/`);
        }
        const q = html.match(/quote:\{([^}]*)\}/);
        const price = q ? Number(q[1].match(/(?:^|,)p:([0-9.]+)/)?.[1]) : undefined;
        if (price == null || Number.isNaN(price)) return null;

        const field = (k: string) => {
          const m = html.match(new RegExp(`${k}:"?(-?[0-9.]+)"?`));
          return m ? Number(m[1]) : null;
        };
        const pe = field('peRatio');
        const forwardPe = field('forwardPE');
        const nameMatch = html.match(/<title>([^<|]+)/);
        // Derive PEG from forward P/E ÷ the 1-yr growth implied by the
        // trailing→forward multiple. This is only meaningful when forward is
        // clearly below trailing; when they're ~equal (tiny implied growth) the
        // ratio explodes, and when forward > trailing it goes negative. In both
        // cases leave PEG unavailable (null) rather than show a garbage number
        // like 800 — a pinned peg in manual-prices.json supersedes this anyway.
        let peg = field('pegRatio');
        if (peg === null && pe && forwardPe && forwardPe > 0) {
          const growthPct = (pe / forwardPe - 1) * 100;
          if (growthPct >= 3) {
            const candidate = Math.round((forwardPe / growthPct) * 100) / 100;
            if (candidate > 0 && candidate <= 5) peg = candidate; // sane range only
          }
        }
        return {
          ticker: sym,
          name: cleanName(nameMatch?.[1], ticker),
          price,
          currency: sym.endsWith('.TO') ? 'CAD' : 'USD',
          pe,
          forwardPe,
          peg,
          eps: field('eps'),
          marketCap: null,
        };
      } catch (err) {
        console.warn(`[stockanalysis] ratios failed for ${ticker}: ${(err as Error).message}`);
        return null;
      }
    });
  }

  getHistory(ticker: string, opts: HistoryOptions): Promise<PricePoint[]> {
    return fetchStockAnalysisHistory(ticker).then((series) => {
      const from = opts.from.toISOString().slice(0, 10);
      const to = opts.to.toISOString().slice(0, 10);
      return series.filter((p) => p.date >= from && p.date <= to);
    });
  }
}
