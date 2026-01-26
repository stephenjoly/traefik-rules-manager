import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { discoverRules } from '../discovery.js';
import { initStorage } from '../rules-service.js';

function mkCtx() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-discovery-'));
  return {
    root,
    ctx: {
      dynamicPath: path.join(root, 'dynamic'),
      metadataPath: path.join(root, 'metadata'),
      backupsPath: path.join(root, 'backups'),
      maxBackups: 10
    }
  };
}

describe('Discovery', () => {
  let root, ctx;

  beforeEach(async () => {
    ({ root, ctx } = mkCtx());
    await initStorage(ctx);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('discovers existing YAML files on startup', async () => {
    // Create fake YAML files
    const yaml1 = `http:
  routers:
    app1:
      rule: Host(\`app1.example.com\`)
      service: app1
      entryPoints:
        - web
  services:
    app1:
      loadBalancer:
        servers:
          - url: http://localhost:8081
`;
    const yaml2 = `http:
  routers:
    app2:
      rule: Host(\`app2.example.com\`)
      service: app2
      entryPoints:
        - web
  services:
    app2:
      loadBalancer:
        servers:
          - url: http://localhost:8082
`;

    fs.writeFileSync(path.join(ctx.dynamicPath, 'app1.yaml'), yaml1);
    fs.writeFileSync(path.join(ctx.dynamicPath, 'app2.yml'), yaml2);

    // Run discovery with ID resolver
    const discovered = await discoverRules(ctx.dynamicPath, () => uuidv4());

    // Verify
    expect(discovered).toHaveLength(2);
    const names = discovered.map(r => r.name).sort();
    expect(names).toEqual(['app1', 'app2']);
    expect(discovered[0].id).toBeTruthy(); // Has ID
    expect(discovered[0].hostname).toBeTruthy(); // Parsed correctly
    expect(discovered[0].backendUrl).toBeDefined();
    expect(discovered[0].backendUrl.length).toBeGreaterThan(0);
  });

  it('handles invalid YAML during discovery', async () => {
    // Create invalid YAML (missing colon)
    const badYaml = `http:
  routers:
    bad:
      rule: Host(\`bad.com\`)
      entryPoints
        - web
`;
    fs.writeFileSync(path.join(ctx.dynamicPath, 'bad.yaml'), badYaml);

    // Should not crash and should skip invalid file
    const discovered = await discoverRules(ctx.dynamicPath, () => uuidv4());

    // Should return empty array (invalid files are skipped)
    expect(discovered).toBeDefined();
    expect(discovered).toEqual([]);
  });

  it('preserves IDs across resyncs', async () => {
    // Create initial rule
    const yaml = `http:
  routers:
    app:
      rule: Host(\`app.example.com\`)
      service: app
      entryPoints:
        - web
  services:
    app:
      loadBalancer:
        servers:
          - url: http://localhost:8080
`;
    fs.writeFileSync(path.join(ctx.dynamicPath, 'app.yaml'), yaml);

    // First discovery
    const idMap = new Map();
    const first = await discoverRules(ctx.dynamicPath, (name) => {
      if (!idMap.has(name)) idMap.set(name, uuidv4());
      return idMap.get(name);
    });
    expect(first).toHaveLength(1);
    const originalId = first[0].id;

    // Modify YAML externally (same name, different backend)
    const modifiedYaml = yaml.replace('8080', '8081');
    fs.writeFileSync(path.join(ctx.dynamicPath, 'app.yaml'), modifiedYaml);

    // Second discovery (resync) - should preserve ID
    const second = await discoverRules(ctx.dynamicPath, (name) => {
      if (!idMap.has(name)) idMap.set(name, uuidv4());
      return idMap.get(name);
    });

    // ID should be preserved
    expect(second).toHaveLength(1);
    expect(second[0].id).toBe(originalId);
    expect(second[0].backendUrl[0]).toContain('8081'); // Update reflected
  });

  it('assigns new IDs to new files', async () => {
    // Create first file
    const yaml1 = `http:
  routers:
    app1:
      rule: Host(\`app1.example.com\`)
      service: app1
      entryPoints:
        - web
  services:
    app1:
      loadBalancer:
        servers:
          - url: http://localhost:8081
`;
    fs.writeFileSync(path.join(ctx.dynamicPath, 'app1.yaml'), yaml1);

    const idMap = new Map();
    const first = await discoverRules(ctx.dynamicPath, (name) => {
      if (!idMap.has(name)) idMap.set(name, uuidv4());
      return idMap.get(name);
    });
    expect(first).toHaveLength(1);
    const id1 = first[0].id;

    // Add second file
    const yaml2 = yaml1.replace(/app1/g, 'app2').replace('8081', '8082');
    fs.writeFileSync(path.join(ctx.dynamicPath, 'app2.yaml'), yaml2);

    const second = await discoverRules(ctx.dynamicPath, (name) => {
      if (!idMap.has(name)) idMap.set(name, uuidv4());
      return idMap.get(name);
    });

    // Should have 2 rules with different IDs
    expect(second).toHaveLength(2);
    const ids = second.map(r => r.id);
    expect(ids).toContain(id1); // First ID preserved
    expect(ids[0]).not.toBe(ids[1]); // Different IDs
  });

  it('ignores non-YAML files', async () => {
    // Create YAML file
    const yaml = `http:
  routers:
    app:
      rule: Host(\`app.example.com\`)
      service: app
      entryPoints:
        - web
  services:
    app:
      loadBalancer:
        servers:
          - url: http://localhost:8080
`;
    fs.writeFileSync(path.join(ctx.dynamicPath, 'app.yaml'), yaml);

    // Create non-YAML files
    fs.writeFileSync(path.join(ctx.dynamicPath, 'README.md'), '# Test');
    fs.writeFileSync(path.join(ctx.dynamicPath, 'config.json'), '{}');
    fs.writeFileSync(path.join(ctx.dynamicPath, '.gitignore'), '*.log');

    const discovered = await discoverRules(ctx.dynamicPath, () => uuidv4());

    // Should only find the YAML file
    expect(discovered).toHaveLength(1);
    expect(discovered[0].name).toBe('app');
  });

  it('handles empty directory', async () => {
    // Empty dynamic path
    const discovered = await discoverRules(ctx.dynamicPath, () => uuidv4());

    // Should return empty array
    expect(discovered).toEqual([]);
  });
});
