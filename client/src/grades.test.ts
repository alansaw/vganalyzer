import { describe, expect, it } from 'vitest';
import { gradeClass, gradeForScore } from './grades';

describe('gradeForScore', () => {
  it('maps the specified boundaries', () => {
    expect(gradeForScore(100)).toBe('A+');
    expect(gradeForScore(95)).toBe('A+'); // 95 and over
    expect(gradeForScore(94.99)).toBe('A');
    expect(gradeForScore(90)).toBe('A'); // 90–95
    expect(gradeForScore(89.99)).toBe('A-');
    expect(gradeForScore(85)).toBe('A-'); // 85–90
    expect(gradeForScore(84.99)).toBe('B');
    expect(gradeForScore(70)).toBe('B'); // 70–85
    expect(gradeForScore(69.99)).toBe('C'); // below 70
    expect(gradeForScore(0)).toBe('C');
  });
});

describe('gradeClass', () => {
  it('produces CSS-safe suffixes', () => {
    expect(gradeClass('A+')).toBe('aplus');
    expect(gradeClass('A-')).toBe('aminus');
    expect(gradeClass('B')).toBe('b');
  });
});
