import crypto from 'node:crypto';
import { loadMetadata, saveMetadata } from './metadata.js';

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function createSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashKey(secret, salt = createSalt()) {
  const derived = crypto.scryptSync(secret, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

function verifyKey(secret, storedHash) {
  const [salt, expectedHex] = String(storedHash || '').split(':');
  if (!salt || !expectedHex) return false;
  const actual = crypto.scryptSync(secret, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function sanitizeName(name) {
  const trimmed = String(name || '').trim();
  return trimmed ? trimmed : null;
}

function sanitizeRecord(record) {
  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    lastUsedAt: record.lastUsedAt || null,
    revokedAt: record.revokedAt || null,
    revokedBy: record.revokedBy || null,
    expiresAt: record.expiresAt || null
  };
}

function validateExpiry(expiresAt) {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function listApiKeys(ctx) {
  const metadata = await loadMetadata(ctx.metadataPath);
  return metadata.apiKeys.map(sanitizeRecord).sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function createApiKey(ctx, input, createdBy) {
  const name = sanitizeName(input?.name);
  if (!name) {
    const err = new Error('API key name is required');
    err.status = 400;
    throw err;
  }

  const expiresAt = input?.expiresAt ? validateExpiry(input.expiresAt) : null;
  if (input?.expiresAt && !expiresAt) {
    const err = new Error('Invalid expiresAt value');
    err.status = 400;
    throw err;
  }

  const metadata = await loadMetadata(ctx.metadataPath);
  const id = crypto.randomUUID();
  const prefix = `trm_${id.slice(0, 8)}`;
  const secret = randomToken(32);
  const plaintextKey = `${prefix}_${secret}`;
  const record = {
    id,
    name,
    prefix,
    keyHash: hashKey(plaintextKey),
    createdAt: new Date().toISOString(),
    createdBy,
    lastUsedAt: null,
    revokedAt: null,
    revokedBy: null,
    expiresAt
  };

  metadata.apiKeys.push(record);
  await saveMetadata(ctx.metadataPath, metadata);

  return {
    apiKey: plaintextKey,
    record: sanitizeRecord(record)
  };
}

export async function revokeApiKey(ctx, id, revokedBy) {
  const metadata = await loadMetadata(ctx.metadataPath);
  const index = metadata.apiKeys.findIndex(key => key.id === id);
  if (index === -1) {
    const err = new Error('API key not found');
    err.status = 404;
    throw err;
  }

  const existing = metadata.apiKeys[index];
  metadata.apiKeys[index] = {
    ...existing,
    revokedAt: existing.revokedAt || new Date().toISOString(),
    revokedBy: revokedBy || existing.revokedBy || null
  };
  await saveMetadata(ctx.metadataPath, metadata);
  return sanitizeRecord(metadata.apiKeys[index]);
}

export async function authenticateApiKey(ctx, plaintextKey) {
  const metadata = await loadMetadata(ctx.metadataPath);
  const match = String(plaintextKey || '').match(/^(trm_[^_]+)_/);
  const prefix = match?.[1];
  if (!prefix) return null;
  const candidates = metadata.apiKeys.filter(key => key.prefix === prefix);

  for (const record of candidates) {
    if (record.revokedAt) continue;
    if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) continue;
    if (!verifyKey(plaintextKey, record.keyHash)) continue;

    record.lastUsedAt = new Date().toISOString();
    await saveMetadata(ctx.metadataPath, metadata);
    return sanitizeRecord(record);
  }

  return null;
}
