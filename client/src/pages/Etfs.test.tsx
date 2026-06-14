import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { EtfsPage } from './Etfs';
import type { EtfView } from '../types';

const sample: EtfView[] = [
  {
    symbol: 'SMH', name: 'VanEck Semiconductor ETF', currency: 'USD', price: 619.96, aum: '$65.1B',
    totalHoldings: 26, recommendedCount: 3, matches: ['NVDA', 'AVGO', 'TXN'],
    action: 'Buy', avgDiscount: 0.2, reason: '3 of 26 fund holdings recommended',
  },
  {
    symbol: 'XLE', name: 'Energy Select Sector SPDR Fund', currency: 'USD', price: 57.55, aum: '$39.1B',
    totalHoldings: 24, recommendedCount: 0, matches: [],
    action: null, avgDiscount: null, reason: 'No current recommendations among its holdings.',
  },
];

describe('EtfsPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists ETFs with price, AUM, overlap and action', async () => {
    renderWithProviders(<EtfsPage />);
    await waitFor(() => expect(screen.getByText('SMH')).toBeInTheDocument());

    const rows = screen.getAllByTestId('etf-row');
    expect(rows).toHaveLength(2);

    const smh = within(rows[0]);
    expect(smh.getByText('$619.96')).toBeInTheDocument();
    expect(smh.getByText('$65.1B')).toBeInTheDocument();
    expect(smh.getByText('3 / 26')).toBeInTheDocument();
    expect(smh.getByText('Buy')).toBeInTheDocument();
    expect(smh.getByText('NVDA')).toBeInTheDocument();

    // No-overlap ETF shows an em dash instead of an action badge.
    const xle = within(rows[1]);
    expect(xle.getByText('—')).toBeInTheDocument();
  });
});
