import type { IntrinsicValue } from './types';

export type Action = 'Buy' | 'Sell' | 'Hold';

// Neutral band around intrinsic value. Inside ±15% of fair value we Hold; this
// is the classic "margin of safety" idea — only act when price is meaningfully
// away from intrinsic value, so normal noise doesn't churn the call.
export const MARGIN = 0.15;

export interface ActionResult {
  action: Action;
  discount: number | null; // (IV base - price) / IV base; +ve = below IV (cheap)
  reason: string;
}

// Derive a Buy/Sell/Hold from price vs intrinsic value:
//   price ≤ IV·(1 − 15%)  → Buy   (≥15% below fair value: margin of safety)
//   price ≥ IV·(1 + 15%)  → Sell  (≥15% above fair value: overvalued)
//   within ±15%           → Hold
// With no usable IV or price we can't judge valuation, so Hold.
export function actionForPosition(
  price: number | null | undefined,
  iv: IntrinsicValue | null | undefined,
): ActionResult {
  if (price == null || price <= 0 || !iv || iv.base == null || iv.base <= 0) {
    return { action: 'Hold', discount: null, reason: 'No intrinsic value to compare.' };
  }
  const discount = (iv.base - price) / iv.base;
  if (discount >= MARGIN) {
    return { action: 'Buy', discount, reason: `${pct(discount)} below intrinsic value.` };
  }
  if (discount <= -MARGIN) {
    return { action: 'Sell', discount, reason: `${pct(-discount)} above intrinsic value.` };
  }
  return { action: 'Hold', discount, reason: `Within ${pct(MARGIN)} of intrinsic value.` };
}

export function actionClass(action: Action): string {
  return action.toLowerCase(); // buy | sell | hold
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
