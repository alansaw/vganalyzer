import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, query } from '../../src/db/pool.js';
import { migrate } from '../../src/db/migrate.js';
import { MockProvider } from '../../src/providers/mock.js';
import { config } from '../../src/config.js';

// Integration tests hit a real Postgres DB. To avoid clobbering the dev/demo
// database, they only run when DATABASE_URL points at a database whose name
// contains "test", e.g.:
//   createdb vganalyzer_test
//   DATABASE_URL=postgresql://localhost:5432/vganalyzer_test npm run test:integration
const useTestDb = (config.databaseUrl || '').includes('test');
const suite = useTestDb ? describe : describe.skip;

if (!useTestDb) {
  console.warn(
    '[integration] skipped — set DATABASE_URL to a *test* database to run these (see test file header).',
  );
}

suite('API integration', () => {
  let app: Express;

  beforeAll(async () => {
    await migrate();
    await query('TRUNCATE recommendations, transactions, tickers RESTART IDENTITY');

    // Minimal universe: two cheap value names (eligible) + one expensive (rejected).
    for (const [symbol, name, market] of [
      ['INTC', 'Intel Corporation', 'US'],
      ['PFE', 'Pfizer Inc.', 'US'],
      ['NVDA', 'NVIDIA Corporation', 'US'],
      ['TD.TO', 'Toronto-Dominion Bank', 'CA'],
    ] as const) {
      await query('INSERT INTO tickers (symbol, name, market) VALUES ($1,$2,$3)', [symbol, name, market]);
    }

    app = createApp(new MockProvider());
  });

  afterAll(async () => {
    await closePool();
  });

  it('reports health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('records a transaction and reflects it in the portfolio', async () => {
    const create = await request(app)
      .post('/api/transactions')
      .send({ ticker: 'INTC', type: 'BUY', shares: 50, price: 30, tradedOn: '2025-09-15' });
    expect(create.status).toBe(201);
    expect(create.body.id).toBeGreaterThan(0);

    const portfolio = await request(app).get('/api/portfolio');
    expect(portfolio.status).toBe(200);
    expect(portfolio.body.totalValue).toBeGreaterThan(0);
    const intc = portfolio.body.positions.find((p: { ticker: string }) => p.ticker === 'INTC');
    expect(intc).toBeTruthy();
    expect(intc.shares).toBe(50);
  });

  it('rejects an invalid transaction', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send({ ticker: 'INTC', type: 'BUY', shares: -5, price: 30, tradedOn: 'nope' });
    expect(res.status).toBe(400);
  });

  it('returns position detail with quote, history and transactions', async () => {
    const res = await request(app).get('/api/positions/INTC?range=3m');
    expect(res.status).toBe(200);
    expect(res.body.quote.ticker).toBe('INTC');
    expect(res.body.history.length).toBeGreaterThan(0);
    expect(res.body.transactions.length).toBeGreaterThan(0);
    expect(res.body.position.shares).toBe(50);
  });

  it('recommendation scores equal the holdings (ungated) formula for every row', async () => {
    const { computeFactorScores } = await import('../../src/services/scoring.js');
    const res = await request(app).get('/api/recommendations');
    expect(res.body.length).toBeGreaterThan(0);
    for (const r of res.body) {
      const ivDiscount =
        r.iv && r.price !== null && r.iv.base > 0 ? (r.iv.base - r.price) / r.iv.base : null;
      const f = computeFactorScores({
        ticker: r.ticker,
        pe: r.forwardPe ?? r.pe,
        peg: r.peg,
        momentum3m: r.momentum3m,
        ivDiscount,
      });
      expect(f).not.toBeNull();
      // 0.02 tolerance: stored inputs are NUMERIC(18,4/6), so recomputing from
      // DB-rounded values can differ by a hundredth of a point.
      expect(Math.abs(f!.score - r.score)).toBeLessThan(0.02);
    }
  });

  it('scores portfolio holdings for the grades view', async () => {
    const res = await request(app).get('/api/portfolio/scores');
    expect(res.status).toBe(200);
    const intc = res.body.find((r: { ticker: string }) => r.ticker === 'INTC');
    expect(intc).toBeTruthy();
    expect(intc.score).toBeGreaterThan(0);
    expect(typeof intc.eligible).toBe('boolean');
    if (!intc.eligible) expect(intc.reason).toBeTruthy();
  });

  it('returns a portfolio value history series', async () => {
    const res = await request(app).get('/api/portfolio/history?range=3m');
    expect(res.status).toBe(200);
    expect(res.body.range).toBe('3m');
    expect(Array.isArray(res.body.points)).toBe(true);
    expect(res.body.points.length).toBeGreaterThan(0);
  });

  it('generates ranked recommendations (cheap names beat expensive ones)', async () => {
    const res = await request(app).post('/api/recommendations/refresh');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    // Scores must be sorted descending and ranked 1..n.
    const scores = res.body.map((r: { score: number }) => r.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
    expect(res.body[0].rank).toBe(1);

    // Cheap value names must rank above expensive NVDA (momentum no longer gates,
    // so NVDA can appear, but its high forward P/E should keep it near the bottom).
    const rankOf = (t: string) =>
      res.body.find((r: { ticker: string }) => r.ticker === t)?.rank ?? Infinity;
    expect(rankOf('INTC')).toBeLessThan(rankOf('NVDA'));
    expect(rankOf('PFE')).toBeLessThan(rankOf('NVDA'));

    // Every recommendation carries an intrinsic value and a forward P/E.
    for (const r of res.body) {
      expect(r.iv).toBeTruthy();
      expect(r.iv.base).toBeGreaterThan(0);
      expect(r.forwardPe).not.toBeNull();
    }
  });

  it('serves the latest recommendations from cache', async () => {
    const res = await request(app).get('/api/recommendations');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  // Auth + roles. Runs LAST: setting the env vars turns authentication on
  // (auth.ts reads env per request), which would 401 the earlier tests.
  describe('authentication & roles', () => {
    beforeAll(() => {
      process.env.ADMIN_PASSWORD = 'admin-pw';
      process.env.VIEWER_PASSWORD = 'user-pw';
      process.env.SESSION_SECRET = 'integration-secret';
    });
    afterAll(() => {
      delete process.env.ADMIN_PASSWORD;
      delete process.env.VIEWER_PASSWORD;
      delete process.env.SESSION_SECRET;
    });

    async function loginCookie(username: string, password: string): Promise<string> {
      const res = await request(app).post('/api/auth/login').send({ username, password });
      expect(res.status).toBe(200);
      return res.headers['set-cookie'][0].split(';')[0];
    }

    it('rejects unauthenticated API access when auth is enabled', async () => {
      expect((await request(app).get('/api/portfolio')).status).toBe(401);
      expect((await request(app).get('/api/auth/me')).status).toBe(401);
      // Health stays open for Render health checks.
      expect((await request(app).get('/api/health')).status).toBe(200);
    });

    it('rejects bad credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'nope' });
      expect(res.status).toBe(401);
    });

    it('lets the user role read but not write', async () => {
      const cookie = await loginCookie('user', 'user-pw');
      const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
      expect(me.body).toEqual({ role: 'user', authEnabled: true });

      expect((await request(app).get('/api/portfolio').set('Cookie', cookie)).status).toBe(200);
      expect((await request(app).get('/api/recommendations').set('Cookie', cookie)).status).toBe(200);

      const write = await request(app)
        .post('/api/transactions')
        .set('Cookie', cookie)
        .send({ ticker: 'INTC', type: 'BUY', shares: 1, price: 10, tradedOn: '2026-06-01' });
      expect(write.status).toBe(403);
      expect((await request(app).delete('/api/transactions/1').set('Cookie', cookie)).status).toBe(403);
      expect((await request(app).post('/api/recommendations/refresh').set('Cookie', cookie)).status).toBe(403);
    });

    it('lets the admin role write', async () => {
      const cookie = await loginCookie('admin', 'admin-pw');
      const create = await request(app)
        .post('/api/transactions')
        .set('Cookie', cookie)
        .send({ ticker: 'CSCO', type: 'BUY', shares: 2, price: 50, tradedOn: '2026-06-01' });
      expect(create.status).toBe(201);
      const del = await request(app).delete(`/api/transactions/${create.body.id}`).set('Cookie', cookie);
      expect(del.status).toBe(204);
    });

    it('logout clears the session', async () => {
      const cookie = await loginCookie('admin', 'admin-pw');
      const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
      expect(out.status).toBe(204);
      const cleared = out.headers['set-cookie'][0].split(';')[0];
      expect((await request(app).get('/api/portfolio').set('Cookie', cleared)).status).toBe(401);
    });
  });
});
