import express from 'express';
import cors from 'cors';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import { config } from './config.js';
import { createLogger } from './logger.js';
import { ensureDir } from './fs-helpers.js';
import { discoverRules } from './discovery.js';
import { loadMetadata, saveMetadata } from './metadata.js';
import { parseTraefikYaml } from './yaml.js';
import {
  initStorage,
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule
} from './rules-service.js';
import { normalizeRule, validateRule } from './validation.js';
import { v4 as uuidv4 } from 'uuid';

const log = createLogger(config.logLevel);
let watcherRef = null;
let discoveryComplete = false;

async function syncFromDisk() {
  await initStorage(config);
  const existing = await loadMetadata(config.metadataPath);
  const idMap = new Map(existing.rules.map(r => [r.name, r.id]));

  const rules = await discoverRules(config.dynamicPath, (routerName, filePath) => {
    // Use filename (not router name) to preserve IDs across resyncs
    const fileName = path.basename(filePath, path.extname(filePath));
    return idMap.get(fileName) || uuidv4();
  });
  await saveMetadata(config.metadataPath, { rules });
  log.info('Synced metadata from disk', { count: rules.length });
  return rules;
}

export function startFileWatcher(dynamicPath = config.dynamicPath) {
  if (watcherRef) {
    watcherRef.close().catch(() => {});
    watcherRef = null;
  }

  const watcher = chokidar.watch(path.join(dynamicPath, '*.{yaml,yml}'), {
    persistent: true,
    ignoreInitial: true,
    depth: 0
  });

  let timer;
  const debounceMs = parseInt(process.env.TRM_FILE_WATCH_DEBOUNCE || '2000', 10);
  const debouncedSync = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      syncFromDisk().catch(err => log.error('Resync failed', { error: err.message }));
    }, debounceMs);
  };

  watcher
    .on('add', debouncedSync)
    .on('change', debouncedSync)
    .on('unlink', debouncedSync)
    .on('error', (err) => log.error('Watcher error', { error: err.message }));

  log.info('File watcher started', { path: dynamicPath });
  watcherRef = watcher;
  return watcher;
}


export async function createApp() {
  await initStorage(config);
  await ensureDir(config.dynamicPath);
  await ensureDir(config.metadataPath);
  await ensureDir(config.backupsPath);
  await syncFromDisk();
  discoveryComplete = true;

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', async (req, res) => {
    try {
      await fs.access(config.dynamicPath);
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        configPath: config.dynamicPath
      });
    } catch (err) {
      res.status(503).json({
        status: 'unhealthy',
        error: err.message
      });
    }
  });

  app.get('/ready', (req, res) => {
    if (discoveryComplete) {
      res.json({
        ready: true,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        ready: false,
        message: 'Discovery in progress'
      });
    }
  });

  app.get('/api/rules', async (req, res, next) => {
    try {
      const rules = await listRules(config);
      res.json(rules);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/rules/:id', async (req, res, next) => {
    try {
      const rule = await getRule(config, req.params.id);
      if (!rule) return res.status(404).json({ error: 'Not found' });
      res.json(rule);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/rules/:id/yaml', async (req, res, next) => {
    try {
      const rule = await getRule(config, req.params.id);
      if (!rule) return res.status(404).json({ error: 'Not found' });
      const yamlPath = path.join(config.dynamicPath, `${rule.name}.yaml`);
      const content = await fs.readFile(yamlPath, 'utf8');
      res.type('text/yaml').send(content);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/rules', async (req, res, next) => {
    try {
      const rule = await createRule(config, req.body);
      res.status(201).json(rule);
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/rules/:id', async (req, res, next) => {
    try {
      const rule = await updateRule(config, req.params.id, req.body);
      res.json(rule);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/rules/:id', async (req, res, next) => {
    try {
      await deleteRule(config, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/rules/validate', async (req, res) => {
    const body = req.body || {};
    if (body.yamlContent) {
      try {
        parseTraefikYaml(body.yamlContent);
        return res.json({ valid: true });
      } catch (err) {
        return res.status(400).json({ valid: false, errors: [err.message] });
      }
    }

    const normalized = normalizeRule(body);
    const valid = validateRule(normalized);
    if (!valid) {
      const errors = validateRule.errors?.map(e => `${e.instancePath || 'rule'} ${e.message}`) || [];
      return res.status(400).json({ valid: false, errors });
    }
    return res.json({ valid: true });
  });

  app.get('/api/middlewares', async (req, res, next) => {
    try {
      const rules = await listRules(config);
      const middlewareSet = new Set();
      rules.forEach(rule => (rule.middlewares || []).forEach(mw => middlewareSet.add(mw)));
      res.json(Array.from(middlewareSet));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/resync', async (req, res, next) => {
    try {
      const rules = await syncFromDisk();
      res.json({ count: rules.length });
    } catch (err) {
      next(err);
    }
  });

  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    log.error(err.message, { stack: err.stack, status });
    res.status(status).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}
