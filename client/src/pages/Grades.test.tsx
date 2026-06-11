import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { GradesPage } from './Grades';
import type { HoldingScore, Recommendation } from '../types';

function rec(ticker: string, score: number, rank: number): Recommendation {
  return {
    ticker,
    name: ticker,
    market: 'US',
    price: 100,
    pe: 10,
    forwardPe: 9,
    peg: 0.8,
    iv: { base: 150 },
    momentum3m: -0.05,
    score,
    rationale: 'test',
    rank,
    generatedAt: '2026-06-10T12:00:00.000Z',
  };
}

const sampleRecs: Recommendation[] = [
  rec('TOPS', 96.2, 1),
  rec('SOLID', 91.0, 2),
  rec('ALMOST', 86.5, 3),
  rec('OKAY', 75.0, 4),
  rec('MEH', 61.3, 5),
];

const sampleHoldings: HoldingScore[] = [
  // Held AND in the recommendations -> deduped, starred, keeps rec bucket.
  { ticker: 'SOLID', name: 'Solid Co', score: 91.0, eligible: true, reason: null },
  // Held but excluded from recommendations (above IV) -> still graded, flagged.
  { ticker: 'PRICEY', name: 'Pricey Inc', score: 65.4, eligible: false, reason: 'Trades 164% above intrinsic value.' },
];

describe('GradesPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const body = String(url).includes('/portfolio/scores') ? sampleHoldings : sampleRecs;
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('buckets stocks into the five grade rows by score', async () => {
    renderWithProviders(<GradesPage />);
    await waitFor(() => expect(screen.getByText('TOPS')).toBeInTheDocument());

    const rows = screen.getAllByTestId('grade-row');
    expect(rows).toHaveLength(5);

    const expectInRow = (rowIdx: number, grade: string, ticker: string) => {
      const row = within(rows[rowIdx]);
      expect(row.getByText(grade)).toBeInTheDocument();
      expect(row.getByText(ticker)).toBeInTheDocument();
    };
    expectInRow(0, 'A+', 'TOPS'); // 96.2
    expectInRow(1, 'A', 'SOLID'); // 91.0
    expectInRow(2, 'A-', 'ALMOST'); // 86.5
    expectInRow(3, 'B', 'OKAY'); // 75.0
    expectInRow(4, 'C', 'MEH'); // 61.3
  });

  it('merges portfolio holdings: starred, deduped, and graded even when excluded', async () => {
    renderWithProviders(<GradesPage />);
    await waitFor(() => expect(screen.getByText('PRICEY')).toBeInTheDocument());

    const rows = screen.getAllByTestId('grade-row');

    // PRICEY (65.4, ineligible) is graded C and flagged as excluded from recs.
    const cRow = within(rows[4]);
    expect(cRow.getByText('PRICEY')).toBeInTheDocument();
    expect(cRow.getByText(/excluded from recs/)).toBeInTheDocument();

    // SOLID is both a rec and a holding -> appears exactly once, starred.
    expect(screen.getAllByText('SOLID')).toHaveLength(1);
    const chips = screen.getAllByTestId('stock-chip');
    const starred = chips.filter((c) => c.textContent?.includes('★'));
    expect(starred.map((c) => c.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('SOLID'), expect.stringContaining('PRICEY')]),
    );
  });
});
