import type { IntrinsicValue } from './types';

export function money(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function number(value: number | null | undefined, dp = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function percent(fraction: number | null | undefined, dp = 1): string {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return '—';
  return `${(fraction * 100).toFixed(dp)}%`;
}

export function signClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return 'neutral';
  return value > 0 ? 'positive' : 'negative';
}

export function ratio(value: number | null | undefined, dp = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(dp);
}

// Compact intrinsic-value string: base figure, with optional bear–best range.
export function ivText(iv: IntrinsicValue | null | undefined, currency = 'USD'): string {
  if (!iv || iv.base === null || iv.base === undefined || Number.isNaN(iv.base)) return '—';
  return money(iv.base, currency);
}

export function ivRangeText(iv: IntrinsicValue | null | undefined, currency = 'USD'): string | null {
  if (!iv) return null;
  const hasRange = iv.bear != null && iv.best != null;
  if (!hasRange) return null;
  return `${money(iv.bear, currency)} – ${money(iv.best, currency)}`;
}

// Upside/(downside) of intrinsic base vs current price, as a fraction.
export function ivUpside(iv: IntrinsicValue | null | undefined, price: number | null | undefined): number | null {
  if (!iv || iv.base == null || price == null || price === 0) return null;
  return (iv.base - price) / price;
}
