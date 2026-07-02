import { query } from './pool.js';

export interface SeedTicker {
  symbol: string;
  name: string;
  market: 'US' | 'CA';
}

// The screening universe. Shared by the seed script and the startup auto-seed
// (a fresh production database gets the universe without demo transactions).
export const UNIVERSE: SeedTicker[] = [
  // US — value / cyclical names the engine should like when cheap
  { symbol: 'INTC', name: 'Intel Corporation', market: 'US' },
  { symbol: 'PFE', name: 'Pfizer Inc.', market: 'US' },
  { symbol: 'F', name: 'Ford Motor Company', market: 'US' },
  { symbol: 'GM', name: 'General Motors Company', market: 'US' },
  { symbol: 'CVS', name: 'CVS Health Corporation', market: 'US' },
  { symbol: 'VZ', name: 'Verizon Communications Inc.', market: 'US' },
  { symbol: 'T', name: 'AT&T Inc.', market: 'US' },
  { symbol: 'WBA', name: 'Walgreens Boots Alliance', market: 'US' },
  { symbol: 'KO', name: 'The Coca-Cola Company', market: 'US' },
  { symbol: 'PEP', name: 'PepsiCo, Inc.', market: 'US' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', market: 'US' },
  { symbol: 'BAC', name: 'Bank of America Corporation', market: 'US' },
  { symbol: 'WFC', name: 'Wells Fargo & Company', market: 'US' },
  { symbol: 'C', name: 'Citigroup Inc.', market: 'US' },
  { symbol: 'MRK', name: 'Merck & Co., Inc.', market: 'US' },
  { symbol: 'CSCO', name: 'Cisco Systems, Inc.', market: 'US' },
  { symbol: 'IBM', name: 'International Business Machines', market: 'US' },
  { symbol: 'CVX', name: 'Chevron Corporation', market: 'US' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', market: 'US' },
  { symbol: 'GILD', name: 'Gilead Sciences, Inc.', market: 'US' },
  { symbol: 'BMY', name: 'Bristol-Myers Squibb Company', market: 'US' },
  { symbol: 'MO', name: 'Altria Group, Inc.', market: 'US' },
  { symbol: 'TGT', name: 'Target Corporation', market: 'US' },
  { symbol: 'HPQ', name: 'HP Inc.', market: 'US' },
  // US — semiconductors
  { symbol: 'MU', name: 'Micron Technology, Inc.', market: 'US' },
  { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', market: 'US' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', market: 'US' },
  { symbol: 'QCOM', name: 'QUALCOMM Incorporated', market: 'US' },
  { symbol: 'TXN', name: 'Texas Instruments Incorporated', market: 'US' },
  { symbol: 'MCHP', name: 'Microchip Technology Incorporated', market: 'US' },
  { symbol: 'ADI', name: 'Analog Devices, Inc.', market: 'US' },
  { symbol: 'AMAT', name: 'Applied Materials, Inc.', market: 'US' },
  { symbol: 'LRCX', name: 'Lam Research Corporation', market: 'US' },
  { symbol: 'NXPI', name: 'NXP Semiconductors N.V.', market: 'US' },
  { symbol: 'ON', name: 'ON Semiconductor Corporation', market: 'US' },
  { symbol: 'MRVL', name: 'Marvell Technology, Inc.', market: 'US' },
  // US — growth / expensive names (often rejected, useful as contrast)
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'US' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', market: 'US' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', market: 'US' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'US' },
  { symbol: 'GOOG', name: 'Alphabet Inc. (Class C)', market: 'US' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', market: 'US' },
  // Canada (TSX, .TO)
  { symbol: 'RY.TO', name: 'Royal Bank of Canada', market: 'CA' },
  { symbol: 'TD.TO', name: 'Toronto-Dominion Bank', market: 'CA' },
  { symbol: 'BNS.TO', name: 'Bank of Nova Scotia', market: 'CA' },
  { symbol: 'BMO.TO', name: 'Bank of Montreal', market: 'CA' },
  { symbol: 'CM.TO', name: 'Canadian Imperial Bank of Commerce', market: 'CA' },
  { symbol: 'NA.TO', name: 'National Bank of Canada', market: 'CA' },
  { symbol: 'ENB.TO', name: 'Enbridge Inc.', market: 'CA' },
  { symbol: 'TRP.TO', name: 'TC Energy Corporation', market: 'CA' },
  { symbol: 'CNQ.TO', name: 'Canadian Natural Resources', market: 'CA' },
  { symbol: 'SU.TO', name: 'Suncor Energy Inc.', market: 'CA' },
  { symbol: 'CVE.TO', name: 'Cenovus Energy Inc.', market: 'CA' },
  { symbol: 'BCE.TO', name: 'BCE Inc.', market: 'CA' },
  { symbol: 'T.TO', name: 'TELUS Corporation', market: 'CA' },
  { symbol: 'MFC.TO', name: 'Manulife Financial Corporation', market: 'CA' },
  { symbol: 'SLF.TO', name: 'Sun Life Financial Inc.', market: 'CA' },
  { symbol: 'FTS.TO', name: 'Fortis Inc.', market: 'CA' },
  { symbol: 'NTR.TO', name: 'Nutrien Ltd.', market: 'CA' },
  { symbol: 'CNR.TO', name: 'Canadian National Railway', market: 'CA' },
  { symbol: 'POW.TO', name: 'Power Corporation of Canada', market: 'CA' },
  { symbol: 'IFC.TO', name: 'Intact Financial Corporation', market: 'CA' },
];

// Ensure every universe ticker exists (idempotent upsert, run on each startup).
// This also propagates NEW names added to UNIVERSE into an already-seeded
// production DB — previously it bailed when the table was non-empty, so later
// additions (e.g. AMZN) never reached production. Existing rows and any demo
// transactions are untouched (ON CONFLICT DO NOTHING).
export async function ensureUniverseSeeded(): Promise<void> {
  const { rows: before } = await query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM tickers`);
  for (const t of UNIVERSE) {
    await query(
      `INSERT INTO tickers (symbol, name, market) VALUES ($1, $2, $3) ON CONFLICT (symbol) DO NOTHING`,
      [t.symbol, t.name, t.market],
    );
  }
  const { rows: after } = await query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM tickers`);
  const added = after[0].count - before[0].count;
  if (added > 0) console.log(`seeded ${added} new universe ticker(s) (${after[0].count} total)`);
}
