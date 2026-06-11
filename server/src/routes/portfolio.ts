import { Router } from 'express';
import type { MarketDataProvider } from '../providers/index.js';
import { asyncHandler } from '../http.js';
import {
  getHoldingScores,
  getPortfolioHistory,
  getPortfolioSummary,
  type Range,
} from '../services/account.js';

const VALID_RANGES: Range[] = ['1d', '5d', '1m', '3m', '6m', '1y', '2y', '5y'];

function parseRange(value: unknown): Range {
  return VALID_RANGES.includes(value as Range) ? (value as Range) : '1y';
}

export function portfolioRouter(provider: MarketDataProvider): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json(await getPortfolioSummary(provider));
    }),
  );

  // Holdings scored with the recommendation formula (ungated) for the Grades page.
  router.get(
    '/scores',
    asyncHandler(async (_req, res) => {
      res.json(await getHoldingScores(provider));
    }),
  );

  router.get(
    '/history',
    asyncHandler(async (req, res) => {
      const range = parseRange(req.query.range);
      res.json({ range, points: await getPortfolioHistory(provider, range) });
    }),
  );

  return router;
}
