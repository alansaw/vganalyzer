import { config } from '../config.js';
import { MockProvider } from './mock.js';
import { YahooProvider } from './yahoo.js';
import { OverrideProvider, loadOverrides } from './override.js';
import { CachingProvider } from './cache.js';
import type { MarketDataProvider } from './types.js';

export function createProvider(name: 'yahoo' | 'mock' = config.provider): MarketDataProvider {
  // 1) Base upstream source.
  let provider: MarketDataProvider = name === 'mock' ? new MockProvider() : new YahooProvider();

  // 2) Cache upstream calls so repeated requests don't re-hit the API (rate-limit guard).
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
export { OverrideProvider, loadOverrides } from './override.js';
export { CachingProvider } from './cache.js';
