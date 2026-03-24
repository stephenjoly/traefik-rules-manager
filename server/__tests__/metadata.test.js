import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadMetadata } from '../metadata.js';

describe('metadata loading', () => {
  const roots = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('backfills apiKeys for legacy metadata files', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-meta-'));
    roots.push(root);

    const metadataDir = path.join(root, 'metadata');
    fs.mkdirSync(metadataDir, { recursive: true });
    fs.writeFileSync(path.join(metadataDir, 'index.json'), JSON.stringify({
      rules: [{ id: '1', name: 'legacy' }]
    }));

    const metadata = await loadMetadata(metadataDir);
    expect(metadata.rules).toHaveLength(1);
    expect(metadata.apiKeys).toEqual([]);
  });
});
