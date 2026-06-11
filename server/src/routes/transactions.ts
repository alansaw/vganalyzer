import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../auth.js';
import { asyncHandler, HttpError } from '../http.js';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
} from '../repositories/transactions.js';

const createSchema = z.object({
  ticker: z.string().trim().min(1).max(12),
  type: z.enum(['BUY', 'SELL']),
  shares: z.number().positive(),
  price: z.number().nonnegative(),
  tradedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tradedOn must be YYYY-MM-DD'),
  notes: z.string().max(500).optional().nullable(),
});

export function transactionsRouter(): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const ticker = typeof req.query.ticker === 'string' ? req.query.ticker.toUpperCase() : undefined;
      res.json(await listTransactions(ticker));
    }),
  );

  router.post(
    '/',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, parsed.error.issues.map((i) => i.message).join('; '));
      }
      const tx = await createTransaction(parsed.data);
      res.status(201).json(tx);
    }),
  );

  router.delete(
    '/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid id');
      const ok = await deleteTransaction(id);
      if (!ok) throw new HttpError(404, 'Transaction not found');
      res.status(204).end();
    }),
  );

  return router;
}
