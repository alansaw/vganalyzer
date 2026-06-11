-- Universe of tickers the recommendation engine evaluates.
CREATE TABLE IF NOT EXISTS tickers (
  symbol  TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  market  TEXT NOT NULL CHECK (market IN ('US', 'CA')),
  active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- Buy/sell transactions; positions are derived from these.
CREATE TABLE IF NOT EXISTS transactions (
  id         SERIAL PRIMARY KEY,
  ticker     TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  shares     NUMERIC(18, 6) NOT NULL CHECK (shares > 0),
  price      NUMERIC(18, 4) NOT NULL CHECK (price >= 0),
  traded_on  DATE NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_ticker ON transactions (ticker);
CREATE INDEX IF NOT EXISTS idx_transactions_traded_on ON transactions (traded_on);

-- Generated recommendation batches, persisted so they can be tracked over time.
CREATE TABLE IF NOT EXISTS recommendations (
  id           SERIAL PRIMARY KEY,
  batch_id     UUID NOT NULL,
  ticker       TEXT NOT NULL,
  name         TEXT NOT NULL,
  market       TEXT NOT NULL,
  price        NUMERIC(18, 4),
  pe           NUMERIC(18, 4),
  peg          NUMERIC(18, 4),
  momentum_3m  NUMERIC(18, 6),
  score        NUMERIC(18, 4) NOT NULL,
  rationale    TEXT,
  rank         INT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reco_batch ON recommendations (batch_id);
CREATE INDEX IF NOT EXISTS idx_reco_generated ON recommendations (generated_at DESC);
