import { describe, expect, it } from 'vitest';
import { RealHistoryProvider, parseApiSeries, parsePageSeries } from '../../src/providers/realHistory.js';
import type { HistoryOptions, MarketDataProvider, PricePoint } from '../../src/providers/types.js';

describe('parseApiSeries', () => {
  it('maps and sorts the JSON history payload ascending', () => {
    const out = parseApiSeries({
      status: 200,
      data: [
        { t: '2026-06-11', o: 201.49, c: 204.87 },
        { t: '2026-06-10', o: 199.2, c: 201.3 },
      ],
    });
    expect(out).toEqual([
      { date: '2026-06-10', close: 201.3 },
      { date: '2026-06-11', close: 204.87 },
    ]);
  });

  it('returns empty for malformed payloads', () => {
    expect(parseApiSeries({ status: 404 })).toEqual([]);
    expect(parseApiSeries(null)).toEqual([]);
    expect(parseApiSeries({ data: [{ t: '2026-01-01' }] })).toEqual([]); // missing close
  });
});

describe('parsePageSeries', () => {
  it('extracts {c,t} pairs and collapses to one point per day (last wins)', () => {
    // 2026-06-11 00:00 UTC = 1781136000; +6h same day; next day +24h
    const html =
      'x{c:100.5,t:1781136000}y{c:101.25,t:1781157600}z{c:99.75,t:1781222400}w';
    const out = parsePageSeries(html);
    expect(out).toEqual([
      { date: '2026-06-11', close: 101.25 }, // same-day later point wins
      { date: '2026-06-12', close: 99.75 },
    ]);
  });

  it('returns empty when no pairs are present', () => {
    expect(parsePageSeries('<html>no data</html>')).toEqual([]);
  });
});

function stubBase(history: PricePoint[]): MarketDataProvider {
  return {
    getQuote: async () => null,
    getQuotes: async () => [],
    getHistory: async (_t: string, _o: HistoryOptions) => history,
  };
}

const RANGE: HistoryOptions = {
  from: new Date('2026-01-01'),
  to: new Date('2026-12-31'),
  interval: '1d',
};

describe('RealHistoryProvider', () => {
  const realSeries = [
    { date: '2026-03-02', close: 10 },
    { date: '2026-03-03', close: 11 },
  ];
  const mockSeries = [
    { date: '2026-03-02', close: 99 },
    { date: '2026-03-03', close: 98 },
  ];

  it('prefers the real series over the base (mock) when preferReal=true', async () => {
    const p = new RealHistoryProvider(stubBase(mockSeries), async () => realSeries, true);
    expect(await p.getHistory('NVDA', RANGE)).toEqual(realSeries);
  });

  it('falls back to the base when the real fetch fails or is too sparse', async () => {
    const failing = new RealHistoryProvider(stubBase(mockSeries), async () => { throw new Error('net'); }, true);
    expect(await failing.getHistory('NVDA', RANGE)).toEqual(mockSeries);
    const sparse = new RealHistoryProvider(stubBase(mockSeries), async () => [realSeries[0]], true);
    expect(await sparse.getHistory('NVDA', RANGE)).toEqual(mockSeries);
  });

  it('uses the base first and rescues with real data when preferReal=false (yahoo mode)', async () => {
    const rescued = new RealHistoryProvider(stubBase([]), async () => realSeries, false);
    expect(await rescued.getHistory('NVDA', RANGE)).toEqual(realSeries);
    const baseWins = new RealHistoryProvider(stubBase(mockSeries), async () => realSeries, false);
    expect(await baseWins.getHistory('NVDA', RANGE)).toEqual(mockSeries);
  });

  it('filters the real series to the requested window', async () => {
    const wide = [
      { date: '2025-01-01', close: 1 },
      { date: '2026-03-02', close: 10 },
      { date: '2026-03-03', close: 11 },
      { date: '2027-01-01', close: 50 },
    ];
    const p = new RealHistoryProvider(stubBase([]), async () => wide, true);
    expect(await p.getHistory('NVDA', RANGE)).toEqual(realSeries);
  });

  it('sends intraday requests to the base provider untouched', async () => {
    const p = new RealHistoryProvider(stubBase(mockSeries), async () => realSeries, true);
    expect(await p.getHistory('NVDA', { ...RANGE, interval: '60m' })).toEqual(mockSeries);
  });
});
