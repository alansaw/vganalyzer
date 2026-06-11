import { describe, expect, it } from 'vitest';
import type { Quote } from '../../src/providers/types.js';
import {
  computeHoldings,
  computePortfolioHistory,
  valuePositions,
  type Transaction,
} from '../../src/services/portfolio.js';

function tx(p: Partial<Transaction> & Pick<Transaction, 'id' | 'ticker' | 'type' | 'shares' | 'price' | 'tradedOn'>): Transaction {
  return { notes: null, ...p };
}

describe('computeHoldings', () => {
  it('accumulates buys with an average cost basis', () => {
    const [h] = computeHoldings([
      tx({ id: 1, ticker: 'ABC', type: 'BUY', shares: 10, price: 100, tradedOn: '2025-01-01' }),
      tx({ id: 2, ticker: 'ABC', type: 'BUY', shares: 10, price: 120, tradedOn: '2025-02-01' }),
    ]);
    expect(h.shares).toBe(20);
    expect(h.costBasis).toBe(2200);
    expect(h.avgCost).toBe(110);
    expect(h.realized).toBe(0);
  });

  it('handles a partial sell with realized P/L (average cost)', () => {
    const [h] = computeHoldings([
      tx({ id: 1, ticker: 'ABC', type: 'BUY', shares: 10, price: 100, tradedOn: '2025-01-01' }),
      tx({ id: 2, ticker: 'ABC', type: 'BUY', shares: 10, price: 120, tradedOn: '2025-02-01' }),
      tx({ id: 3, ticker: 'ABC', type: 'SELL', shares: 5, price: 130, tradedOn: '2025-03-01' }),
    ]);
    expect(h.shares).toBe(15);
    expect(h.avgCost).toBe(110);
    expect(h.costBasis).toBe(1650);
    expect(h.realized).toBe(100); // 5 * (130 - 110)
  });

  it('zeroes out a fully sold position but keeps realized P/L', () => {
    const [h] = computeHoldings([
      tx({ id: 1, ticker: 'ABC', type: 'BUY', shares: 10, price: 100, tradedOn: '2025-01-01' }),
      tx({ id: 2, ticker: 'ABC', type: 'SELL', shares: 10, price: 150, tradedOn: '2025-04-01' }),
    ]);
    expect(h.shares).toBe(0);
    expect(h.costBasis).toBe(0);
    expect(h.realized).toBe(500);
  });
});

describe('valuePositions', () => {
  it('values open holdings against current quotes', () => {
    const holdings = computeHoldings([
      tx({ id: 1, ticker: 'ABC', type: 'BUY', shares: 10, price: 100, tradedOn: '2025-01-01' }),
      tx({ id: 2, ticker: 'ABC', type: 'BUY', shares: 10, price: 120, tradedOn: '2025-02-01' }),
      tx({ id: 3, ticker: 'ABC', type: 'SELL', shares: 5, price: 130, tradedOn: '2025-03-01' }),
    ]);
    const quotes = new Map<string, Quote>([
      ['ABC', { ticker: 'ABC', name: 'ABC Co', price: 150, currency: 'USD', pe: 12, forwardPe: 10, peg: 1, eps: 12, marketCap: 1 }],
    ]);
    const summary = valuePositions(holdings, quotes);
    const p = summary.positions[0];
    expect(p.marketValue).toBe(2250); // 15 * 150
    expect(p.unrealized).toBe(600); // 2250 - 1650
    expect(p.totalReturn).toBe(700); // 600 + 100 realized
    expect(p.weight).toBe(1);
    expect(summary.totalValue).toBe(2250);
    expect(summary.totalGain).toBe(700);
  });

  it('computes weights across multiple positions', () => {
    const holdings = computeHoldings([
      tx({ id: 1, ticker: 'AAA', type: 'BUY', shares: 10, price: 10, tradedOn: '2025-01-01' }),
      tx({ id: 2, ticker: 'BBB', type: 'BUY', shares: 10, price: 10, tradedOn: '2025-01-01' }),
    ]);
    const quotes = new Map<string, Quote>([
      ['AAA', { ticker: 'AAA', name: 'A', price: 30, currency: 'USD', pe: 1, forwardPe: 1, peg: 1, eps: 1, marketCap: 1 }],
      ['BBB', { ticker: 'BBB', name: 'B', price: 10, currency: 'USD', pe: 1, forwardPe: 1, peg: 1, eps: 1, marketCap: 1 }],
    ]);
    const summary = valuePositions(holdings, quotes);
    const total = summary.positions.reduce((s, p) => s + p.weight, 0);
    expect(total).toBeCloseTo(1, 4);
    expect(summary.positions[0].ticker).toBe('AAA'); // largest first
  });
});

describe('computePortfolioHistory', () => {
  it('reconstructs daily value and is zero before the first buy', () => {
    const txns = [
      tx({ id: 1, ticker: 'ABC', type: 'BUY', shares: 10, price: 100, tradedOn: '2025-01-02' }),
    ];
    const histories = new Map([
      [
        'ABC',
        [
          { date: '2025-01-01', close: 90 },
          { date: '2025-01-02', close: 100 },
          { date: '2025-01-03', close: 110 },
        ],
      ],
    ]);
    const series = computePortfolioHistory(txns, histories);
    expect(series).toEqual([
      { date: '2025-01-01', close: 0 },
      { date: '2025-01-02', close: 1000 },
      { date: '2025-01-03', close: 1100 },
    ]);
  });

  it('returns an empty series with no transactions', () => {
    expect(computePortfolioHistory([], new Map())).toEqual([]);
  });
});
