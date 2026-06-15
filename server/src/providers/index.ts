import { config } from '../config.js';
import { MockProvider } from './mock.js';
import { YahooProvider } from './yahoo.js';
import { StockAnalysisProvider } from './stockAnalysis.js';
import { OverrideProvider, loadOverrides } from './override.js';
import { CachingProvider } from './cache.js';
import { RealHistoryProvider } from './realHistory.js';
import type { MarketDataProvider } from './types.js';

export function createProvider(name: 'yahoo' | 'mock' = config.provider): MarketDataProvider {
  // 1) Base upstream source.
  //   - mock: deterministic offline data (tests/E2E), wrapped so charts use real history.
  //   - yahoo: LIVE quotes + history from stockanalysis.com (current price, not a
  //     frozen snapshot). yahoo-finance2 stays available but is bypassed because
  //     it rate-limits; StockAnalysisProvider is the live source we actually use.
  let provider: MarketDataProvider;
  if (name === 'mock') {
    provider = new RealHistoryProvider(new MockProvider(), undefined, true);
  } else {
    void YahooProvider; // kept for reference / future use
    provider = new StockAnalysisProvider();
  }

  // 2) Cache upstream calls so repeated requests don't re-hit the API. Quote TTL
  // is short so prices stay current intraday but bursts of page loads are cheap.
  provider = new CachingProvider(
    provider,
    config.quoteTtlMinutes * 60_000,
    config.historyTtlMinutes * 60_000,
  );

  // 3) Manual overrides (price / P/E / PEG / intrinsic value) take precedence.
  const { overrides, asOf } = loadOverrides();
  if (Object.keys(overrides).length > 0) {
    console.log(
      `[provider] applying ${Object.keys(overrides).length} manual override(s)` +
        `${asOf ? ` (as of ${asOf})` : ''}: ${Object.keys(overrides).join(', ')}`,
    );
    provider = new OverrideProvider(provider, overrides);
  }

  console.log(
    `[provider] base=${name}, quote TTL=${config.quoteTtlMinutes}m, history TTL=${config.historyTtlMinutes}m`,
  );
  return provider;
}

export type {
  MarketDataProvider,
  Quote,
  PricePoint,
  HistoryOptions,
  Interval,
  IntrinsicValue,
} from './types.js';
export { isIntraday } from './types.js';
export { MockProvider } from './mock.js';
export { YahooProvider } from './yahoo.js';
export { StockAnalysisProvider } from './stockAnalysis.js';
export { OverrideProvider, loadOverrides } from './override.js';
export { CachingProvider } from './cache.js';
export { RealHistoryProvider } from './realHistory.js';
