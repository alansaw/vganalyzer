import { actionFromDiscount, type Action } from './action.js';
import type { MarketDataProvider } from '../providers/index.js';
import { getLatestRecommendations, type Recommendation } from './recommendations.js';

// Curated ETFs whose holdings overlap the recommendation universe (US value /
// financials / energy / semis + Canadian sector funds). `holdings` lists the
// universe tickers each ETF contains — used to compute overlap with the live
// recommendation list and derive a blended Buy/Hold/Sell. Price + AUM are
// pinned snapshots (sourced 2026-06-12 from stockanalysis.com); ETFs have no
// single intrinsic value, so Action comes from the recommended holdings inside.
export interface EtfDef {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  aum: string; // human-readable, e.g. "$65.1B"
  totalHoldings: number; // the fund's ACTUAL number of positions (sourced)
  holdings: string[]; // the subset of fund holdings that are in our screening universe
}

export const ETFS: EtfDef[] = [
  {
    symbol: 'SMH',
    name: 'VanEck Semiconductor ETF',
    currency: 'USD',
    price: 619.96,
    aum: '$65.1B',
    totalHoldings: 26,
    holdings: ['NVDA', 'AVGO', 'TXN', 'QCOM', 'AMD', 'MU', 'ADI', 'AMAT', 'LRCX', 'NXPI', 'MCHP', 'ON', 'MRVL'],
  },
  {
    symbol: 'XLF',
    name: 'Financial Select Sector SPDR Fund',
    currency: 'USD',
    price: 53.34,
    aum: '$49.5B',
    totalHoldings: 80,
    holdings: ['JPM', 'BAC', 'WFC', 'C'],
  },
  {
    symbol: 'XLE',
    name: 'Energy Select Sector SPDR Fund',
    currency: 'USD',
    price: 57.55,
    aum: '$39.1B',
    totalHoldings: 24,
    holdings: ['XOM', 'CVX'],
  },
  {
    symbol: 'VTV',
    name: 'Vanguard Value ETF',
    currency: 'USD',
    price: 217.09,
    aum: '$179.6B',
    totalHoldings: 325,
    holdings: ['JPM', 'BAC', 'WFC', 'C', 'XOM', 'CVX', 'PFE', 'MRK', 'BMY', 'KO', 'PEP', 'CSCO', 'IBM', 'INTC', 'T', 'VZ', 'MO', 'GILD', 'CVS', 'TGT'],
  },
  {
    symbol: 'ZEB.TO',
    name: 'BMO Equal Weight Banks Index ETF',
    currency: 'CAD',
    price: 72.22,
    aum: '$3.1B',
    totalHoldings: 7,
    holdings: ['RY.TO', 'TD.TO', 'BNS.TO', 'BMO.TO', 'CM.TO', 'NA.TO'],
  },
  {
    symbol: 'XEG.TO',
    name: 'iShares S&P/TSX Capped Energy Index ETF',
    currency: 'CAD',
    price: 26.46,
    aum: '$2.4B',
    totalHoldings: 30,
    holdings: ['CNQ.TO', 'SU.TO', 'CVE.TO', 'ENB.TO', 'TRP.TO'],
  },
  {
    symbol: 'XFN.TO',
    name: 'iShares S&P/TSX Capped Financials Index ETF',
    currency: 'CAD',
    price: 91.37,
    aum: '$2.2B',
    totalHoldings: 28,
    holdings: ['RY.TO', 'TD.TO', 'BNS.TO', 'BMO.TO', 'CM.TO', 'NA.TO', 'MFC.TO', 'SLF.TO', 'POW.TO', 'IFC.TO'],
  },
  {
    symbol: 'XIU.TO',
    name: 'iShares S&P/TSX 60 Index ETF',
    currency: 'CAD',
    price: 51.75,
    aum: '$12.6B',
    totalHoldings: 68,
    holdings: ['RY.TO', 'TD.TO', 'BNS.TO', 'BMO.TO', 'CM.TO', 'NA.TO', 'ENB.TO', 'TRP.TO', 'CNQ.TO', 'SU.TO', 'CVE.TO', 'BCE.TO', 'T.TO', 'MFC.TO', 'SLF.TO', 'POW.TO', 'IFC.TO', 'FTS.TO', 'NTR.TO', 'CNR.TO'],
  },
];

