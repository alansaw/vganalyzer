import pg from 'pg';
import { config } from '../config.js';

// Return numerics as JS numbers instead of strings for convenience.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // NUMERIC

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never[]);
}

export async function closePool(): Promise<void> {
  await pool.end();
}
