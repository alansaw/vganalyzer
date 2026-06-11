import { Router } from 'express';
import { config } from '../config.js';
import type { MarketDataProvider } from '../providers/index.js';
import { requireAdmin } from '../auth.js';
import { asyncHandler } from '../http.js';
import {
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

  return router;
}
