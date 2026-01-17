import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initStorage,
  createRule,
  updateRule,
  deleteRule
} from '../rules-service.js';
import { loadMetadata } from '../metadata.js';

function mkCtx(maxBackups = 2) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
  return {
    root,
    ctx: {
      dynamicPath: path.join(root, 'dynamic'),
      metadataPath: path.join(root, 'metadata'),
      backupsPath: path.join(root, 'backups'),
      maxBackups
    }
  };
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

const baseRule = {
  name: 'app',
  hostname: 'app.example.com',
  backendUrl: ['http://127.0.0.1:8080'],
  entryPoints: ['web'],
  tls: true
};

describe('rules-service', () => {
  let root;
  let ctx;

  beforeEach(async () => {
    ({ root, ctx } = mkCtx());
    await initStorage(ctx);
  });

  afterEach(() => {
    cleanup(root);
  });

  it('creates a rule, writes YAML, and persists metadata', async () => {
    const created = await createRule(ctx, baseRule);
    const yamlPath = path.join(ctx.dynamicPath, `${baseRule.name}.yaml`);
    const yaml = fs.readFileSync(yamlPath, 'utf8');
    expect(yaml).toContain('Host(`app.example.com`)');
    expect(yaml).toContain('http://127.0.0.1:8080');

    const meta = await loadMetadata(ctx.metadataPath);
    expect(meta.rules).toHaveLength(1);
    expect(meta.rules[0].id).toBe(created.id);
  });

  it('renames a rule and prunes old YAML file', async () => {
    const created = await createRule(ctx, baseRule);
    const updated = await updateRule(ctx, created.id, { ...baseRule, name: 'api' });

    const newPath = path.join(ctx.dynamicPath, 'api.yaml');
    const oldPath = path.join(ctx.dynamicPath, 'app.yaml');
    expect(fs.existsSync(newPath)).toBe(true);
    expect(fs.existsSync(oldPath)).toBe(false);
    const meta = await loadMetadata(ctx.metadataPath);
    expect(meta.rules[0].name).toBe('api');
    expect(meta.rules[0].id).toBe(updated.id);
  });

  it('keeps backups within maxBackups when updating', async () => {
    ({ root, ctx } = mkCtx(1));
    await initStorage(ctx);
    let current = await createRule(ctx, baseRule);
    current = await updateRule(ctx, current.id, { ...baseRule, hostname: 'api.example.com' });
    current = await updateRule(ctx, current.id, { ...baseRule, hostname: 'dash.example.com' });

    const backups = fs.readdirSync(ctx.backupsPath).filter(f => f.startsWith('app-'));
    expect(backups.length).toBeLessThanOrEqual(1);
    expect(current.hostname).toBe('dash.example.com');
  });

  it('deletes a rule and removes YAML', async () => {
    const created = await createRule(ctx, baseRule);
    await deleteRule(ctx, created.id);
    const yamlPath = path.join(ctx.dynamicPath, `${baseRule.name}.yaml`);
    expect(fs.existsSync(yamlPath)).toBe(false);
    const meta = await loadMetadata(ctx.metadataPath);
    expect(meta.rules).toHaveLength(0);
  });
});
