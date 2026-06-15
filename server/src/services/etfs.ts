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

// ETFs the user already owns, scored with strategy-appropriate criteria:
//  - covered-call / leveraged-income: NAV-erosion sustainability (is the fat
//    distribution real income, or return of capital?), from total return.
//  - dividend: capital appreciation AND stably growing distributions.
//  - broad: capital appreciation / growth.
// A SAFETY dimension (high/medium/low) tempers the call — notably, leverage
// caps a leveraged fund at Hold no matter how strong the trailing return.
// All figures are sourced snapshots (2026-06-15): totalReturn1y is the
// AUTHORITATIVE 1-year total return (distributions reinvested), divGrowth is the
// most recent annual distribution growth %, leverage is the gross exposure
// factor (1.0 = unlevered).
export type EtfStrategy = 'covered-call' | 'leveraged-income' | 'dividend' | 'broad';
export type Safety = 'high' | 'medium' | 'low';

export interface OwnedEtf {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  aum: string | null;
  category: string;
  strategy: EtfStrategy;
  yield: number; // distribution yield %
  totalReturn1y: number | null; // 1-year total return %, distributions reinvested (null = too new)
  divGrowth: number | null; // most recent annual distribution growth % (dividend funds)
  leverage: number; // gross exposure factor; 1.0 = unlevered
}

