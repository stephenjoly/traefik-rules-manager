import { config } from './config.js';
import { createLogger } from './logger.js';
import { createApp, startFileWatcher } from './app.js';

async function start() {
  const app = await createApp();
  startFileWatcher();

  app.listen(config.port, config.host, () => {
    log.info('Server started', { port: config.port, host: config.host });
  });
}

start().catch(err => {
  createLogger(config.logLevel).error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
