import { describe, expect, it } from 'vitest';
import { actionForPosition } from './action';

const iv = { base: 100, bear: 80, best: 130 };

describe('actionForPosition', () => {
  it('says Buy when price is >=15% below intrinsic value', () => {
    expect(actionForPosition(85, iv).action).toBe('Buy'); // exactly 15% below
    expect(actionForPosition(60, iv).action).toBe('Buy');
  });

  it('says Sell when price is >=15% above intrinsic value', () => {
    expect(actionForPosition(115, iv).action).toBe('Sell'); // exactly 15% above
    expect(actionForPosition(150, iv).action).toBe('Sell');
  });

  it('says Hold within the +/-15% band', () => {
    expect(actionForPosition(100, iv).action).toBe('Hold');
    expect(actionForPosition(90, iv).action).toBe('Hold');
    expect(actionForPosition(110, iv).action).toBe('Hold');
  });

  it('holds (with a reason) when price or IV is missing', () => {
    expect(actionForPosition(null, iv)).toMatchObject({ action: 'Hold', discount: null });
    expect(actionForPosition(100, null)).toMatchObject({ action: 'Hold', discount: null });
    expect(actionForPosition(100, { base: 0 }).action).toBe('Hold');
  });

  it('reports the discount and a human reason', () => {
    const buy = actionForPosition(70, iv);
    expect(buy.discount).toBeCloseTo(0.3, 5);
    expect(buy.reason).toContain('30% below');
    expect(actionForPosition(130, iv).reason).toContain('30% above');
  });

  it('matches the holdings: NVDA $228 IV vs $205 -> Hold, SE $167 vs $85 -> Buy', () => {
    expect(actionForPosition(205.38, { base: 228, bear: 109, best: 319 }).action).toBe('Hold');
    expect(actionForPosition(84.87, { base: 167, bear: 142, best: 205 }).action).toBe('Buy');
  });
});
