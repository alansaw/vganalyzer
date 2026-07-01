import { describe, expect, it } from 'vitest';
import { computeDcf } from '../../src/services/dcf.js';

describe('computeDcf', () => {
  it('produces base with an ordered bear <= base <= best band', () => {
    const iv = computeDcf({ eps0: 8.97, growth: 0.3, terminalGrowth: 0.04, discountRate: 0.105, netCashPerShare: 2 });
    expect(iv.base).toBeGreaterThan(0);
    expect(iv.bear!).toBeLessThanOrEqual(iv.base);
    expect(iv.best!).toBeGreaterThanOrEqual(iv.base);
  });

  it('reproduces the calibrated per-stock targets within a few percent', () => {
    // Same assumptions as manual-prices.json, checked against Gemini's targets.
    const nvda = computeDcf({ eps0: 8.97, growth: 0.3, terminalGrowth: 0.04, discountRate: 0.105, netCashPerShare: 2 });
    expect(nvda.base).toBeGreaterThan(230);
    expect(nvda.base).toBeLessThan(265); // ~$249 vs Gemini $245

    const mu = computeDcf({ eps0: 75, growth: 0.15, terminalGrowth: 0.03, discountRate: 0.11 });
    expect(mu.base).toBeGreaterThan(1150);
    expect(mu.base).toBeLessThan(1350); // ~$1253 vs Gemini $1350

    const tcehy = computeDcf({ eps0: 3.45, growth: 0.11, terminalGrowth: 0.03, discountRate: 0.1, netCashPerShare: 5 });
    expect(tcehy.base).toBeGreaterThan(58);
    expect(tcehy.base).toBeLessThan(74); // ~$66 vs Gemini $72
  });

  it('values a lower discount rate higher (rate sensitivity)', () => {
    const low = computeDcf({ eps0: 10, growth: 0.15, terminalGrowth: 0.03, discountRate: 0.08 });
    const high = computeDcf({ eps0: 10, growth: 0.15, terminalGrowth: 0.03, discountRate: 0.12 });
    expect(low.base).toBeGreaterThan(high.base);
  });

  it('values faster near-term growth higher', () => {
    const slow = computeDcf({ eps0: 10, growth: 0.1, terminalGrowth: 0.03, discountRate: 0.1 });
    const fast = computeDcf({ eps0: 10, growth: 0.25, terminalGrowth: 0.03, discountRate: 0.1 });
    expect(fast.base).toBeGreaterThan(slow.base);
  });

  it('adds net cash per share to equity value', () => {
    const noCash = computeDcf({ eps0: 10, growth: 0.1, terminalGrowth: 0.03, discountRate: 0.1 });
    const withCash = computeDcf({ eps0: 10, growth: 0.1, terminalGrowth: 0.03, discountRate: 0.1, netCashPerShare: 20 });
    expect(withCash.base - noCash.base).toBe(20);
  });

  it('stays finite when terminal growth is set at/above the discount rate', () => {
    const iv = computeDcf({ eps0: 10, growth: 0.1, terminalGrowth: 0.12, discountRate: 0.1 });
    expect(Number.isFinite(iv.base)).toBe(true);
    expect(iv.base).toBeGreaterThan(0);
  });
});
