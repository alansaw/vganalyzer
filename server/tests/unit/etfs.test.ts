import { describe, expect, it } from 'vitest';
import { buildEtfViews, ownedEtfAction, type OwnedEtf } from '../../src/services/etfs.js';
import type { Recommendation } from '../../src/services/recommendations.js';

function owned(p: Partial<OwnedEtf>): OwnedEtf {
  return {
    symbol: 'X', name: 'X', currency: 'USD', price: 10, aum: '$1B', category: 'test',
    strategy: 'covered-call', yield: 10, return1y: 0, ...p,
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

describe('ownedEtfAction (NAV-erosion signal)', () => {
  it('Sells a covered-call fund whose distributions miss NAV decline (total return < 0)', () => {
    const r = ownedEtfAction(owned({ strategy: 'covered-call', yield: 5.46, return1y: -20.8 }));
    expect(r.action).toBe('Sell');
    expect(r.totalReturn).toBeCloseTo(-15.3, 1);
  });

  it('Buys a covered-call fund with strong total return and NAV holding up', () => {
    const r = ownedEtfAction(owned({ strategy: 'covered-call', yield: 5.56, return1y: 21.8 }));
    expect(r.action).toBe('Buy');
  });

  it('Holds when income roughly offsets NAV erosion', () => {
    const r = ownedEtfAction(owned({ strategy: 'covered-call', yield: 13.53, return1y: -8.4 }));
    expect(r.action).toBe('Hold'); // total +5.1%, positive but NAV down past the -8 limit
  });

  it('requires a higher bar for leveraged-income funds', () => {
    // total return 10% would Buy a normal fund, but a leveraged one only Holds (<12 bar)
    const normal = ownedEtfAction(owned({ strategy: 'covered-call', yield: 5, return1y: 5 }));
    const levered = ownedEtfAction(owned({ strategy: 'leveraged-income', yield: 5, return1y: 5 }));
    expect(normal.action).toBe('Buy');
    expect(levered.action).toBe('Hold');
  });

  it('Holds (flagged) covered-call funds with too little distribution history', () => {
    const r = ownedEtfAction(owned({ strategy: 'covered-call', yield: 1.65, return1y: -8 }));
    expect(r.action).toBe('Hold');
    expect(r.reason).toMatch(/limited distribution history/i);
  });

  it('gives no action to dividend or broad funds', () => {
    expect(ownedEtfAction(owned({ strategy: 'dividend', yield: 3.2, return1y: -17 })).action).toBeNull();
    expect(ownedEtfAction(owned({ strategy: 'broad', yield: 1, return1y: -30 })).action).toBeNull();
  });
});
