// Pure value-growth scoring. No I/O so it is trivially unit-testable.
//
// Philosophy (per the VG Analyzer brief):
//  - Favour value: low, positive P/E and low PEG (growth-adjusted value).
//  - 3-month momentum is a SMALL factor (10%) — pulled-back beats run-up, but
//    it is not a gate.
//  - Discount to intrinsic value is a SMALL factor (10%) — the further the
//    price sits BELOW IV, the better. Anything trading ABOVE its IV is
//    excluded outright (hard gate).

export interface StockMetrics {
  ticker: string;
  pe: number | null; // forward P/E preferred (falls back to trailing if no forward)
  peg: number | null;
  momentum3m: number | null; // fractional return over ~3 months
  // (ivBase - price) / ivBase: +0.3 = price 30% below IV, negative = above IV.
  // null/omitted = unknown (scored neutral, not gated).
  ivDiscount?: number | null;
}

export interface ScoreResult {
  eligible: boolean;
  score: number; // 0..100
  pegScore: number;
  peScore: number;
  momentumScore: number;
  ivScore: number;
  rationale: string;
}

// PEG/P/E keep their original 64:36 ratio across the remaining 80%, with 10%
// for 3-month momentum and 10% for discount to intrinsic value.
export const WEIGHTS = { peg: 0.52, pe: 0.28, momentum: 0.1, ivDiscount: 0.1 } as const;

// Eligibility gates: profitable value names only, never priced above their IV.
export const GATES = {
  maxPe: 60,
  maxPeg: 3,
  minIvDiscount: 0, // price above intrinsic value => excluded
} as const;

// Momentum scoring band: down ~25% scores best, up ~25% scores worst.
const MOMENTUM_BEST = -0.25;
const MOMENTUM_WORST = 0.25;

// IV-discount scoring band: at-IV scores 0, 50%+ below IV scores 100.
const IV_DISCOUNT_FULL = 0.5;

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

// Linear map from value range [hi->0, lo->100], i.e. smaller is better.
function lowerBetter(value: number, best: number, worst: number): number {
  return clamp(((worst - value) / (worst - best)) * 100);
}

export interface FactorScores {
  pegScore: number;
  peScore: number;
  momentumScore: number;
  ivScore: number;
  score: number;
}

// Weighted factor scores WITHOUT eligibility gates — used to grade portfolio
// holdings even when they would be excluded from recommendations (e.g. trading
// above IV). Returns null when the core inputs (positive P/E and PEG) are missing.
export function computeFactorScores(m: StockMetrics): FactorScores | null {
  const { pe, peg, momentum3m } = m;
  const ivDiscount = m.ivDiscount ?? null;
  if (pe === null || pe <= 0 || peg === null || peg <= 0) return null;

  // PEG: 0.5 is excellent, 3.0 is the cutoff.
  const pegScore = lowerBetter(peg, 0.5, GATES.maxPeg);
  // P/E: 5 is cheap, 40 is rich.
  const peScore = lowerBetter(pe, 5, 40);
  // Momentum: pulled-back scores higher; null (no history) is neutral. Small weight.
  const momentumScore = momentum3m === null ? 50 : lowerBetter(momentum3m, MOMENTUM_BEST, MOMENTUM_WORST);
  // IV discount: deeper below intrinsic value scores higher; unknown is neutral.
  const ivScore = ivDiscount === null ? 50 : clamp((ivDiscount / IV_DISCOUNT_FULL) * 100);

  const score =
    pegScore * WEIGHTS.peg +
    peScore * WEIGHTS.pe +
    momentumScore * WEIGHTS.momentum +
    ivScore * WEIGHTS.ivDiscount;

  return {
    pegScore: round(pegScore, 1),
    peScore: round(peScore, 1),
    momentumScore: round(momentumScore, 1),
    ivScore: round(ivScore, 1),
    score: round(score, 2),
  };
}

export function scoreStock(m: StockMetrics): ScoreResult {
  const { pe, peg, momentum3m } = m;
  const ivDiscount = m.ivDiscount ?? null;

  const ineligible = (reason: string): ScoreResult => ({
    eligible: false,
    score: 0,
    pegScore: 0,
    peScore: 0,
    momentumScore: 0,
    ivScore: 0,
    rationale: reason,
  });

  if (pe === null || pe <= 0) return ineligible('No positive trailing P/E (unprofitable or unknown).');
  if (pe > GATES.maxPe) return ineligible(`P/E ${pe.toFixed(1)} too high (> ${GATES.maxPe}).`);
  if (peg === null || peg <= 0) return ineligible('No usable PEG ratio.');
  if (peg > GATES.maxPeg) return ineligible(`PEG ${peg.toFixed(2)} too high (> ${GATES.maxPeg}).`);
  if (ivDiscount !== null && ivDiscount < GATES.minIvDiscount)
    return ineligible(`Trades ${(-ivDiscount * 100).toFixed(0)}% above intrinsic value.`);

  const f = computeFactorScores(m)!; // gates guarantee pe/peg are usable

  const momText = momentum3m === null ? '' : `, 3-mo ${(momentum3m * 100).toFixed(1)}%`;
  const ivText = ivDiscount === null ? '' : `, ${(ivDiscount * 100).toFixed(0)}% below IV`;
  const rationale = `PEG ${peg.toFixed(2)}, Fwd P/E ${pe.toFixed(1)}${momText}${ivText} — ${describe(f.pegScore, f.peScore, f.momentumScore, f.ivScore)}`;

  return { eligible: true, ...f, rationale };
}

function describe(peg: number, pe: number, mom: number, iv: number): string {
  const parts: string[] = [];
  parts.push(peg >= 70 ? 'attractive growth-adjusted value' : peg >= 40 ? 'fair value' : 'rich vs growth');
  if (pe >= 70) parts.push('cheap earnings multiple');
  else if (pe >= 40) parts.push('reasonable multiple');
  if (mom >= 70) parts.push('pulled back');
  else if (mom <= 30) parts.push('has run up');
  if (iv >= 70) parts.push('deep discount to intrinsic value');
  return parts.join(', ') + '.';
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
