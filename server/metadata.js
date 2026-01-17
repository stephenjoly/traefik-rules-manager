import path from 'node:path';
import { ensureDir, readJson, writeJson } from './fs-helpers.js';

export async function loadMetadata(metadataPath) {
  const file = path.join(metadataPath, 'index.json');
  await ensureDir(metadataPath);
  return readJson(file, { rules: [] });
}

export async function saveMetadata(metadataPath, data) {
  const file = path.join(metadataPath, 'index.json');
  await writeJson(file, data);
}
