import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { ensureUniverseSeeded } from './db/universe.js';
import { createProvider } from './providers/index.js';

async function main(): Promise<void> {
  await migrate();
  await ensureUniverseSeeded();
  const app = createApp(createProvider());
  app.listen(config.port, () => {
    console.log(`VG Analyzer API listening on http://localhost:${config.port} (provider: ${config.provider})`);
  });
}

main().catch((err) => {
  console.error('failed to start server:', err);
  process.exit(1);
});
