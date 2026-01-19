import path from 'node:path';
import { promises as fs } from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { atomicWrite, copyFileSafe, ensureDir, removeFileSafe } from './fs-helpers.js';
import { generateTraefikYaml } from './yaml.js';
import { loadMetadata, saveMetadata } from './metadata.js';
import { normalizeRule, validateRule } from './validation.js';

function sanitizeName(name) {
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) return null;
  return name;
}

function buildYamlPath(dynamicPath, name) {
  return path.join(dynamicPath, `${name}.yaml`);
}

function backupPath(backupsPath, name) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(backupsPath, `${name}-${stamp}.yaml`);
}

async function pruneBackups(backupsPath, name, maxBackups) {
  if (!maxBackups || maxBackups <= 0) return;
  const prefix = `${name}-`;
  const entries = await fs.readdir(backupsPath).catch(() => []);
  const candidates = await Promise.all(
    entries
      .filter(file => file.startsWith(prefix) && file.endsWith('.yaml'))
      .map(async file => {
        const stat = await fs.stat(path.join(backupsPath, file)).catch(() => null);
        return stat ? { file, mtime: stat.mtimeMs } : null;
      })
  );
  const sorted = candidates.filter(Boolean).sort((a, b) => b.mtime - a.mtime);
  const toDelete = sorted.slice(maxBackups);
  await Promise.all(toDelete.map(entry => removeFileSafe(path.join(backupsPath, entry.file))));
}

export async function initStorage({ dynamicPath, metadataPath, backupsPath }) {
  await ensureDir(dynamicPath);
  await ensureDir(metadataPath);
  await ensureDir(backupsPath);
}

export async function listRules(ctx) {
  const meta = await loadMetadata(ctx.metadataPath);
  return meta.rules;
}

export async function getRule(ctx, id) {
  const meta = await loadMetadata(ctx.metadataPath);
  return meta.rules.find(rule => rule.id === id) || null;
}

export async function createRule(ctx, input) {
  const rule = normalizeRule({ ...input, id: uuidv4() });
  const valid = validateRule(rule);
  if (!valid) {
    const error = validateRule.errors?.map(err => `${err.instancePath || 'rule'} ${err.message}`).join('; ');
    const err = new Error(`Validation failed: ${error}`);
    err.status = 400;
    throw err;
  }

  const cleanName = sanitizeName(rule.name);
  if (!cleanName) {
    const err = new Error('Invalid rule name');
    err.status = 400;
    throw err;
  }
  if (!rule.serviceName) {
    rule.serviceName = rule.name;
  }
  if (!rule.serviceName) {
    rule.serviceName = rule.name;
  }

  const meta = await loadMetadata(ctx.metadataPath);
  if (meta.rules.some(r => r.name === rule.name)) {
    const err = new Error('Rule name already exists');
    err.status = 409;
    throw err;
  }

  const yamlContent = generateTraefikYaml(rule);
  const filePath = buildYamlPath(ctx.dynamicPath, cleanName);
  await atomicWrite(filePath, yamlContent);

  const storedRule = {
    ...rule,
    yamlContent,
    lastModified: new Date().toISOString(),
    fileName: path.basename(filePath),
    isValid: true,
    validationErrors: []
  };
  meta.rules.push(storedRule);
  await saveMetadata(ctx.metadataPath, meta);
  return storedRule;
}

export async function updateRule(ctx, id, input) {
  const rule = normalizeRule({ ...input, id });
  const valid = validateRule(rule);
  if (!valid) {
    const error = validateRule.errors?.map(err => `${err.instancePath || 'rule'} ${err.message}`).join('; ');
    const err = new Error(`Validation failed: ${error}`);
    err.status = 400;
    throw err;
  }

  const meta = await loadMetadata(ctx.metadataPath);
  let index = meta.rules.findIndex(r => r.id === id);
  if (index === -1 && rule.previousName) {
    index = meta.rules.findIndex(r => r.name === rule.previousName || (r.fileName || '').replace(/\.ya?ml$/i, '') === rule.previousName);
  }
  if (index === -1 && rule.name) {
    // Fallback: try matching by name if ids drifted due to resync
    index = meta.rules.findIndex(r => r.name === rule.name || (r.fileName || '').replace(/\.ya?ml$/i, '') === rule.name);
  }
  if (index === -1) {
    const err = new Error('Rule not found');
    err.status = 404;
    throw err;
  }

  const cleanName = sanitizeName(rule.name);
  if (!cleanName) {
    const err = new Error('Invalid rule name');
    err.status = 400;
    throw err;
  }

  const targetId = meta.rules[index]?.id || id;
  // ensure we keep the persisted id to avoid churn when we matched by name/previousName
  rule.id = targetId;

  if (meta.rules.some(r => r.name === cleanName && r.id !== targetId)) {
    const err = new Error('Rule name already exists');
    err.status = 409;
    throw err;
  }

  const yamlContent = generateTraefikYaml(rule);
  const filePath = buildYamlPath(ctx.dynamicPath, cleanName);
  const previous = meta.rules[index];
  const backupFile = backupPath(ctx.backupsPath, cleanName);
  await copyFileSafe(filePath, backupFile).catch(() => {});
  await atomicWrite(filePath, yamlContent);
  await pruneBackups(ctx.backupsPath, cleanName, ctx.maxBackups);
  if (previous?.name && previous.name !== cleanName) {
    const oldPath = buildYamlPath(ctx.dynamicPath, previous.name);
    await removeFileSafe(oldPath).catch(() => {});
  }

  const storedRule = {
    ...rule,
    yamlContent,
    lastModified: new Date().toISOString(),
    fileName: path.basename(filePath),
    isValid: true,
    validationErrors: []
  };
  meta.rules[index] = storedRule;
  await saveMetadata(ctx.metadataPath, meta);
  return storedRule;
}

export async function deleteRule(ctx, id) {
  const meta = await loadMetadata(ctx.metadataPath);
  let index = meta.rules.findIndex(r => r.id === id);
  if (index === -1) {
    const err = new Error('Rule not found');
    err.status = 404;
    throw err;
  }

  const rule = meta.rules[index];
  const filePath = buildYamlPath(ctx.dynamicPath, rule.name);
  const backupFile = backupPath(ctx.backupsPath, rule.name);
  await copyFileSafe(filePath, backupFile).catch(() => {});
  await pruneBackups(ctx.backupsPath, rule.name, ctx.maxBackups);
  await removeFileSafe(filePath);
  meta.rules.splice(index, 1);
  await saveMetadata(ctx.metadataPath, meta);
}
