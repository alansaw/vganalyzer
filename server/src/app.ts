import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type Express } from 'express';
import type { MarketDataProvider } from './providers/index.js';
import { errorHandler } from './http.js';
import { authRouter, requireAuth } from './auth.js';
import { healthRouter } from './routes/health.js';
import { transactionsRouter } from './routes/transactions.js';
import { positionsRouter } from './routes/positions.js';
import { portfolioRouter } from './routes/portfolio.js';
import { recommendationsRouter } from './routes/recommendations.js';

const here = dirname(fileURLToPath(import.meta.url));

export function createApp(provider: MarketDataProvider): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health (Render health checks) and auth endpoints are reachable without a session.
  app.use('/api/health', healthRouter());
  app.use('/api/auth', authRouter());

  // Everything else under /api requires a session (no-op when auth is disabled).
  app.use('/api', requireAuth);

  app.use('/api/transactions', transactionsRouter());
  app.use('/api/positions', positionsRouter(provider));
  app.use('/api/portfolio', portfolioRouter(provider));
  app.use('/api/recommendations', recommendationsRouter(provider));

  // In production the server also serves the built client (single Render service).
  if (process.env.NODE_ENV === 'production' || process.env.SERVE_CLIENT === 'true') {
    // Works from both server/src (tsx) and server/dist (compiled): ../.. is the repo root.
    const clientDist = join(here, '..', '..', 'client', 'dist');
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
