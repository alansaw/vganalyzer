import type { IntrinsicValue } from '../providers/types.js';

// Transparent fallback intrinsic-value estimate so EVERY stock shows an IV.
// It is a simple two-stage discounted-earnings model on FORWARD EPS:
//
//   forward EPS (year 1) = price / forwardP/E
//   near-term growth g   = trailingP/E / forwardP/E - 1   (capped 2%..20%)
//   EPS grows at g in year 2, fading linearly to the terminal rate by year 5
//   terminal value       = EPS5 * (1+gt) / (r - gt)
//   IV = present value of years 1-5 + PV(terminal), discounted at r
//
// bear/best widen the range via a higher/lower discount rate and slower/faster
// growth. This is intentionally conservative and fully reproducible — a pinned
// DCF value (quote.iv) always takes precedence over this estimate.

export interface IvInputs {
  price: number | null;
  pe: number | null; // trailing P/E
  forwardPe: number | null;
  peg: number | null;
}

const DISCOUNT = 0.11; // generic equity discount rate
const TERMINAL_G = 0.03;
const YEARS = 5;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// PV of a forward-EPS stream: year 1 = eps1, years 2..5 grow at g fading to gt.
function pvEpsStream(eps1: number, g: number, r: number, gt: number): number {
  let eps = eps1;
  let pv = eps1 / (1 + r);
  for (let y = 2; y <= YEARS; y++) {
    const frac = (y - 2) / (YEARS - 2); // 0 at y2 → 1 at y5
    const growth = g + (gt - g) * frac;
    eps = eps * (1 + growth);
    pv += eps / Math.pow(1 + r, y);
  }
  const terminal = (eps * (1 + gt)) / (r - gt);
  pv += terminal / Math.pow(1 + r, YEARS);
  return pv;
}

export function estimateIntrinsicValue(i: IvInputs): IntrinsicValue | null {
  const price = i.price;
  const fpe = i.forwardPe ?? i.pe;
  if (price == null || price <= 0 || fpe == null || fpe <= 0) return null;

  const eps1 = price / fpe; // next-year (forward) EPS

  // Near-term growth: prefer the trailing→forward earnings ramp, else derive
  // from PEG, else a modest default. Capped so cyclical spikes don't explode.
  let g = 0.05;
  if (i.pe != null && i.pe > 0 && i.forwardPe != null && i.forwardPe > 0) {
    g = clamp(i.pe / i.forwardPe - 1, 0.02, 0.2);
  } else if (i.peg != null && i.peg > 0 && i.pe != null && i.pe > 0) {
    g = clamp(i.pe / i.peg / 100, 0.02, 0.2);
  }

  const base = pvEpsStream(eps1, g, DISCOUNT, TERMINAL_G);
  const bear = pvEpsStream(eps1, clamp(g * 0.5, 0, 0.2), DISCOUNT + 0.015, TERMINAL_G - 0.005);
  const best = pvEpsStream(eps1, clamp(g * 1.3, 0, 0.25), DISCOUNT - 0.015, TERMINAL_G + 0.005);

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    base: round(base),
    bear: round(Math.min(bear, base)),
    best: round(Math.max(best, base)),
  };
}

// Pinned IV wins; otherwise compute the fallback.
export function resolveIntrinsicValue(
  pinned: IntrinsicValue | null | undefined,
  inputs: IvInputs,
): IntrinsicValue | null {
  return pinned ?? estimateIntrinsicValue(inputs);
}
