import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import { RecommendationsPage } from './Recommendations';
import type { Recommendation, StockEvaluation } from '../types';

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

const evaluation: StockEvaluation = {
  ticker: 'NVDA',
  name: 'NVIDIA Corporation',
  market: 'US',
  price: 1148,
  pe: 44,
  forwardPe: 9.8,
  peg: 0.13,
  iv: { base: 1597, bear: 1100, best: 2280 },
  momentum3m: 1.86,
  score: 84.3,
  eligible: false,
  rationale: 'Trades 39% above intrinsic value.',
};

describe('RecommendationsPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const body = String(url).includes('/evaluate/') ? evaluation : sample;
        return new Response(JSON.stringify(body), { status: 200 });
      }),
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

  it('evaluates an arbitrary ticker into a single row with the same columns', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecommendationsPage />);
    await waitFor(() => expect(screen.getByText('INTC')).toBeInTheDocument());

    await user.type(screen.getByLabelText('Stock symbol'), 'nvda');
    await user.click(screen.getByRole('button', { name: 'Evaluate' }));

    await waitFor(() => expect(screen.getByTestId('evaluate-row')).toBeInTheDocument());
    const row = within(screen.getByTestId('evaluate-row'));
    expect(row.getByText('NVDA')).toBeInTheDocument();
    expect(row.getByText('84')).toBeInTheDocument(); // score badge
    expect(row.getByText('$1,148.00')).toBeInTheDocument(); // price
    // Ineligible names are still shown, with the reason surfaced as a note.
    expect(screen.getByText(/Not eligible for the recommendation list/i)).toBeInTheDocument();
  });
});
