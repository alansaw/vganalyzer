import 'dotenv/config';
import os from 'node:os';

const osUser = os.userInfo().username || 'postgres';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl:
    process.env.DATABASE_URL ??
    `postgresql://${osUser}@localhost:5432/vganalyzer`,
  provider: (process.env.MARKET_PROVIDER ?? 'yahoo') as 'yahoo' | 'mock',
  recommendationCount: Number(process.env.RECOMMENDATION_COUNT ?? 12),
  recommendationTtlMinutes: Number(process.env.RECOMMENDATION_TTL_MIN ?? 720),
  // In-memory caching of upstream quote/history calls so repeated page loads
  // don't re-hit the source. Quote TTL is short so prices stay current intraday
  // (a few minutes' lag) while bursts of requests are served from memory.
  quoteTtlMinutes: Number(process.env.QUOTE_TTL_MIN ?? 5),
  historyTtlMinutes: Number(process.env.HISTORY_TTL_MIN ?? 360),
};

export type AppConfig = typeof config;
