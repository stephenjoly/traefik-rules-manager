import path from 'node:path';
import { ensureDir, readJson, writeJson } from './fs-helpers.js';

function normalizeMetadata(data = {}) {
  return {
    rules: Array.isArray(data.rules) ? data.rules : [],
    apiKeys: Array.isArray(data.apiKeys) ? data.apiKeys : []
  };
}

export async function loadMetadata(metadataPath) {
  const file = path.join(metadataPath, 'index.json');
  await ensureDir(metadataPath);
  const data = await readJson(file, { rules: [], apiKeys: [] });
  return normalizeMetadata(data);
}

export async function saveMetadata(metadataPath, data) {
  const file = path.join(metadataPath, 'index.json');
  await writeJson(file, normalizeMetadata(data));
}
