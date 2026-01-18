import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { createApp, startFileWatcher } from '../app.js';
import { config as globalConfig } from '../config.js';

function mkTempConfig() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-api-'));
  return {
    root,
    dynamicPath: path.join(root, 'dynamic'),
    metadataPath: path.join(root, 'metadata'),
    backupsPath: path.join(root, 'backups'),
    port: 0,
    host: '127.0.0.1',
    maxBackups: 2,
    logLevel: 'error'
  };
}

describe('API integration', () => {
  let request;
  let watcher;
  let tmpConfig;

  beforeAll(async () => {
    tmpConfig = mkTempConfig();
    // Patch global config for the duration of tests
    Object.assign(globalConfig, tmpConfig);
    const app = await createApp();
    watcher = startFileWatcher();
    request = supertest(app);
  });

  afterAll(async () => {
    watcher?.close();
    fs.rmSync(tmpConfig.root, { recursive: true, force: true });
  });

  it('creates and fetches a rule', async () => {
    const payload = {
      name: 'api',
      hostname: 'api.example.com',
      backendUrl: ['http://127.0.0.1:8080'],
      entryPoints: ['web'],
      tls: true
    };

    const created = await request.post('/api/rules').send(payload).expect(201);
    expect(created.body.name).toBe('api');

    const list = await request.get('/api/rules').expect(200);
    expect(list.body).toHaveLength(1);

    const fetchedYaml = await request.get(`/api/rules/${created.body.id}/yaml`).expect(200);
    expect(fetchedYaml.text).toContain('Host(`api.example.com`)');
  });

  it('updates a rule and detects duplicates', async () => {
    const payload = {
      name: 'site',
      hostname: 'site.example.com',
      backendUrl: ['http://127.0.0.1:8081'],
      entryPoints: ['web'],
      tls: false
    };
    const created = await request.post('/api/rules').send(payload).expect(201);

    const updated = await request
      .put(`/api/rules/${created.body.id}`)
      .send({ ...payload, hostname: 'new.example.com' })
      .expect(200);
    expect(updated.body.hostname).toBe('new.example.com');

    await request.post('/api/rules').send({ ...payload, name: 'site' }).expect(409);
  });

  it('validates YAML content', async () => {
    const valid = await request.post('/api/rules/validate').send({ yamlContent: 'http: {}' }).expect(200);
    expect(valid.body.valid).toBe(true);

    const invalid = await request
      .post('/api/rules/validate')
      .send({ yamlContent: 'http: : bad' })
      .expect(400);
    expect(invalid.body.valid).toBe(false);
  });
});
