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
    { symbol: 'GPIX', name: 'Goldman Sachs S&P 500 Premium Income ETF', currency: 'USD', price: 54.97, aum: '$4.3B', category: 'US covered-call income', strategy: 'covered-call', yield: 7.97, totalReturn1y: 25.88, navChange1y: 17.9, divGrowth: null, leverage: 1, safety: 'medium', action: 'Buy', reason: '1y total return 25.88% with NAV holding up' },
    { symbol: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF', currency: 'USD', price: 32.82, aum: '$95.2B', category: 'US dividend', strategy: 'dividend', yield: 3.22, totalReturn1y: 26.71, navChange1y: 23.5, divGrowth: 1.56, leverage: 1, safety: 'high', action: 'Buy', reason: 'appreciation + rising income' },
    { symbol: 'HDIV.TO', name: 'Hamilton Enhanced Canadian Covered Call ETF', currency: 'CAD', price: 23.32, aum: '$0.4B', category: 'CA covered-call (leveraged)', strategy: 'leveraged-income', yield: 9.27, totalReturn1y: 47.62, navChange1y: 38.3, divGrowth: null, leverage: 1.25, safety: 'low', action: 'Hold', reason: 'Strong trailing return but leveraged ~25%' },
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

    // Covered-call fund with strong total return + NAV holding up -> Buy, medium safety.
    const gpix = within(owned[0]);
    expect(gpix.getByText('GPIX')).toBeInTheDocument();
    expect(gpix.getByText('Buy')).toBeInTheDocument();
    expect(gpix.getByText('medium')).toBeInTheDocument();

    // Dividend fund now gets an action (appreciation + rising income) -> Buy, high safety.
    const schd = within(owned[1]);
    expect(schd.getByText('Buy')).toBeInTheDocument();
    expect(schd.getByText('high')).toBeInTheDocument();
    expect(schd.getByText('1.6%')).toBeInTheDocument(); // div growth shown

    // Leveraged fund: low safety caps it at Hold despite +47.6% total return.
    const hdiv = within(owned[2]);
    expect(hdiv.getByText('Hold')).toBeInTheDocument();
    expect(hdiv.getByText('low')).toBeInTheDocument();
    expect(hdiv.queryByText('Buy')).not.toBeInTheDocument();
  });
});