export interface EtfView {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  aum: string;
  totalHoldings: number; // the fund's actual position count
  recommendedCount: number; // how many of the fund's holdings are on the current rec list
  matches: string[]; // those recommended tickers
  action: Action | null; // blended from recommended holdings' price-vs-IV; null if none
  avgDiscount: number | null; // mean (IV-price)/IV across recommended holdings
  reason: string;
}

// ETFs the user already owns. Listed separately (not overlap-scored): these are
// mostly income / covered-call and broad-index funds, so a value-screen Action
// doesn't meaningfully apply. price/aum are sourced snapshots (2026-06-14).
export interface OwnedEtf {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  aum: string | null;
  category: string;
}

export const OWNED_ETFS: OwnedEtf[] = [
  { symbol: 'ROCY', name: 'JPMorgan Equity Premium Yield ETF', currency: 'USD', price: 53.69, aum: null, category: 'US covered-call income' },
  { symbol: 'ROCQ', name: 'JPMorgan Nasdaq Equity Premium Yield ETF', currency: 'USD', price: 56.2, aum: null, category: 'US covered-call income' },
  { symbol: 'GPIX', name: 'Goldman Sachs S&P 500 Premium Income ETF', currency: 'USD', price: 54.97, aum: '$4.3B', category: 'US covered-call income' },
  { symbol: 'GPIQ', name: 'Goldman Sachs Nasdaq-100 Premium Income ETF', currency: 'USD', price: 58.05, aum: '$4.5B', category: 'US covered-call income' },
  { symbol: 'SPYI', name: 'NEOS S&P 500 High Income ETF', currency: 'USD', price: 53.1, aum: '$10.0B', category: 'US covered-call income' },
  { symbol: 'QQQI', name: 'NEOS Nasdaq-100 High Income ETF', currency: 'USD', price: 56.14, aum: '$12.0B', category: 'US covered-call income' },
  { symbol: 'DIVO', name: 'Amplify CWP Enhanced Dividend Income ETF', currency: 'USD', price: 46.42, aum: '$7.2B', category: 'US dividend + covered-call' },
  { symbol: 'QDVO', name: 'Amplify CWP Growth & Income ETF', currency: 'USD', price: 29.7, aum: '$0.7B', category: 'US dividend + covered-call' },
  { symbol: 'IDVO', name: 'Amplify International Enhanced Dividend Income ETF', currency: 'USD', price: 42.85, aum: '$1.3B', category: 'Intl dividend + covered-call' },
  { symbol: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF', currency: 'USD', price: 32.82, aum: '$95.2B', category: 'US dividend' },
  { symbol: 'VGT', name: 'Vanguard Information Technology ETF', currency: 'USD', price: 116.74, aum: '$140.6B', category: 'US technology' },
  { symbol: 'AGIX', name: 'KraneShares Artificial Intelligence & Technology ETF', currency: 'USD', price: 45.58, aum: '$0.9B', category: 'Global AI / technology' },
  { symbol: 'VT', name: 'Vanguard Total World Stock ETF', currency: 'USD', price: 156.29, aum: '$74.1B', category: 'Global all-cap' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', currency: 'USD', price: 366.36, aum: '$647.0B', category: 'US total market' },
  { symbol: 'ZWU.TO', name: 'BMO Covered Call Utilities ETF', currency: 'CAD', price: 12.01, aum: '$2.2B', category: 'CA covered-call income' },
  { symbol: 'ZWP.TO', name: 'BMO Europe High Dividend Covered Call ETF', currency: 'CAD', price: 20.85, aum: '$0.8B', category: 'Europe covered-call income' },
  { symbol: 'ZWC.TO', name: 'BMO Canadian High Dividend Covered Call ETF', currency: 'CAD', price: 22.57, aum: '$1.6B', category: 'CA covered-call income' },
  { symbol: 'HDIV.TO', name: 'Hamilton Enhanced Canadian Covered Call ETF', currency: 'CAD', price: 23.32, aum: '$0.4B', category: 'CA covered-call income' },
  { symbol: 'HDIF.TO', name: 'Harvest Diversified Monthly Income ETF', currency: 'CAD', price: 9.47, aum: '$0.4B', category: 'CA covered-call income' },
  { symbol: 'VDY.TO', name: 'Vanguard FTSE Canadian High Dividend Yield Index ETF', currency: 'CAD', price: 75.66, aum: '$2.5B', category: 'CA dividend' },
  { symbol: 'XEI.TO', name: 'iShares S&P/TSX Composite High Dividend Index ETF', currency: 'CAD', price: 39.59, aum: '$1.6B', category: 'CA dividend' },
  { symbol: 'XDIV.TO', name: 'iShares Core MSCI Canadian Quality Dividend Index ETF', currency: 'CAD', price: 44.21, aum: '$1.1B', category: 'CA dividend' },
  { symbol: 'CDZ.TO', name: 'iShares S&P/TSX Canadian Dividend Aristocrats Index ETF', currency: 'CAD', price: 46.26, aum: '$1.2B', category: 'CA dividend' },
  { symbol: 'VFV.TO', name: 'Vanguard S&P 500 Index ETF', currency: 'CAD', price: 184.57, aum: '$13.0B', category: 'US index (CAD)' },
  { symbol: 'XEQT.TO', name: 'iShares Core Equity ETF Portfolio', currency: 'CAD', price: 44.68, aum: '$6.2B', category: 'Global all-equity' },
  { symbol: 'XEG.TO', name: 'iShares S&P/TSX Capped Energy Index ETF', currency: 'CAD', price: 26.46, aum: '$2.4B', category: 'CA energy' },
];

// Mean price-vs-IV discount across an ETF's holdings that appear on the live
// recommendation list, then map to Buy/Hold/Sell with the shared thresholds.
export function buildEtfViews(recs: Recommendation[]): EtfView[] {
  const recByTicker = new Map(recs.map((r) => [r.ticker, r]));

  return ETFS.map((etf) => {
    const matched: Recommendation[] = [];
    const discounts: number[] = [];
    for (const t of etf.holdings) {
      const r = recByTicker.get(t);
      if (!r) continue;
      matched.push(r);
      if (r.iv && r.price && r.iv.base > 0) discounts.push((r.iv.base - r.price) / r.iv.base);
    }

    const avgDiscount =
      discounts.length > 0 ? discounts.reduce((s, d) => s + d, 0) / discounts.length : null;
    const action = avgDiscount === null ? null : actionFromDiscount(avgDiscount);

    const reason =
      matched.length === 0
        ? 'No current recommendations among its holdings.'
        : `${matched.length} of ${etf.totalHoldings} fund holdings are recommended` +
          (avgDiscount !== null ? `; avg ${(avgDiscount * 100).toFixed(0)}% vs intrinsic value.` : '.');

    return {
      symbol: etf.symbol,
      name: etf.name,
      currency: etf.currency,
      price: etf.price,
      aum: etf.aum,
      totalHoldings: etf.totalHoldings,
      recommendedCount: matched.length,
      matches: matched.map((r) => r.ticker),
      action,
      avgDiscount: avgDiscount === null ? null : Math.round(avgDiscount * 1000) / 1000,
      reason,
    };
  }).sort((a, b) => b.recommendedCount - a.recommendedCount || b.totalHoldings - a.totalHoldings);
}

export interface EtfsResponse {
  overlap: EtfView[]; // funds scored by recommendation overlap
  owned: OwnedEtf[]; // user's own holdings (price/AUM only, no overlap score)
}

// Build ETF views from the latest recommendations. Prices/AUM are pinned
// sourced snapshots — same approach as the DCF IVs and manual prices. We
// deliberately do NOT pull ETF quotes from the provider: ETF symbols aren't in
// the universe, so the mock provider would fabricate prices, and these funds
// trade in their own right (not part of the value screen).
export async function getEtfViews(_provider: MarketDataProvider): Promise<EtfsResponse> {
  const recs = await getLatestRecommendations();
  return { overlap: buildEtfViews(recs), owned: OWNED_ETFS };
}
