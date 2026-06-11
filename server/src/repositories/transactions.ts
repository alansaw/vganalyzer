import { query } from '../db/pool.js';
import type { Transaction } from '../services/portfolio.js';

interface TxRow {
  id: number;
  ticker: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  traded_on: Date;
  notes: string | null;
}

function mapRow(r: TxRow): Transaction {
  return {
    id: r.id,
    ticker: r.ticker,
    type: r.type,
    shares: Number(r.shares),
    price: Number(r.price),
    tradedOn: toISO(r.traded_on),
    notes: r.notes,
  };
}

function toISO(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export async function listTransactions(ticker?: string): Promise<Transaction[]> {
  const { rows } = ticker
    ? await query<TxRow>(
        `SELECT * FROM transactions WHERE ticker = $1 ORDER BY traded_on ASC, id ASC`,
        [ticker],
      )
    : await query<TxRow>(`SELECT * FROM transactions ORDER BY traded_on ASC, id ASC`);
  return rows.map(mapRow);
}

export async function createTransaction(input: {
  ticker: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  tradedOn: string;
  notes?: string | null;
}): Promise<Transaction> {
  const { rows } = await query<TxRow>(
    `INSERT INTO transactions (ticker, type, shares, price, traded_on, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [input.ticker.toUpperCase(), input.type, input.shares, input.price, input.tradedOn, input.notes ?? null],
  );
  return mapRow(rows[0]);
}

export async function deleteTransaction(id: number): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM transactions WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function distinctTickers(): Promise<string[]> {
  const { rows } = await query<{ ticker: string }>(
    `SELECT DISTINCT ticker FROM transactions ORDER BY ticker`,
  );
  return rows.map((r) => r.ticker);
}
