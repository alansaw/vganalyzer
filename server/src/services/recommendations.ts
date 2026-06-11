import { randomUUID } from 'node:crypto';
import { query } from '../db/pool.js';
import type { IntrinsicValue, MarketDataProvider } from '../providers/index.js';
import { scoreStock, type StockMetrics } from './scoring.js';
import { resolveIntrinsicValue } from './intrinsicValue.js';

export interface UniverseTicker {
  symbol: string;
  name: string;
  market: 'US' | 'CA';
}

export interface Recommendation {
  ticker: string;
  name: string;
  market: string;
  price: number | null;
  pe: number | null;
  forwardPe: number | null;
  peg: number | null;
  iv: IntrinsicValue | null;
  momentum3m: number | null;
  score: number;
  rationale: string;
  rank: number;
  generatedAt: string;
}

const THREE_MONTHS_MS = 95 * 24 * 60 * 60 * 1000;

export async function getUniverse(): Promise<UniverseTicker[]> {
  const { rows } = await query<UniverseTicker>(
    `SELECT symbol, name, market FROM tickers WHERE active = TRUE ORDER BY symbol`,
  );
  return rows;
}

export async function computeMomentum3m(
  provider: MarketDataProvider,
  ticker: string,
  asOf = new Date(),
): Promise<number | null> {
  const from = new Date(asOf.getTime() - THREE_MONTHS_MS);
  const history = await provider.getHistory(ticker, { from, to: asOf, interval: '1d' });
  if (history.length < 2) return null;
  const first = history[0].close;
  const last = history[history.length - 1].close;
  if (!first) return null;
  return (last - first) / first;
}

// Evaluate the universe, score eligible names and return the top `limit`.
export async function generateRecommendations(
  provider: MarketDataProvider,
  universe: UniverseTicker[],
  limit: number,
): Promise<Omit<Recommendation, 'rank' | 'generatedAt'>[]> {
  const evaluated = await Promise.all(
    universe.map(async (u) => {
      const [quote, momentum3m] = await Promise.all([
        provider.getQuote(u.symbol),
        computeMomentum3m(provider, u.symbol),
      ]);
      if (!quote) return null;

      // Every name gets an IV: pinned DCF value if present, else a computed
      // forward-earnings estimate. Needed before scoring — the discount to IV
      // is a scoring factor, and names above IV are excluded.
      const iv = resolveIntrinsicValue(quote.iv, {
        price: quote.price,
        pe: quote.pe,
        forwardPe: quote.forwardPe,
        peg: quote.peg,
      });
      const ivDiscount =
        iv && quote.price !== null && iv.base > 0 ? (iv.base - quote.price) / iv.base : null;

      // Score on FORWARD P/E (falls back to trailing only if forward is absent).
      const metrics: StockMetrics = {
        ticker: u.symbol,
        pe: quote.forwardPe ?? quote.pe,
        peg: quote.peg,
        momentum3m,
        ivDiscount,
      };
      const result = scoreStock(metrics);
      if (!result.eligible) return null;

      return {
        ticker: u.symbol,
        name: quote.name ?? u.name,
        market: u.market,
        price: quote.price,
        pe: quote.pe,
        forwardPe: quote.forwardPe,
        peg: quote.peg,
        iv,
        momentum3m,
        score: result.score,
        rationale: result.rationale,
      };
    }),
  );

  return evaluated
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function saveRecommendations(
  rows: Omit<Recommendation, 'rank' | 'generatedAt'>[],
): Promise<string> {
  const batchId = randomUUID();
  let rank = 1;
  for (const r of rows) {
    await query(
      `INSERT INTO recommendations
         (batch_id, ticker, name, market, price, pe, forward_pe, peg, iv, momentum_3m, score, rationale, rank)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        batchId,
        r.ticker,
        r.name,
        r.market,
        r.price,
        r.pe,
        r.forwardPe,
        r.peg,
        r.iv ? JSON.stringify(r.iv) : null,
        r.momentum3m,
        r.score,
        r.rationale,
        rank++,
      ],
    );
  }
  return batchId;
}

interface RecoRow {
  ticker: string;
  name: string;
  market: string;
  price: number | null;
  pe: number | null;
  forward_pe: number | null;
  peg: number | null;
  iv: IntrinsicValue | null;
  momentum_3m: number | null;
  score: number;
  rationale: string | null;
  rank: number;
  generated_at: Date;
}

function mapRow(r: RecoRow): Recommendation {
  return {
    ticker: r.ticker,
    name: r.name,
    market: r.market,
    price: r.price,
    pe: r.pe,
    forwardPe: r.forward_pe,
    peg: r.peg,
    iv: r.iv ?? null,
    momentum3m: r.momentum_3m,
    score: r.score,
    rationale: r.rationale ?? '',
    rank: r.rank,
    generatedAt: r.generated_at.toISOString(),
  };
}

export async function getLatestRecommendations(): Promise<Recommendation[]> {
  const { rows } = await query<RecoRow>(
    `SELECT * FROM recommendations
     WHERE batch_id = (SELECT batch_id FROM recommendations ORDER BY generated_at DESC LIMIT 1)
     ORDER BY rank ASC`,
  );
  return rows.map(mapRow);
}

export async function latestBatchAgeMinutes(): Promise<number | null> {
  const { rows } = await query<{ generated_at: Date }>(
    `SELECT generated_at FROM recommendations ORDER BY generated_at DESC LIMIT 1`,
  );
  if (rows.length === 0) return null;
  return (Date.now() - rows[0].generated_at.getTime()) / 60000;
}

// Returns cached recommendations if fresh, otherwise regenerates.
export async function getOrRefreshRecommendations(
  provider: MarketDataProvider,
  limit: number,
  ttlMinutes: number,
): Promise<Recommendation[]> {
  const age = await latestBatchAgeMinutes();
  if (age !== null && age <= ttlMinutes) {
    return getLatestRecommendations();
  }
  return refreshRecommendations(provider, limit);
}

export async function refreshRecommendations(
  provider: MarketDataProvider,
  limit: number,
): Promise<Recommendation[]> {
  const universe = await getUniverse();
  const rows = await generateRecommendations(provider, universe, limit);
  await saveRecommendations(rows);
  return getLatestRecommendations();
}
