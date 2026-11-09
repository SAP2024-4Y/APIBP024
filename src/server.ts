import { initializeDatabase } from './db/database';
import { runMigrations } from './db/schema';
import { seedDatabase } from './db/seed';
import { createApp } from './app';

const PORT = parseInt(process.env['PORT'] || '8080', 10);

async function main() {
  console.log('[startup] Initializing database...');
  const db = initializeDatabase();
  runMigrations(db);
  seedDatabase(db);

  console.log('[startup] Starting HTTP server...');
  const app = await createApp();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[startup] TicketSphere API running on http://0.0.0.0:${PORT}`);
    console.log(`[startup] REST docs  → http://localhost:${PORT}/docs`);
    console.log(`[startup] GraphQL IDE → http://localhost:${PORT}/graphql`);
    console.log(`[startup] Health     → http://localhost:${PORT}/health`);
  });
}

main().catch(err => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
