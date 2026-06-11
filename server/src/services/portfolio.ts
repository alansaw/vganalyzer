import type { IntrinsicValue, PricePoint, Quote } from '../providers/types.js';

export interface Transaction {
  id: number;
  ticker: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  tradedOn: string; // ISO date
  notes?: string | null;
}

export interface Holding {
  ticker: string;
  shares: number; // current shares held (0 if fully sold)
  costBasis: number; // cost of the shares still held
  avgCost: number; // costBasis / shares
  realized: number; // realized P/L from sells (average-cost method)
}

export interface PositionValue extends Holding {
  name: string | null;
  price: number | null;
  currency: string | null;
  pe: number | null;
  peg: number | null;
  iv: IntrinsicValue | null; // intrinsic value estimate, if known
  marketValue: number;
  unrealized: number;
  totalReturn: number; // unrealized + realized
  weight: number; // fraction of total market value (open positions)
}

export interface PortfolioSummary {
  positions: PositionValue[];
  totalValue: number; // market value of open holdings
  totalCost: number; // cost basis of open holdings
  unrealized: number;
  realized: number;
  totalGain: number; // unrealized + realized
}

// Average-cost accounting. Returns one Holding per ticker that ever traded,
// including fully-closed positions (shares === 0) so their realized P/L shows.
export function computeHoldings(txns: Transaction[]): Holding[] {
  const byTicker = new Map<string, Holding>();
  const ordered = [...txns].sort((a, b) => a.tradedOn.localeCompare(b.tradedOn) || a.id - b.id);

  for (const tx of ordered) {
    let h = byTicker.get(tx.ticker);
    if (!h) {
      h = { ticker: tx.ticker, shares: 0, costBasis: 0, avgCost: 0, realized: 0 };
      byTicker.set(tx.ticker, h);
    }
    if (tx.type === 'BUY') {
      h.shares += tx.shares;
      h.costBasis += tx.shares * tx.price;
    } else {
      const avg = h.shares > 0 ? h.costBasis / h.shares : 0;
      const sold = Math.min(tx.shares, h.shares);
      h.realized += sold * (tx.price - avg);
      h.costBasis -= sold * avg;
      h.shares -= sold;
      if (h.shares < 1e-9) {
        h.shares = 0;
        h.costBasis = 0;
      }
    }
    h.avgCost = h.shares > 0 ? h.costBasis / h.shares : 0;
  }

  return [...byTicker.values()].map((h) => ({
    ...h,
    shares: round(h.shares, 6),
    costBasis: round(h.costBasis, 2),
    avgCost: round(h.avgCost, 4),
    realized: round(h.realized, 2),
  }));
}

export function valuePositions(
  holdings: Holding[],
  quotes: Map<string, Quote>,
): PortfolioSummary {
  const positions: PositionValue[] = holdings.map((h) => {
    const q = quotes.get(h.ticker) ?? null;
    const price = q?.price ?? null;
    const marketValue = price !== null ? round(price * h.shares, 2) : 0;
    const unrealized = price !== null ? round(marketValue - h.costBasis, 2) : 0;
    return {
      ...h,
      name: q?.name ?? null,
      price,
      currency: q?.currency ?? null,
      pe: q?.pe ?? null,
      peg: q?.peg ?? null,
      iv: q?.iv ?? null,
      marketValue,
      unrealized,
      totalReturn: round(unrealized + h.realized, 2),
      weight: 0,
    };
  });

  const totalValue = round(
    positions.reduce((s, p) => s + p.marketValue, 0),
    2,
  );
  const totalCost = round(
    positions.reduce((s, p) => s + p.costBasis, 0),
    2,
  );
  const unrealized = round(
    positions.reduce((s, p) => s + p.unrealized, 0),
    2,
  );
  const realized = round(
    positions.reduce((s, p) => s + p.realized, 0),
    2,
  );

  for (const p of positions) {
    p.weight = totalValue > 0 ? round(p.marketValue / totalValue, 4) : 0;
  }

  // Open positions first, by market value desc; closed positions last.
  positions.sort((a, b) => b.marketValue - a.marketValue || a.ticker.localeCompare(b.ticker));

  return {
    positions,
    totalValue,
    totalCost,
    unrealized,
    realized,
    totalGain: round(unrealized + realized, 2),
  };
}

// Reconstruct daily portfolio market value from transactions + per-ticker price
// history. Pure: given the same inputs it always returns the same series.
export function computePortfolioHistory(
  txns: Transaction[],
  histories: Map<string, PricePoint[]>,
): PricePoint[] {
  if (txns.length === 0) return [];

  // Union of all trading dates across all tickers' histories.
  const dateSet = new Set<string>();
  for (const points of histories.values()) {
    for (const p of points) dateSet.add(p.date);
  }
  const dates = [...dateSet].sort();
  if (dates.length === 0) return [];

  // Fast lookup of close price by ticker+date, with forward-fill.
  const closeByTicker = new Map<string, Map<string, number>>();
  for (const [ticker, points] of histories) {
    const m = new Map<string, number>();
    let last = points[0]?.close ?? 0;
    const byDate = new Map(points.map((p) => [p.date, p.close]));
    for (const d of dates) {
      if (byDate.has(d)) last = byDate.get(d)!;
      m.set(d, last);
    }
    closeByTicker.set(ticker, m);
  }

  const ordered = [...txns].sort((a, b) => a.tradedOn.localeCompare(b.tradedOn) || a.id - b.id);

  return dates.map((date) => {
    // Shares held per ticker as of `date`.
    const shares = new Map<string, number>();
    for (const tx of ordered) {
      if (tx.tradedOn > date) break;
      const delta = tx.type === 'BUY' ? tx.shares : -tx.shares;
      shares.set(tx.ticker, (shares.get(tx.ticker) ?? 0) + delta);
    }
    let value = 0;
    for (const [ticker, sh] of shares) {
      if (sh <= 1e-9) continue;
      const close = closeByTicker.get(ticker)?.get(date) ?? 0;
      value += sh * close;
    }
    return { date, close: round(value, 2) };
  });
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
