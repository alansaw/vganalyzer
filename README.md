# VG Analyzer — Value Growth Analyzer

A personal stock-picker and portfolio tracker for **North American markets (US & Canada/TSX)**.
It surfaces value-growth recommendations based on **PEG / P/E** and **3-month momentum**, and tracks
your buys, sells and portfolio performance over time.

## What it does

- **Portfolio** — every position, total value, realized/unrealized P/L, and a portfolio value chart.
- **Position detail** — live price, history chart, P/E, forward P/E, PEG, EPS, your buys/sells and the
  resulting holding value.
- **Recommendations** — the top value-growth names *right now*: cheap on PEG/P/E that **haven't run up**
  in the past 3 months (consolidating or mildly pulled back), scored and ranked.

### Recommendation logic (the "VG" part)

A stock is **eligible** if it has a positive P/E ≤ 60 (forward preferred), a PEG between 0 and 3,
and is **not trading above its intrinsic value** (price > IV base ⇒ excluded). Eligible names are
scored 0–100 from four weighted factors — **PEG 52% · forward P/E 28% · 3-month momentum 10% ·
discount to IV 10%** — lower PEG/P/E, pulled-back price, and a deeper discount below IV all score
higher. IV comes from a pinned DCF where available, else a transparent forward-earnings estimate.
See `server/src/services/scoring.ts` and `server/src/services/intrinsicValue.ts`.

## Tech stack

- **Client** — React 18 + Vite + TypeScript, React Router, TanStack Query, Recharts.
- **Server** — Node + Express + TypeScript, Postgres (`pg`), Zod validation.
- **Market data** — `yahoo-finance2` (live, no API key) or a deterministic **mock** provider for
  tests/demos. Switch with `MARKET_PROVIDER=yahoo|mock`.
- **Tests** — Vitest (server unit + integration, client unit) and Playwright (E2E).

## Prerequisites

- Node ≥ 20
- PostgreSQL running locally (`createdb` available on your PATH)

## Quick start

```bash
# 1. Install all workspaces
npm install

# 2. Create + migrate + seed the database (creates db "vganalyzer")
npm run setup            # = db:create + db:migrate + db:seed

# 3. Run client + server together
npm run dev
# client -> http://localhost:5173   (proxies /api to the server)
# server -> http://localhost:4000
```

Configuration is via environment variables (see `.env.example`). By default the server connects to
`postgresql://<your-os-user>@localhost:5432/vganalyzer`. Override with `DATABASE_URL`.

## Testing

```bash
npm test                 # server (unit + integration) + client unit tests
npm run test:server      # server only
npm run test:client      # client only
npm run test:e2e         # Playwright E2E (boots the stack with the mock provider)
```

- **Unit tests** — pure scoring engine, portfolio accounting math, client formatters/components.
- **Integration tests** — real Express app against a **test** Postgres DB. They self-skip unless
  `DATABASE_URL` names a database containing `test`:
  ```bash
  createdb vganalyzer_test
  DATABASE_URL=postgresql://localhost:5432/vganalyzer_test npm run test:server
  ```
- **E2E tests** — Playwright boots the whole stack with `MARKET_PROVIDER=mock` (deterministic data).
  First run needs browsers: `npm --workspace client run test:e2e:install`. Requires the dev DB to be
  seeded (`npm run setup`).

## Project layout

```
vganalyzer/
├── server/                # Express API + Postgres + market data + scoring
│   ├── src/
│   │   ├── providers/      # yahoo + mock market data providers
│   │   ├── services/       # scoring, portfolio math, recommendations, account
│   │   ├── repositories/   # SQL data access
│   │   ├── routes/         # /api/{health,transactions,positions,portfolio,recommendations}
│   │   └── db/             # pool, migrations, migrate + seed scripts
│   └── tests/{unit,integration}
└── client/                # React + Vite SPA
    ├── src/{pages,components,hooks,api}
    ├── src/**/*.test.tsx   # client unit tests
    └── e2e/                # Playwright specs
```

## API

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/portfolio` | Portfolio summary (totals + valued positions) |
| GET | `/api/portfolio/history?range=` | Daily portfolio value series |
| GET | `/api/positions` | All positions (open + closed), valued |
| GET | `/api/positions/:ticker?range=` | Position detail: quote, history, transactions |
| GET | `/api/transactions[?ticker=]` | List transactions |
| POST | `/api/transactions` | Add a buy/sell |
| DELETE | `/api/transactions/:id` | Delete a transaction |
| GET | `/api/recommendations` | Latest recommendations (cached, auto-refreshes when stale) |
| POST | `/api/recommendations/refresh` | Force a fresh market scan |
| GET | `/api/recommendations/universe` | The screened ticker universe |

`range` ∈ `1m, 3m, 6m, 1y, 2y, 5y`.

## Authentication & roles

Two fixed accounts, configured by environment variables:

| Account | Password env var | Can do |
| --- | --- | --- |
| `admin` | `ADMIN_PASSWORD` | Everything: add/delete transactions, refresh recommendations |
| `user` | `VIEWER_PASSWORD` | Read-only: view all pages |

Auth is **enabled when at least one password is set** and disabled otherwise (local dev and
tests run open, treated as admin). Sessions are HMAC-signed httpOnly cookies (`SESSION_SECRET`,
7-day expiry). Mutating endpoints (`POST/DELETE /api/transactions`,
`POST /api/recommendations/refresh`) additionally require the admin role; the UI hides those
controls for the read-only user.

## Deploying free on Render

The repo ships a [`render.yaml`](render.yaml) blueprint that runs everything as **one free web
service** (Express serves the API and the built client).

1. Push this repo to GitHub.
2. Create a free Postgres database at [neon.tech](https://neon.tech); copy the connection string.
3. On [render.com](https://render.com): **New → Blueprint** → pick the repo.
4. Set the prompted env vars: `DATABASE_URL` (Neon string), `ADMIN_PASSWORD`, `VIEWER_PASSWORD`.
5. Deploy. First boot runs migrations and seeds the ticker universe (no demo transactions).

Notes: the free instance sleeps after ~15 min idle (first hit takes ~30–60 s);
`MARKET_PROVIDER=yahoo` is on in production (fresh IP, so live quotes usually work — pinned
prices in `server/data/manual-prices.json` still take precedence); re-enter your transactions
once via the UI as `admin`.

## Notes

- Cost basis uses **average-cost** accounting; realized P/L is booked on sells.
- Recommendations are persisted as dated batches so picks can be reviewed over time.
- **For research only — not investment advice.** Market data may be delayed.
