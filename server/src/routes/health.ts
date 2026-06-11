import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncHandler } from '../http.js';

export function healthRouter(): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      await query('SELECT 1');
      res.json({ status: 'ok', time: new Date().toISOString() });
    }),
  );

  return router;
}