export const OWNED_ETFS: OwnedEtf[] = [
  { symbol: 'ROCY', name: 'JPMorgan Equity Premium Yield ETF', currency: 'USD', price: 53.69, aum: null, category: 'US covered-call income', strategy: 'covered-call', yield: 1.62, totalReturn1y: null, divGrowth: null, leverage: 1 },
  { symbol: 'ROCQ', name: 'JPMorgan Nasdaq Equity Premium Yield ETF', currency: 'USD', price: 56.2, aum: null, category: 'US covered-call income', strategy: 'covered-call', yield: 2.03, totalReturn1y: null, divGrowth: null, leverage: 1 },
  { symbol: 'GPIX', name: 'Goldman Sachs S&P 500 Premium Income ETF', currency: 'USD', price: 54.97, aum: '$4.3B', category: 'US covered-call income', strategy: 'covered-call', yield: 7.97, totalReturn1y: 25.88, divGrowth: null, leverage: 1 },
  { symbol: 'GPIQ', name: 'Goldman Sachs Nasdaq-100 Premium Income ETF', currency: 'USD', price: 58.05, aum: '$4.5B', category: 'US covered-call income', strategy: 'covered-call', yield: 9.3, totalReturn1y: 37.94, divGrowth: null, leverage: 1 },
  { symbol: 'SPYI', name: 'NEOS S&P 500 High Income ETF', currency: 'USD', price: 53.1, aum: '$10.0B', category: 'US covered-call income', strategy: 'covered-call', yield: 11.61, totalReturn1y: 22.82, divGrowth: null, leverage: 1 },
  { symbol: 'QQQI', name: 'NEOS Nasdaq-100 High Income ETF', currency: 'USD', price: 56.14, aum: '$12.0B', category: 'US covered-call income', strategy: 'covered-call', yield: 13.18, totalReturn1y: 30.39, divGrowth: null, leverage: 1 },
  { symbol: 'DIVO', name: 'Amplify CWP Enhanced Dividend Income ETF', currency: 'USD', price: 46.42, aum: '$7.2B', category: 'US dividend + covered-call', strategy: 'covered-call', yield: 6.33, totalReturn1y: 20.38, divGrowth: null, leverage: 1 },
  { symbol: 'QDVO', name: 'Amplify CWP Growth & Income ETF', currency: 'USD', price: 29.7, aum: '$0.7B', category: 'US dividend + covered-call', strategy: 'covered-call', yield: 10.25, totalReturn1y: 26.21, divGrowth: null, leverage: 1 },
  { symbol: 'IDVO', name: 'Amplify International Enhanced Dividend Income ETF', currency: 'USD', price: 42.85, aum: '$1.3B', category: 'Intl dividend + covered-call', strategy: 'covered-call', yield: 5.43, totalReturn1y: 36.09, divGrowth: null, leverage: 1 },
  { symbol: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF', currency: 'USD', price: 32.82, aum: '$95.2B', category: 'US dividend', strategy: 'dividend', yield: 3.22, totalReturn1y: 26.71, divGrowth: 1.56, leverage: 1 },
  { symbol: 'VGT', name: 'Vanguard Information Technology ETF', currency: 'USD', price: 116.74, aum: '$140.6B', category: 'US technology', strategy: 'broad', yield: 0.32, totalReturn1y: 55.5, divGrowth: null, leverage: 1 },
  { symbol: 'AGIX', name: 'KraneShares Artificial Intelligence & Technology ETF', currency: 'USD', price: 45.58, aum: '$0.9B', category: 'Global AI / technology', strategy: 'broad', yield: 0.92, totalReturn1y: 59.87, divGrowth: null, leverage: 1 },
  { symbol: 'VT', name: 'Vanguard Total World Stock ETF', currency: 'USD', price: 156.29, aum: '$74.1B', category: 'Global all-cap', strategy: 'broad', yield: 1.58, totalReturn1y: 29.74, divGrowth: null, leverage: 1 },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', currency: 'USD', price: 366.36, aum: '$647.0B', category: 'US total market', strategy: 'broad', yield: 1.01, totalReturn1y: 28.65, divGrowth: null, leverage: 1 },
  { symbol: 'ZWU.TO', name: 'BMO Covered Call Utilities ETF', currency: 'CAD', price: 12.01, aum: '$2.2B', category: 'CA covered-call income', strategy: 'covered-call', yield: 6.99, totalReturn1y: 17.04, divGrowth: null, leverage: 1 },
  { symbol: 'ZWP.TO', name: 'BMO Europe High Dividend Covered Call ETF', currency: 'CAD', price: 20.85, aum: '$0.8B', category: 'Europe covered-call income', strategy: 'covered-call', yield: 6.07, totalReturn1y: 18.82, divGrowth: null, leverage: 1 },
  { symbol: 'ZWC.TO', name: 'BMO Canadian High Dividend Covered Call ETF', currency: 'CAD', price: 22.57, aum: '$1.6B', category: 'CA covered-call income', strategy: 'covered-call', yield: 5.56, totalReturn1y: 29.47, divGrowth: null, leverage: 1 },
  { symbol: 'HDIV.TO', name: 'Hamilton Enhanced Canadian Covered Call ETF', currency: 'CAD', price: 23.32, aum: '$0.4B', category: 'CA covered-call income (leveraged ~25%)', strategy: 'leveraged-income', yield: 9.27, totalReturn1y: 47.62, divGrowth: null, leverage: 1.25 },
  { symbol: 'HDIF.TO', name: 'Harvest Diversified Monthly Income ETF', currency: 'CAD', price: 9.47, aum: '$0.4B', category: 'CA covered-call income (leveraged ~25%)', strategy: 'leveraged-income', yield: 10.23, totalReturn1y: 30.3, divGrowth: null, leverage: 1.25 },
  { symbol: 'VDY.TO', name: 'Vanguard FTSE Canadian High Dividend Yield Index ETF', currency: 'CAD', price: 75.66, aum: '$2.5B', category: 'CA dividend', strategy: 'dividend', yield: 2.81, totalReturn1y: 50.74, divGrowth: 6.04, leverage: 1 },
  { symbol: 'XEI.TO', name: 'iShares S&P/TSX Composite High Dividend Index ETF', currency: 'CAD', price: 39.59, aum: '$1.6B', category: 'CA dividend', strategy: 'dividend', yield: 3.49, totalReturn1y: 43.5, divGrowth: -8.72, leverage: 1 },
  { symbol: 'XDIV.TO', name: 'iShares Core MSCI Canadian Quality Dividend Index ETF', currency: 'CAD', price: 44.21, aum: '$1.1B', category: 'CA dividend', strategy: 'dividend', yield: 3.21, totalReturn1y: 43.0, divGrowth: 8.81, leverage: 1 },
  { symbol: 'CDZ.TO', name: 'iShares S&P/TSX Canadian Dividend Aristocrats Index ETF', currency: 'CAD', price: 46.26, aum: '$1.2B', category: 'CA dividend', strategy: 'dividend', yield: 3.03, totalReturn1y: 28.7, divGrowth: 2.89, leverage: 1 },
  { symbol: 'VFV.TO', name: 'Vanguard S&P 500 Index ETF', currency: 'CAD', price: 184.57, aum: '$13.0B', category: 'US index (CAD)', strategy: 'broad', yield: 0.84, totalReturn1y: 31.66, divGrowth: null, leverage: 1 },
  { symbol: 'XEQT.TO', name: 'iShares Core Equity ETF Portfolio', currency: 'CAD', price: 44.68, aum: '$6.2B', category: 'Global all-equity', strategy: 'broad', yield: 1.48, totalReturn1y: 32.9, divGrowth: null, leverage: 1 },
  { symbol: 'XEG.TO', name: 'iShares S&P/TSX Capped Energy Index ETF', currency: 'CAD', price: 26.46, aum: '$2.4B', category: 'CA energy', strategy: 'broad', yield: 2.64, totalReturn1y: 46.84, divGrowth: null, leverage: 1 },
];

export interface OwnedEtfView extends OwnedEtf {
  navChange1y: number | null; // derived: totalReturn1y − yield (≈ price/NAV change)
  safety: Safety;
  action: Action | null;
  reason: string;
}

const NAV_EROSION_LIMIT = -5; // 1y NAV decline worse than this = erosion concern
const INCOME_BUY_BAR = 8; // covered-call total-return bar for Buy
const LEV_BUY_BAR = 12; // leveraged funds need more to justify the risk
const BROAD_BUY_BAR = 12; // broad/index capital-appreciation bar for Buy
const DIV_BUY_BAR = 8; // dividend-fund total-return bar for Buy
const DIV_CUT_LIMIT = -10; // distribution growth worse than this = income not "stable"

function aumBillions(aum: string | null): number | null {
  if (!aum) return null;
  const m = aum.match(/([0-9.]+)\s*([BMT])/i);
  if (!m) return null;
  const mult = m[2].toUpperCase() === 'T' ? 1000 : m[2].toUpperCase() === 'M' ? 0.001 : 1;
  return parseFloat(m[1]) * mult;
}

// Safety rating: leverage is the dominant risk (borrowed money amplifies
// drawdowns); then fund size (tiny/unknown funds carry closure/liquidity risk);
// then strategy (broad/dividend index funds are the most robust).
export function safetyFor(e: OwnedEtf): { safety: Safety; note: string } {
  if (e.leverage > 1.1) {
    return { safety: 'low', note: `leveraged ~${Math.round((e.leverage - 1) * 100)}% — amplified drawdowns` };
  }
  const aum = aumBillions(e.aum);
  if (aum === null) return { safety: 'medium', note: 'limited size/track record' };
  if (aum < 1) return { safety: 'medium', note: 'small fund (<$1B AUM)' };
  if (e.strategy === 'broad' || e.strategy === 'dividend') {
    return { safety: 'high', note: 'large, diversified, unlevered' };
  }
  return { safety: 'medium', note: 'covered-call caps upside but unlevered' };
}

// Strategy-appropriate Buy/Hold/Sell, then a safety overlay (low safety caps a
// Buy at Hold — this is what keeps leveraged HDIV/HDIF out of Buy).
export function ownedEtfAction(e: OwnedEtf): {
  action: Action | null;
  navChange: number | null;
  safety: Safety;
  reason: string;
} {
  const { safety, note: safetyNote } = safetyFor(e);
  const navChange = e.totalReturn1y === null ? null : Math.round((e.totalReturn1y - e.yield) * 10) / 10;

  const base = baseAction(e, navChange);
  let { action, reason } = base;

  // Safety overlay: never recommend Buy on a low-safety (leveraged) fund.
  if (action === 'Buy' && safety === 'low') {
    action = 'Hold';
    reason = `Strong trailing return but ${safetyNote}; size position with caution rather than add. (${reason})`;
  }
  return { action, navChange, safety, reason };
}

function baseAction(e: OwnedEtf, navChange: number | null): { action: Action | null; reason: string } {
  if (e.totalReturn1y === null) {
    return { action: 'Hold', reason: 'Too new — no 1-year total return yet to judge.' };
  }
  const tr = e.totalReturn1y;

  // Covered-call & leveraged-income: NAV-erosion sustainability.
  if (e.strategy === 'covered-call' || e.strategy === 'leveraged-income') {
    const leveraged = e.strategy === 'leveraged-income';
    const buyBar = leveraged ? LEV_BUY_BAR : INCOME_BUY_BAR;
    if (tr < 0) return { action: 'Sell', reason: `1y total return ${tr}% — negative even with the ${e.yield}% distribution; capital eroding.` };
    if (navChange !== null && navChange < NAV_EROSION_LIMIT)
      return { action: 'Hold', reason: `NAV down ~${navChange}% ex-distributions: payout partly return of capital.` };
    if (tr >= buyBar) return { action: 'Buy', reason: `1y total return ${tr}% with NAV holding up (~${navChange}% ex-distributions).` };
    return { action: 'Hold', reason: `1y total return ${tr}% — positive but modest.` };
  }

  // Dividend funds: capital appreciation AND stably growing income.
  if (e.strategy === 'dividend') {
    const g = e.divGrowth;
    if (tr < 0) return { action: 'Sell', reason: `1y total return ${tr}% — capital not appreciating.` };
    if (g !== null && g < DIV_CUT_LIMIT)
      return { action: 'Sell', reason: `Distribution cut ${g}% — income not stable, despite ${tr}% total return.` };
    if (tr >= DIV_BUY_BAR && g !== null && g >= 0)
      return { action: 'Buy', reason: `1y total return ${tr}% with distribution growing ${g}% — appreciation + rising income.` };
    if (tr >= DIV_BUY_BAR && g === null)
      return { action: 'Buy', reason: `1y total return ${tr}%; distribution growth not available.` };
    return { action: 'Hold', reason: `1y total return ${tr}%${g !== null ? `, distribution growth ${g}%` : ''} — income flat or returns modest.` };
  }

  // Broad / index funds: capital appreciation / growth.
  if (tr < 0) return { action: 'Sell', reason: `1y total return ${tr}% — no capital appreciation.` };
  if (tr >= BROAD_BUY_BAR) return { action: 'Buy', reason: `1y total return ${tr}% — strong capital appreciation.` };
  return { action: 'Hold', reason: `1y total return ${tr}% — modest appreciation.`
  };
}

export function buildOwnedViews(): OwnedEtfView[] {
  return OWNED_ETFS.map((e) => {
    const { action, navChange, safety, reason } = ownedEtfAction(e);
    return { ...e, action, navChange1y: navChange, safety, reason };
  });
}

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
  owned: OwnedEtfView[]; // user's own holdings, with NAV-erosion Action where applicable
}

// Build ETF views from the latest recommendations. Prices/AUM are pinned
// sourced snapshots — same approach as the DCF IVs and manual prices. We
// deliberately do NOT pull ETF quotes from the provider: ETF symbols aren't in
// the universe, so the mock provider would fabricate prices, and these funds
// trade in their own right (not part of the value screen).
export async function getEtfViews(_provider: MarketDataProvider): Promise<EtfsResponse> {
  const recs = await getLatestRecommendations();
  return { overlap: buildEtfViews(recs), owned: buildOwnedViews() };
}
