import { Router } from 'express';
import type { MarketDataProvider } from '../providers/index.js';
import { asyncHandler } from '../http.js';
import { getEtfViews } from '../services/etfs.js';

export function etfsRouter(provider: MarketDataProvider): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json(await getEtfViews(provider));
    }),
  );

  return router;
}
