import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { EtfsPage } from './Etfs';
import type { EtfsResponse } from '../types';

const sample: EtfsResponse = {
  overlap: [
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
  ],
  owned: [
    { symbol: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF', currency: 'USD', price: 32.82, aum: '$95.2B', category: 'US dividend' },
    { symbol: 'ZWC.TO', name: 'BMO Canadian High Dividend Covered Call ETF', currency: 'CAD', price: 22.57, aum: '$1.6B', category: 'CA covered-call income' },
  ],
};

describe('EtfsPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists overlap ETFs with price, AUM, overlap and action', async () => {
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
    expect(within(rows[1]).getByText('—')).toBeInTheDocument();
  });

  it('lists owned ETFs separately with price, AUM and category (no action)', async () => {
    renderWithProviders(<EtfsPage />);
    await waitFor(() => expect(screen.getByText('My ETFs')).toBeInTheDocument());

    const owned = screen.getAllByTestId('owned-etf-row');
    expect(owned).toHaveLength(2);
    const schd = within(owned[0]);
    expect(schd.getByText('SCHD')).toBeInTheDocument();
    expect(schd.getByText('$32.82')).toBeInTheDocument();
    expect(schd.getByText('US dividend')).toBeInTheDocument();
    // owned section carries no Buy/Sell/Hold badge
    expect(schd.queryByText('Buy')).not.toBeInTheDocument();
  });
});
