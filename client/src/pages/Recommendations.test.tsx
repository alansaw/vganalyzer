import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { RecommendationsPage } from './Recommendations';
import type { Recommendation } from '../types';

const sample: Recommendation[] = [
  {
    ticker: 'INTC',
    name: 'Intel Corporation',
    market: 'US',
    price: 31.05,
    pe: 9.4,
    forwardPe: 8.5,
    peg: 0.7,
    iv: { base: 42, bear: 30, best: 55 },
    momentum3m: -0.12,
    score: 82.4,
    rationale: 'PEG 0.70, P/E 9.4, 3-mo -12.0% — attractive value.',
    rank: 1,
    generatedAt: '2026-05-29T12:00:00.000Z',
  },
  {
    ticker: 'TD.TO',
    name: 'Toronto-Dominion Bank',
    market: 'CA',
    price: 78.5,
    pe: 10.8,
    forwardPe: 9.7,
    peg: 1.2,
    iv: null,
    momentum3m: -0.06,
    score: 64.1,
    rationale: 'PEG 1.20, P/E 10.8, 3-mo -6.0% — fair value.',
    rank: 2,
    generatedAt: '2026-05-29T12:00:00.000Z',
  },
];

describe('RecommendationsPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders ranked recommendations from the API', async () => {
    renderWithProviders(<RecommendationsPage />);
    await waitFor(() => expect(screen.getByText('INTC')).toBeInTheDocument());

    const rows = screen.getAllByTestId('reco-row');
    expect(rows).toHaveLength(2);
    expect(screen.getByText('Toronto-Dominion Bank')).toBeInTheDocument();
    // Score badge rounds 82.4 -> 82
    expect(screen.getByText('82')).toBeInTheDocument();
    // Forward P/E column shows the forward multiple (8.5), not trailing (9.4)
    expect(screen.getByText('8.5')).toBeInTheDocument();
    // Intrinsic value base shown for INTC
    expect(screen.getByText('$42.00')).toBeInTheDocument();
    // MKT column removed
    expect(screen.queryByText('CA', { exact: true })).not.toBeInTheDocument();
  });
});
