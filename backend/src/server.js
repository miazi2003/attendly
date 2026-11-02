import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';

try {
  await connectDatabase();
  const server = app.listen(env.PORT, () => console.log(`Attendly API listening on port ${env.PORT}`));
  const shutdown = signal => {
    console.log(`${signal} received; shutting down`);
    server.close(async () => { await disconnectDatabase(); process.exit(0); });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error('Unable to start server:', error.message);
  process.exit(1);
}
