import { describe, expect, it } from 'vitest';
import { computeFactorScores, scoreStock } from '../../src/services/scoring.js';

describe('scoreStock', () => {
  it('scores a cheap, pulled-back value stock as eligible with a high score', () => {
    const r = scoreStock({ ticker: 'INTC', pe: 9, peg: 0.7, momentum3m: -0.1 });
    expect(r.eligible).toBe(true);
    expect(r.score).toBeGreaterThan(60);
    expect(r.rationale).toContain('PEG 0.70');
  });

  it('rejects unprofitable stocks (non-positive P/E)', () => {
    expect(scoreStock({ ticker: 'X', pe: null, peg: 1, momentum3m: 0 }).eligible).toBe(false);
    expect(scoreStock({ ticker: 'X', pe: -5, peg: 1, momentum3m: 0 }).eligible).toBe(false);
  });

  it('still scores a low-PEG name that has run up (momentum no longer gates)', () => {
    const r = scoreStock({ ticker: 'MU', pe: 44, peg: 0.2, momentum3m: 0.7 });
    expect(r.eligible).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  it('still scores a name that sold off sharply (no momentum floor)', () => {
    expect(scoreStock({ ticker: 'X', pe: 8, peg: 0.5, momentum3m: -0.6 }).eligible).toBe(true);
  });

  it('rejects PEG above the gate', () => {
    expect(scoreStock({ ticker: 'X', pe: 20, peg: 4, momentum3m: -0.05 }).eligible).toBe(false);
  });

  it('still rejects P/E above the gate and unprofitable names', () => {
    expect(scoreStock({ ticker: 'X', pe: 75, peg: 1, momentum3m: 0 }).eligible).toBe(false);
    expect(scoreStock({ ticker: 'X', pe: 0, peg: 1, momentum3m: 0 }).eligible).toBe(false);
  });

  it('prefers a lower PEG when other factors are equal', () => {
    const low = scoreStock({ ticker: 'A', pe: 15, peg: 0.8, momentum3m: -0.05 });
    const high = scoreStock({ ticker: 'B', pe: 15, peg: 2.5, momentum3m: -0.05 });
    expect(low.score).toBeGreaterThan(high.score);
  });

  it('applies a small momentum factor (pulled-back scores higher than ran-up)', () => {
    const ranUp = scoreStock({ ticker: 'A', pe: 12, peg: 1, momentum3m: 0.5 });
    const pulledBack = scoreStock({ ticker: 'B', pe: 12, peg: 1, momentum3m: -0.15 });
    expect(pulledBack.score).toBeGreaterThan(ranUp.score);
    // ...but momentum is only a small nudge: same PEG/PE keeps them close.
    expect(pulledBack.score - ranUp.score).toBeLessThan(12);
  });

  it('excludes stocks trading above their intrinsic value', () => {
    const r = scoreStock({ ticker: 'NVDA', pe: 20, peg: 0.6, momentum3m: 0, ivDiscount: -0.62 });
    expect(r.eligible).toBe(false);
    expect(r.rationale).toContain('above intrinsic value');
  });

  it('scores a deeper discount to IV higher (10% weight)', () => {
    const deep = scoreStock({ ticker: 'A', pe: 12, peg: 1, momentum3m: 0, ivDiscount: 0.5 });
    const shallow = scoreStock({ ticker: 'B', pe: 12, peg: 1, momentum3m: 0, ivDiscount: 0.05 });
    expect(deep.score).toBeGreaterThan(shallow.score);
    // bounded by the 10% weight
    expect(deep.score - shallow.score).toBeLessThanOrEqual(10);
    expect(deep.rationale).toContain('50% below IV');
  });

  it('treats unknown IV as neutral, not excluded', () => {
    const r = scoreStock({ ticker: 'X', pe: 12, peg: 1, momentum3m: 0 });
    expect(r.eligible).toBe(true);
    expect(r.ivScore).toBe(50);
  });

  it('computeFactorScores matches scoreStock for eligible stocks', () => {
    const m = { ticker: 'A', pe: 12, peg: 1, momentum3m: -0.05, ivDiscount: 0.3 };
    const gated = scoreStock(m);
    const ungated = computeFactorScores(m);
    expect(gated.eligible).toBe(true);
    expect(ungated?.score).toBe(gated.score);
  });

  it('computeFactorScores still grades stocks the gates would exclude (above IV)', () => {
    const m = { ticker: 'NVDA', pe: 20.64, peg: 0.6, momentum3m: 0.35, ivDiscount: -1.6 };
    expect(scoreStock(m).eligible).toBe(false); // gated out of recommendations
    const f = computeFactorScores(m);
    expect(f).not.toBeNull(); // …but still gradable as a holding
    expect(f!.score).toBeGreaterThan(0);
    expect(f!.ivScore).toBe(0); // above IV floors the IV factor
  });

  it('computeFactorScores returns null without usable PE/PEG', () => {
    expect(computeFactorScores({ ticker: 'X', pe: null, peg: 1, momentum3m: 0 })).toBeNull();
    expect(computeFactorScores({ ticker: 'X', pe: 10, peg: null, momentum3m: 0 })).toBeNull();
  });

  it('keeps scores within 0..100', () => {
    const r = scoreStock({ ticker: 'A', pe: 5, peg: 0.5, momentum3m: -0.25, ivDiscount: 0.6 });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});
