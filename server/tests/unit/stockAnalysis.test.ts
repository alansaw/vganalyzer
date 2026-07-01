import { describe, expect, it } from 'vitest';
import { cleanName } from '../../src/providers/stockAnalysis.js';

describe('cleanName', () => {
  it('keeps just the company name from a quote-page title', () => {
    expect(cleanName('Suncor Energy (TSX:SU) Stock Price &amp; Overview', 'SU.TO')).toBe('Suncor Energy');
    expect(cleanName('NVIDIA Corporation (NASDAQ:NVDA) Stock Price & Overview', 'NVDA')).toBe(
      'NVIDIA Corporation',
    );
    expect(cleanName('Tencent Holdings (OTC:TCEHY) Stock Price', 'TCEHY')).toBe('Tencent Holdings');
    // Stocks-page titles use a bare ticker tag: "Amazon.com (AMZN) ...".
    expect(cleanName('Amazon.com (AMZN) Stock Price & Overview', 'AMZN')).toBe('Amazon.com');
  });

  it('decodes HTML entities', () => {
    expect(cleanName('AT&amp;T Inc.', 'T')).toBe('AT&T Inc.');
  });

  it('falls back to the ticker when the title is missing or empty', () => {
    expect(cleanName(undefined, 'XYZ')).toBe('XYZ');
    expect(cleanName('   ', 'abc')).toBe('ABC');
  });
});
