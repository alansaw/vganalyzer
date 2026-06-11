# VG Analyzer — Build Progress

## Status: COMPLETE ✅ — all layers built and green

Final results: typecheck PASS · server 22 tests · client 10 tests · E2E 4/4 passed.
Root cause fixed: yahoo-finance2 v2 default export is a class (not a singleton) — lazily
`new`'d in `server/src/providers/yahoo.ts`; was crashing the server on startup. Live Yahoo
verified (real US + TSX quotes/history) with a PEG fallback for Yahoo's frequent null pegRatio.

### DONE
- Monorepo scaffold (npm workspaces: `server`, `client`), root scripts, `.gitignore`, `.env.example`, `README.md`.
- **Server** (Express + TS + Postgres): config, pg pool, migrations (`001_init.sql`: tickers/transactions/recommendations), migrate + seed scripts (48 tickers US+CA, 7 demo txns). Providers: `yahoo` (live) + `mock` (deterministic). Services: `scoring` (PEG 45% / PE 25% / momentum 30%, eligibility gates), `portfolio` (avg-cost holdings, valuation, value history), `recommendations`, `account`. Routes: health, transactions, positions, portfolio, recommendations. Zod validation.
- **Client** (React 18 + Vite + TS): pages Portfolio / PositionDetail / Recommendations; components StatCard, PriceChart (recharts), RangePicker, States, TransactionForm, ScoreBadge; TanStack Query hooks; API client; dark CSS theme.
- **Tests**: server unit (scoring, portfolio) + integration (supertest, self-skips unless DB name has "test"); client unit (format, ScoreBadge, Portfolio, Recommendations); Playwright E2E in `client/e2e/app.spec.ts`.

### VERIFIED PASSING
- `npm run typecheck` — server + client clean (after yahoo.ts type-narrowing fix for yahoo-finance2 v2.14 default export).
- `npm run db:migrate` + `db:seed` — OK (db `vganalyzer`).
- Server tests: **22 passed** (run against `vganalyzer_test` for integration).
- Client tests: **10 passed**.

### IN PROGRESS / NEXT
- Playwright chromium just installed. RUN E2E: from repo root or client: `npm --workspace client run test:e2e`.
  - Playwright `webServer` runs `npm run dev` (cwd `..`) with `MARKET_PROVIDER=mock`, waits on http://localhost:5173. Dev DB must be seeded (done).
  - If E2E passes → done. If failures, debug selectors in `client/e2e/app.spec.ts` vs pages.
- Known nit (non-blocking): React Router v7 future-flag warnings in client tests (cosmetic).

### KEY COMMANDS
- Setup: `npm install && npm run setup` (create+migrate+seed db `vganalyzer`).
- Dev: `npm run dev` (client :5173 → proxy /api → server :4000).
- All tests: `npm test`; E2E: `npm run test:e2e`.
- Integration tests need a *test* DB: `DATABASE_URL=postgresql://localhost:5432/vganalyzer_test npm run test:server`.

### ENV / MACHINE
- Node v24.10, npm 11.6, Postgres 17 (local, user `alansaw`, no Docker). DBs created: `vganalyzer`, `vganalyzer_test`.
- Data source chosen: yahoo-finance2 (no key). Auth: single-user, none.
