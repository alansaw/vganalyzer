import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { PortfolioPage } from './Portfolio';
import type { PortfolioSummary, PortfolioHistory } from '../types';

const summary: PortfolioSummary = {
  totalValue: 12500,
  totalCost: 10000,
  unrealized: 2500,
  realized: 300,
  totalGain: 2800,
  positions: [
    {
      ticker: 'INTC',
      name: 'Intel Corporation',
      shares: 50,
      costBasis: 1750,
      avgCost: 35,
      realized: 0,
      price: 40,
      currency: 'USD',
      pe: 9.4,
      peg: 0.7,
      iv: { base: 55, bear: 40, best: 70 },
      marketValue: 2000,
      unrealized: 250,
      totalReturn: 250,
      weight: 0.16,
    },
    {
      ticker: 'AAPL',
      name: 'Apple Inc.',
      shares: 0,
      costBasis: 0,
      avgCost: 0,
      realized: 300,
      price: 195,
      currency: 'USD',
      pe: 31,
      peg: 2.6,
      iv: null,
      marketValue: 0,
      unrealized: 0,
      totalReturn: 300,
      weight: 0,
    },
  ],
};

const history: PortfolioHistory = {
  range: '1y',
  points: [
    { date: '2025-06-01', close: 10000 },
    { date: '2026-05-29', close: 12500 },
  ],
};

describe('PortfolioPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const body = url.includes('/history') ? history : summary;
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows total value and open positions, and splits out closed ones', async () => {
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => expect(screen.getByText('Total Value')).toBeInTheDocument());
    expect(screen.getByText('$12,500.00')).toBeInTheDocument();

    // Open position INTC appears as a row.
    await waitFor(() => expect(screen.getByText('INTC')).toBeInTheDocument());
    expect(screen.getByText('Open positions')).toBeInTheDocument();

    // AAPL is fully sold -> shown under closed positions.
    expect(screen.getByText('Closed positions')).toBeInTheDocument();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });
});
