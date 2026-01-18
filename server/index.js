import { config } from './config.js';
import { createLogger } from './logger.js';
import { createApp, startFileWatcher } from './app.js';

const log = createLogger(config.logLevel);

async function start() {
  const app = await createApp();
  startFileWatcher();

  app.listen(config.port, config.host, () => {
    log.info('Server started', { port: config.port, host: config.host });
  });
}

start().catch(err => {
  log.error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
