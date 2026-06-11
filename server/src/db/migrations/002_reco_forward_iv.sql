-- Persist forward P/E and intrinsic value alongside each recommendation so the
-- Recommendations page can show them.
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS forward_pe NUMERIC(18, 4);
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS iv JSONB;
