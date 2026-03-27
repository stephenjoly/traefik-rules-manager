import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { createApp, startFileWatcher } from '../app.js';
import { config as globalConfig } from '../config.js';
import { loadMetadata } from '../metadata.js';

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
    logLevel: 'error',
    authEnabled: true,
    adminUsername: 'admin',
    adminPassword: 'secret-password',
    sessionSecret: 'test-session-secret',
    sessionTtlHours: 12,
    cookieSecure: false
  };
}

describe('API integration', () => {
  let request;
  let agent;
  let watcher;
  let tmpConfig;

  async function login() {
    await agent
      .post('/api/auth/login')
      .send({ username: tmpConfig.adminUsername, password: tmpConfig.adminPassword })
      .expect(200);
  }

  beforeAll(async () => {
    tmpConfig = mkTempConfig();
    Object.assign(globalConfig, tmpConfig);
    const app = await createApp();
    watcher = startFileWatcher();
    request = supertest(app);
    agent = supertest.agent(app);
  });

  afterAll(async () => {
    watcher?.close();
    fs.rmSync(tmpConfig.root, { recursive: true, force: true });
  });

  it('keeps health endpoints public and protects session-based routes', async () => {
    await request.get('/health').expect(200);
    await request.get('/ready').expect(200);
    await request.get('/api/health').expect(200);
    const docs = await request.get('/api-docs/openapi.json').expect(200);
    expect(docs.body.paths['/api/automation/rules']).toBeTruthy();
    await request.get('/api-docs').expect(200);
    await request.get('/api/rules').expect(401);

    const session = await request.get('/api/auth/session').expect(401);
    expect(session.body.authEnabled).toBe(true);
    expect(session.body.authenticated).toBe(false);
  });

  it('logs in admin users and rejects invalid credentials', async () => {
    await request
      .post('/api/auth/login')
      .send({ username: tmpConfig.adminUsername, password: 'wrong-password' })
      .expect(401);

    const response = await agent
      .post('/api/auth/login')
      .send({ username: tmpConfig.adminUsername, password: tmpConfig.adminPassword })
      .expect(200);

    expect(response.body.authenticated).toBe(true);
    expect(response.headers['set-cookie']?.[0]).toContain('trm_session=');

    const session = await agent.get('/api/auth/session').expect(200);
    expect(session.body.username).toBe(tmpConfig.adminUsername);
  });

  it('creates and fetches a rule through the admin session', async () => {
    await login();

    const payload = {
      name: 'api',
      hostname: 'api.example.com',
      backendUrl: ['http://127.0.0.1:8080'],
      entryPoints: ['web'],
      tls: true
    };

    const created = await agent.post('/api/rules').send(payload).expect(201);
    expect(created.body.name).toBe('api');

    const list = await agent.get('/api/rules').expect(200);
    expect(list.body).toHaveLength(1);

    const fetchedYaml = await agent.get(`/api/rules/${created.body.id}/yaml`).expect(200);
    expect(fetchedYaml.text).toContain('Host(`api.example.com`)');
  });

  it('creates API keys once, hides hashes from listings, revokes them, and deletes them', async () => {
    await login();

    const created = await agent
      .post('/api/admin/api-keys')
      .send({ name: 'github-actions' })
      .expect(201);

    expect(created.body.apiKey).toMatch(/^trm_[^_]+_/);
    expect(created.body.record.name).toBe('github-actions');
    expect(created.body.record).not.toHaveProperty('keyHash');

    const metadata = await loadMetadata(tmpConfig.metadataPath);
    expect(metadata.apiKeys).toHaveLength(1);
    expect(metadata.apiKeys[0].keyHash).toBeTruthy();
    expect(metadata.apiKeys[0].keyHash).not.toContain(created.body.apiKey);

    const listed = await agent.get('/api/admin/api-keys').expect(200);
    expect(listed.body[0]).not.toHaveProperty('apiKey');
    expect(listed.body[0]).not.toHaveProperty('keyHash');

    await agent.post(`/api/admin/api-keys/${created.body.record.id}/revoke`).expect(200);

    await request
      .get('/api/automation/rules')
      .set('Authorization', `Bearer ${created.body.apiKey}`)
      .expect(401);

    await agent.delete(`/api/admin/api-keys/${created.body.record.id}`).expect(204);

    const listedAfterDelete = await agent.get('/api/admin/api-keys').expect(200);
    expect(listedAfterDelete.body.find(key => key.id === created.body.record.id)).toBeUndefined();
  });

  it('allows automation full CRUD and updates lastUsedAt for valid keys', async () => {
    await login();
    const keyCreate = await agent
      .post('/api/admin/api-keys')
      .send({ name: 'automation-key' })
      .expect(201);

    const apiKey = keyCreate.body.apiKey;

    const payload = {
      name: 'automation-rule',
      hostname: 'automation.example.com',
      backendUrl: ['http://127.0.0.1:8085'],
      entryPoints: ['web'],
      tls: false
    };

    const created = await request
      .post('/api/automation/rules')
      .set('Authorization', `Bearer ${apiKey}`)
      .send(payload)
      .expect(201);

    const updated = await request
      .put(`/api/automation/rules/${created.body.id}`)
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ ...payload, hostname: 'updated.example.com' })
      .expect(200);
    expect(updated.body.hostname).toBe('updated.example.com');

    const listed = await request
      .get('/api/automation/rules')
      .set('Authorization', `Bearer ${apiKey}`)
      .expect(200);
    expect(listed.body.some(rule => rule.name === 'automation-rule')).toBe(true);

    const keyList = await agent.get('/api/admin/api-keys').expect(200);
    const storedKey = keyList.body.find(key => key.id === keyCreate.body.record.id);
    expect(storedKey.lastUsedAt).toBeTruthy();

    await request
      .delete(`/api/automation/rules/${created.body.id}`)
      .set('Authorization', `Bearer ${apiKey}`)
      .expect(204);
  });

  it('rejects expired automation keys', async () => {
    await login();
    const created = await agent
      .post('/api/admin/api-keys')
      .send({ name: 'expired-key', expiresAt: '2000-01-01T00:00:00.000Z' })
      .expect(201);

    await request
      .get('/api/automation/rules')
      .set('Authorization', `Bearer ${created.body.apiKey}`)
      .expect(401);
  });
});
