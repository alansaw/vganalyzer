import { describe, expect, it } from 'vitest';
import { money, number, percent, ratio, signClass } from './format';

describe('format helpers', () => {
  it('formats money with currency', () => {
    expect(money(1234.5)).toBe('$1,234.50');
    expect(money(1000, 'CAD')).toBe('CA$1,000.00');
    expect(money(null)).toBe('—');
    expect(money(undefined)).toBe('—');
  });

  it('formats plain numbers', () => {
    expect(number(1234.567)).toBe('1,234.57');
    expect(number(50, 0)).toBe('50');
    expect(number(null)).toBe('—');
  });

  it('formats percentages from fractions', () => {
    expect(percent(0.1234)).toBe('12.3%');
    expect(percent(-0.05)).toBe('-5.0%');
    expect(percent(null)).toBe('—');
  });

  it('formats ratios', () => {
    expect(ratio(1.2345)).toBe('1.23');
    expect(ratio(9, 1)).toBe('9.0');
    expect(ratio(null)).toBe('—');
  });

  it('classifies sign', () => {
    expect(signClass(5)).toBe('positive');
    expect(signClass(-5)).toBe('negative');
    expect(signClass(0)).toBe('neutral');
    expect(signClass(null)).toBe('neutral');
  });
});
