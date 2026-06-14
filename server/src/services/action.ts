// Buy/Hold/Sell from a discount-to-intrinsic-value fraction, shared by the ETF
// service. Mirrors the client's action.ts thresholds (±15% margin of safety):
//   discount >= +15%  -> Buy   (price well below IV)
//   discount <= -15%  -> Sell  (price well above IV)
//   within the band   -> Hold

export type Action = 'Buy' | 'Sell' | 'Hold';

export const MARGIN = 0.15;

export function actionFromDiscount(discount: number): Action {
  if (discount >= MARGIN) return 'Buy';
  if (discount <= -MARGIN) return 'Sell';
  return 'Hold';
}
