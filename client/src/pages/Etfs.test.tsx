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
    { symbol: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF', currency: 'USD', price: 32.82, aum: '$95.2B', category: 'US dividend', strategy: 'dividend', yield: 3.22, return1y: -17.7, totalReturn1y: null, action: null, reason: 'Broad/dividend fund — NAV-erosion signal not applicable.' },
    { symbol: 'QQQI', name: 'NEOS Nasdaq-100 High Income ETF', currency: 'USD', price: 56.14, aum: '$12.0B', category: 'US covered-call income', strategy: 'covered-call', yield: 13.53, return1y: -8.4, totalReturn1y: 5.1, action: 'Hold', reason: '1y total return 5.1%' },
    { symbol: 'IDVO', name: 'Amplify International Enhanced Dividend Income ETF', currency: 'USD', price: 42.85, aum: '$1.3B', category: 'Intl covered-call', strategy: 'covered-call', yield: 5.46, return1y: -20.8, totalReturn1y: -15.3, action: 'Sell', reason: 'distributions not covering NAV erosion' },
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

  it('lists owned ETFs with yield/return and a NAV-erosion action where applicable', async () => {
    renderWithProviders(<EtfsPage />);
    await waitFor(() => expect(screen.getByText('My ETFs')).toBeInTheDocument());

    const owned = screen.getAllByTestId('owned-etf-row');
    expect(owned).toHaveLength(3);

    // Dividend fund: yield shown, but no action badge.
    const schd = within(owned[0]);
    expect(schd.getByText('SCHD')).toBeInTheDocument();
    expect(schd.getByText('3.2%')).toBeInTheDocument();
    expect(schd.queryByText('Hold')).not.toBeInTheDocument();
    expect(schd.queryByText('Sell')).not.toBeInTheDocument();
    expect(schd.queryByText('Buy')).not.toBeInTheDocument();

    // Covered-call funds carry the NAV-erosion action.
    expect(within(owned[1]).getByText('Hold')).toBeInTheDocument(); // QQQI total +5.1%
    expect(within(owned[2]).getByText('Sell')).toBeInTheDocument(); // IDVO total -15.3%
  });
});
