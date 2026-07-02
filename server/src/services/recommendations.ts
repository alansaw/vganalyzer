import { randomUUID } from 'node:crypto';
import { query } from '../db/pool.js';
import type { IntrinsicValue, MarketDataProvider } from '../providers/index.js';
import { computeFactorScores, scoreStock, type StockMetrics } from './scoring.js';
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

// Same shape a recommendation row carries, plus eligibility (a recommendation
// is always eligible; an ad-hoc evaluation may not be).
export interface StockEvaluation {
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
  eligible: boolean; // would it pass the recommendation gates?
  rationale: string; // scoring rationale, or the gate reason when ineligible
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
  // A history failure (e.g. unknown symbol) must not crash the whole evaluation
  // — momentum is optional (10% factor), so treat it as unavailable.
  const history = await provider
    .getHistory(ticker, { from, to: asOf, interval: '1d' })
    .catch(() => []);
  if (history.length < 2) return null;
  const first = history[0].close;
  const last = history[history.length - 1].close;
  if (!first) return null;
  return (last - first) / first;
}

// Score a single ticker with the same pipeline recommendations use. Returns
// null only when no quote is available at all (unknown/unpriced symbol).
export async function evaluateTicker(
  provider: MarketDataProvider,
  symbol: string,
  market: 'US' | 'CA' = symbol.endsWith('.TO') ? 'CA' : 'US',
  fallbackName?: string,
  richRatios = false, // fetch P/E + PEG (heavier) — used for on-demand evaluation
): Promise<StockEvaluation | null> {
  const quotePromise =
    richRatios && provider.getQuoteWithRatios
      ? provider.getQuoteWithRatios(symbol)
      : provider.getQuote(symbol);
  const [quote, momentum3m] = await Promise.all([quotePromise, computeMomentum3m(provider, symbol)]);
  if (!quote) return null;

  // Every name gets an IV: pinned DCF value if present, else a computed
  // forward-earnings estimate. Needed before scoring — the discount to IV is a
  // scoring factor, and names above IV are excluded from recommendations.
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
    ticker: symbol,
    pe: quote.forwardPe ?? quote.pe,
    peg: quote.peg,
    momentum3m,
    ivDiscount,
  };
  // Eligibility gates decide what qualifies for the ranked list...
  const gated = scoreStock(metrics);
  // ...but the SCORE is always the real value-growth score, even for names the
  // gates exclude (a 7%-above-IV name shouldn't read a misleading 0). This is
  // the same ungated score the Grades page uses.
  const factors = computeFactorScores(metrics);
  const score = factors?.score ?? gated.score;

  // Surface the DCF assumptions (when this IV came from a per-stock DCF block)
  // in the "Why" text, so the reasoning behind the valuation is visible.
  const rationale = iv?.rationale
    ? `${gated.rationale} IV basis: ${iv.rationale}`
    : gated.rationale;

  return {
    ticker: symbol,
    name: quote.name ?? fallbackName ?? symbol,
    market,
    price: quote.price,
    pe: quote.pe,
    forwardPe: quote.forwardPe,
    peg: quote.peg,
    iv,
    momentum3m,
    score,
    eligible: gated.eligible,
    rationale,
  };
}

// Evaluate the universe, score eligible names and return the top `limit`.
export async function generateRecommendations(
  provider: MarketDataProvider,
  universe: UniverseTicker[],
  limit: number,
): Promise<Omit<Recommendation, 'rank' | 'generatedAt'>[]> {
  const evaluated = await Promise.all(
    universe.map((u) => evaluateTicker(provider, u.symbol, u.market, u.name)),
  );

  return evaluated
    .filter((e): e is StockEvaluation => e !== null && e.eligible)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((e) => ({
      ticker: e.ticker,
      name: e.name,
      market: e.market,
      price: e.price,
      pe: e.pe,
      forwardPe: e.forwardPe,
      peg: e.peg,
      iv: e.iv,
      momentum3m: e.momentum3m,
      score: e.score,
      rationale: e.rationale,
    }));
}

// Score an arbitrary ticker on demand (the "Evaluate Stock" tool). Uses the
// richer quote path so a symbol outside the pinned set still gets P/E + PEG.
export async function evaluateStock(
  provider: MarketDataProvider,
  symbol: string,
): Promise<StockEvaluation | null> {
  return evaluateTicker(provider, symbol.trim().toUpperCase(), undefined, undefined, true);
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
