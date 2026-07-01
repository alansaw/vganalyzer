import type { IntrinsicValue } from '../providers/types.js';

// Per-stock, assumption-driven two-stage DCF. Unlike the generic fallback
// estimate, every input here is explicit and stored per ticker, so a wide-moat
// compounder, a margin-inflecting platform, and a cyclical commodity each get
// their own discount rate and growth path — and every number is inspectable.
//
//   Stage 1: `eps0` (an anchor earnings/FCF-per-share) grows at `growth`,
//            fading linearly to `terminalGrowth` over `years`.
//   Stage 2: Gordon terminal value on the faded earnings.
//   Discount everything at `discountRate`; add `netCashPerShare`.
//
// bear/best come from a symmetric sensitivity band on the two inputs the result
// is most sensitive to: discount rate (±`drSensitivity`) and near-term growth
// (×0.7 / ×1.3), so the range reflects THIS stock's assumption uncertainty.

export interface DcfAssumptions {
  eps0: number; // anchor forward earnings (or FCF) per share, in the stock's currency
  growth: number; // near-term annual growth, e.g. 0.16 = 16%
  terminalGrowth: number; // perpetual growth after the fade, e.g. 0.03
  discountRate: number; // required return / WACC, e.g. 0.09
  years?: number; // explicit forecast horizon (default 5)
  netCashPerShare?: number; // net cash added to equity value (can be negative)
  drSensitivity?: number; // ± on discount rate for bear/best (default 0.01)
  rationale?: string; // short human note on why these inputs
}

const DEFAULT_YEARS = 5;

function pvStream(a: Required<Pick<DcfAssumptions, 'eps0' | 'growth' | 'terminalGrowth'>> & {
  discountRate: number;
  years: number;
  netCashPerShare: number;
}): number {
  const { eps0, growth, terminalGrowth: gt, discountRate: r, years, netCashPerShare } = a;
  // Guard: terminal growth must be below the discount rate for a finite value.
  const safeGt = Math.min(gt, r - 0.01);
  let eps = eps0;
  let pv = 0;
  for (let y = 1; y <= years; y++) {
    // Fade from `growth` (year 1) toward `safeGt` (final year).
    const frac = years === 1 ? 1 : (y - 1) / (years - 1);
    const gY = growth + (safeGt - growth) * frac;
    eps = y === 1 ? eps0 * (1 + growth) : eps * (1 + gY);
    pv += eps / Math.pow(1 + r, y);
  }
  const terminal = (eps * (1 + safeGt)) / (r - safeGt);
  pv += terminal / Math.pow(1 + r, years);
  return pv + netCashPerShare;
}

export function computeDcf(a: DcfAssumptions): IntrinsicValue {
  const years = a.years ?? DEFAULT_YEARS;
  const netCashPerShare = a.netCashPerShare ?? 0;
  const drSens = a.drSensitivity ?? 0.01;

  const base = pvStream({ ...a, terminalGrowth: a.terminalGrowth, years, netCashPerShare });
  // Bear: higher discount rate + slower growth. Best: lower discount + faster.
  const bear = pvStream({
    ...a,
    growth: a.growth * 0.7,
    discountRate: a.discountRate + drSens,
    years,
    netCashPerShare,
  });
  const best = pvStream({
    ...a,
    growth: a.growth * 1.3,
    discountRate: Math.max(a.discountRate - drSens, a.terminalGrowth + 0.02),
    years,
    netCashPerShare,
  });

  const round = (n: number) => Math.round(n);
  return {
    base: round(base),
    bear: round(Math.min(bear, base)),
    best: round(Math.max(best, base)),
  };
}
