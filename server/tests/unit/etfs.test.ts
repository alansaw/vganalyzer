import { describe, expect, it } from 'vitest';
import { buildEtfViews, ownedEtfAction, type OwnedEtf } from '../../src/services/etfs.js';
import type { Recommendation } from '../../src/services/recommendations.js';

function owned(p: Partial<OwnedEtf>): OwnedEtf {
  return {
    symbol: 'X', name: 'X', currency: 'USD', price: 10, aum: '$1B', category: 'test',
    strategy: 'covered-call', yield: 10, totalReturn1y: 0, ...p,
  };
}

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
    expect(smh.totalHoldings).toBe(26); // the fund's actual position count, not our mapped subset
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

describe('ownedEtfAction (NAV-erosion signal, from total return)', () => {
  it('Buys a high-yield covered-call fund with strong total return and NAV holding up (real GPIX)', () => {
    // GPIX: total +25.88%, yield 7.97% => NAV ~+17.9% (no erosion) -> Buy, not Sell
    const r = ownedEtfAction(owned({ strategy: 'covered-call', yield: 7.97, totalReturn1y: 25.88 }));
    expect(r.action).toBe('Buy');
    expect(r.navChange).toBeCloseTo(17.9, 1);
  });

  it('does NOT cry erosion when a covered-call fund is up on a total-return basis (real IDVO)', () => {
    const r = ownedEtfAction(owned({ strategy: 'covered-call', yield: 5.43, totalReturn1y: 36.09 }));
    expect(r.action).toBe('Buy');
    expect(r.navChange).toBeGreaterThan(0);
  });

  it('Sells only when total return is actually negative', () => {
    const r = ownedEtfAction(owned({ strategy: 'covered-call', yield: 10, totalReturn1y: -4 }));
    expect(r.action).toBe('Sell');
  });

  it('Holds when NAV is eroding even though total return is positive', () => {
    // total +6%, yield 13% => NAV ~-7% (distributions partly return of capital)
    const r = ownedEtfAction(owned({ strategy: 'covered-call', yield: 13, totalReturn1y: 6 }));
    expect(r.action).toBe('Hold');
    expect(r.reason).toMatch(/return of capital/i);
  });

  it('requires a higher total-return bar for leveraged-income funds', () => {
    // total 10%, yield 2% => NAV +8% (fine), but 10% < 12% leveraged Buy bar -> Hold
    const normal = ownedEtfAction(owned({ strategy: 'covered-call', yield: 2, totalReturn1y: 10 }));
    const levered = ownedEtfAction(owned({ strategy: 'leveraged-income', yield: 2, totalReturn1y: 10 }));
    expect(normal.action).toBe('Buy');
    expect(levered.action).toBe('Hold');
  });

  it('Holds (flagged) funds too new to have a 1-year total return', () => {
    const r = ownedEtfAction(owned({ strategy: 'covered-call', yield: 1.62, totalReturn1y: null }));
    expect(r.action).toBe('Hold');
    expect(r.reason).toMatch(/too new/i);
  });

  it('gives no action to dividend or broad funds', () => {
    expect(ownedEtfAction(owned({ strategy: 'dividend', yield: 3.2, totalReturn1y: 26 })).action).toBeNull();
    expect(ownedEtfAction(owned({ strategy: 'broad', yield: 1, totalReturn1y: 55 })).action).toBeNull();
  });
});
