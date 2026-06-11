import { pool, closePool, query } from './pool.js';
import { migrate } from './migrate.js';
import { UNIVERSE } from './universe.js';


interface SeedTx {
  ticker: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  tradedOn: string;
  notes?: string;
}

const DEMO_TRANSACTIONS: SeedTx[] = [
  { ticker: 'INTC', type: 'BUY', shares: 50, price: 35.0, tradedOn: '2025-09-15', notes: 'Cheap turnaround play' },
  { ticker: 'PFE', type: 'BUY', shares: 100, price: 30.0, tradedOn: '2025-10-02', notes: 'Value, high yield' },
  { ticker: 'TD.TO', type: 'BUY', shares: 40, price: 80.0, tradedOn: '2025-08-20' },
  { ticker: 'ENB.TO', type: 'BUY', shares: 30, price: 50.0, tradedOn: '2025-07-10', notes: 'Dividend' },
  { ticker: 'AAPL', type: 'BUY', shares: 20, price: 175.0, tradedOn: '2025-06-01' },
  { ticker: 'AAPL', type: 'SELL', shares: 10, price: 195.0, tradedOn: '2026-02-15', notes: 'Trim winner' },
  { ticker: 'SU.TO', type: 'BUY', shares: 60, price: 48.0, tradedOn: '2025-11-05' },
];

async function seed(): Promise<void> {
  await migrate();

  for (const t of UNIVERSE) {
    await query(
      `INSERT INTO tickers (symbol, name, market)
       VALUES ($1, $2, $3)
       ON CONFLICT (symbol) DO UPDATE SET name = EXCLUDED.name, market = EXCLUDED.market, active = TRUE`,
      [t.symbol, t.name, t.market],
    );
  }
  console.log(`seeded ${UNIVERSE.length} universe tickers`);

  const { rows } = await query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM transactions`);
  if (rows[0].count === 0) {
    for (const tx of DEMO_TRANSACTIONS) {
      await query(
        `INSERT INTO transactions (ticker, type, shares, price, traded_on, notes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [tx.ticker, tx.type, tx.shares, tx.price, tx.tradedOn, tx.notes ?? null],
      );
    }
    console.log(`seeded ${DEMO_TRANSACTIONS.length} demo transactions`);
  } else {
    console.log('transactions already present — skipping demo transactions');
  }
}

seed()
  .then(() => closePool())
  .catch((err) => {
    console.error('seed failed:', err);
    return pool.end().finally(() => process.exit(1));
  });
