import { describe, expect, it } from 'vitest';
import { buildEtfViews } from '../../src/services/etfs.js';
import type { Recommendation } from '../../src/services/recommendations.js';

function rec(ticker: string, price: number, ivBase: number): Recommendation {
  return {
    ticker, name: ticker, market: ticker.endsWith('.TO') ? 'CA' : 'US',
    price, pe: 10, forwardPe: 9, peg: 0.8, iv: { base: ivBase, bear: null, best: null },
    momentum3m: -0.05, score: 80, rationale: '', rank: 1, generatedAt: '2026-06-13T00:00:00Z',
  };
}

describe('buildEtfViews', () => {
  it('counts overlap and lists matched recommended holdings', () => {
    const views = buildEtfViews([rec('NVDA', 100, 120), rec('AVGO', 100, 120), rec('TXN', 100, 120)]);
    const smh = views.find((v) => v.symbol === 'SMH')!;
    expect(smh.recommendedCount).toBe(3);
    expect(smh.matches.sort()).toEqual(['AVGO', 'NVDA', 'TXN']);
    expect(smh.holdingsCount).toBeGreaterThan(3);
  });

  it('derives Buy when recommended holdings average >=15% below IV', () => {
    // price 80 vs IV 120 => 33% discount
    const views = buildEtfViews([rec('XOM', 80, 120), rec('CVX', 80, 120)]);
    const xle = views.find((v) => v.symbol === 'XLE')!;
    expect(xle.action).toBe('Buy');
    expect(xle.avgDiscount).toBeCloseTo(0.333, 2);
  });

  it('derives Hold when holdings sit within the margin band', () => {
    const views = buildEtfViews([rec('XOM', 115, 120), rec('CVX', 115, 120)]); // ~4% discount
    expect(views.find((v) => v.symbol === 'XLE')!.action).toBe('Hold');
  });

  it('returns null action and a reason when no holdings are recommended', () => {
    const views = buildEtfViews([rec('NVDA', 100, 120)]); // only semis recommended
    const xle = views.find((v) => v.symbol === 'XLE')!;
    expect(xle.recommendedCount).toBe(0);
    expect(xle.action).toBeNull();
    expect(xle.reason).toMatch(/no current recommendations/i);
  });

  it('sorts ETFs with the most recommended holdings first', () => {
    const views = buildEtfViews([rec('NVDA', 80, 120), rec('AVGO', 80, 120), rec('XOM', 80, 120)]);
    // SMH (2 matches) should come before XLE (1 match)
    const smhIdx = views.findIndex((v) => v.symbol === 'SMH');
    const xleIdx = views.findIndex((v) => v.symbol === 'XLE');
    expect(smhIdx).toBeLessThan(xleIdx);
  });
});
