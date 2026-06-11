import { Router } from 'express';
import type { MarketDataProvider } from '../providers/index.js';
import { asyncHandler, HttpError } from '../http.js';
import { getPortfolioSummary, getPositionDetail, type Range } from '../services/account.js';

const VALID_RANGES: Range[] = ['1d', '5d', '1m', '3m', '6m', '1y', '2y', '5y'];

function parseRange(value: unknown): Range {
  return VALID_RANGES.includes(value as Range) ? (value as Range) : '1y';
}

export function positionsRouter(provider: MarketDataProvider): Router {
  const router = Router();

  // All positions (open + closed), valued.
  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const summary = await getPortfolioSummary(provider);
      res.json(summary.positions);
    }),
  );

  // Single position detail with quote, history and transactions.
  router.get(
    '/:ticker',
    asyncHandler(async (req, res) => {
      const ticker = req.params.ticker;
      if (!ticker) throw new HttpError(400, 'Missing ticker');
      const range = parseRange(req.query.range);
      const detail = await getPositionDetail(provider, ticker, range);
      if (!detail.quote && detail.transactions.length === 0) {
        throw new HttpError(404, `No data for ${ticker.toUpperCase()}`);
      }
      res.json(detail);
    }),
  );

  return router;
}
