import { describe, expect, it } from 'vitest';
import { estimateIntrinsicValue, resolveIntrinsicValue } from '../../src/services/intrinsicValue.js';

describe('estimateIntrinsicValue', () => {
  it('produces a base IV with an ordered bear <= base <= best range', () => {
    const iv = estimateIntrinsicValue({ price: 100, pe: 20, forwardPe: 15, peg: 1 });
    expect(iv).not.toBeNull();
    expect(iv!.base).toBeGreaterThan(0);
    expect(iv!.bear!).toBeLessThanOrEqual(iv!.base);
    expect(iv!.best!).toBeGreaterThanOrEqual(iv!.base);
  });

  it('returns null when price or forward/trailing P/E is missing', () => {
    expect(estimateIntrinsicValue({ price: null, pe: 20, forwardPe: 15, peg: 1 })).toBeNull();
    expect(estimateIntrinsicValue({ price: 100, pe: null, forwardPe: null, peg: null })).toBeNull();
  });

  it('falls back to trailing P/E when forward P/E is absent', () => {
    const iv = estimateIntrinsicValue({ price: 100, pe: 18, forwardPe: null, peg: null });
    expect(iv).not.toBeNull();
    expect(iv!.base).toBeGreaterThan(0);
  });

  it('values a faster-growing (lower forward P/E vs trailing) name higher per $ of price', () => {
    const grower = estimateIntrinsicValue({ price: 100, pe: 40, forwardPe: 20, peg: 1 })!;
    const flat = estimateIntrinsicValue({ price: 100, pe: 20, forwardPe: 20, peg: 1 })!;
    expect(grower.base).toBeGreaterThan(flat.base);
  });

  it('caps growth so a cyclical earnings spike does not explode the IV', () => {
    // trailing 200, forward 10 implies ~1900% growth -> must be capped at 20%.
    const iv = estimateIntrinsicValue({ price: 100, pe: 200, forwardPe: 10, peg: 0.05 })!;
    const capped = estimateIntrinsicValue({ price: 100, pe: 12, forwardPe: 10, peg: 1 })!;
    expect(iv.base).toBeCloseTo(capped.base, 0); // both hit the 20% growth cap
  });
});

describe('resolveIntrinsicValue', () => {
  it('prefers a pinned IV over the computed estimate', () => {
    const pinned = { base: 250, bear: 175, best: 330 };
    const out = resolveIntrinsicValue(pinned, { price: 100, pe: 20, forwardPe: 15, peg: 1 });
    expect(out).toBe(pinned);
  });

  it('computes an estimate when none is pinned', () => {
    const out = resolveIntrinsicValue(null, { price: 100, pe: 20, forwardPe: 15, peg: 1 });
    expect(out).not.toBeNull();
    expect(out!.base).toBeGreaterThan(0);
  });
});
