import { Router } from 'express';
import { config } from '../config.js';
import type { MarketDataProvider } from '../providers/index.js';
import { requireAdmin } from '../auth.js';
import { asyncHandler, HttpError } from '../http.js';
import {
  evaluateStock,
  getOrRefreshRecommendations,
  getUniverse,
  refreshRecommendations,
} from '../services/recommendations.js';

export function recommendationsRouter(provider: MarketDataProvider): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const recs = await getOrRefreshRecommendations(
        provider,
        config.recommendationCount,
        config.recommendationTtlMinutes,
      );
      res.json(recs);
    }),
  );

  router.post(
    '/refresh',
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const recs = await refreshRecommendations(provider, config.recommendationCount);
      res.json(recs);
    }),
  );

  router.get(
    '/universe',
    asyncHandler(async (_req, res) => {
      res.json(await getUniverse());
    }),
  );

  // Score an arbitrary ticker on demand (the "Evaluate Stock" tool).
  router.get(
    '/evaluate/:symbol',
    asyncHandler(async (req, res) => {
      const symbol = String(req.params.symbol || '').trim();
      if (!symbol || !/^[A-Za-z0-9.\-]{1,12}$/.test(symbol)) {
        throw new HttpError(400, 'Enter a valid ticker symbol (e.g. AAPL or ENB.TO).');
      }
      const result = await evaluateStock(provider, symbol);
      if (!result || result.price === null) {
        throw new HttpError(404, `No market data found for "${symbol.toUpperCase()}".`);
      }
      res.json(result);
    }),
  );

  return router;
}
