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
  // In-memory caching of upstream (Yahoo) calls so repeated page loads/refreshes
  // don't re-hit the API and trip rate limits.
  quoteTtlMinutes: Number(process.env.QUOTE_TTL_MIN ?? 15),
  historyTtlMinutes: Number(process.env.HISTORY_TTL_MIN ?? 360),
};

export type AppConfig = typeof config;
