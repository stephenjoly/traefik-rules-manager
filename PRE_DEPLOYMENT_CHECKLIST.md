# Pre-Deployment Checklist for MVP

## Test Coverage Analysis

### ✅ **What You Have (Good Foundation)**

Your tests cover the **core reliability** requirements:

1. **API Integration Tests** ([api.test.js](server/__tests__/api.test.js))
   - ✅ Creates and fetches rules
   - ✅ Updates rules
   - ✅ Detects duplicate names (409 error)
   - ✅ Validates YAML content

2. **Rules Service Tests** ([rules-service.test.js](server/__tests__/rules-service.test.js))
   - ✅ Creates rules with YAML generation
   - ✅ Renames rules (file management)
   - ✅ Backup pruning (maxBackups limit)
   - ✅ Deletes rules

3. **Validation Tests** ([yaml-validation.test.js](server/__tests__/yaml-validation.test.js))
   - ✅ Valid rule acceptance
   - ✅ Invalid name rejection
   - ✅ Traefik-compliant YAML generation

**Test Stats**: 10 tests, 3 test files, all passing ✅

---

## 🚨 **Critical Gaps for MVP**

### 1. **No Discovery/Resync Tests** (HIGH PRIORITY)

**Risk**: Discovery is run on startup and handles existing YAML files. If this breaks, your app won't work with existing Traefik configs.

**Missing Coverage**:
- Discovery of existing YAML files on startup
- Resync after external file changes
- ID assignment for discovered rules
- Handling of invalid YAML files during discovery

**Why Critical**: Users will deploy this to EXISTING Traefik setups with existing configs. Discovery MUST work reliably.

**Test to Add**:
```javascript
// server/__tests__/discovery.test.js
describe('Discovery', () => {
  it('discovers existing YAML files on startup', async () => {
    // Create fake YAML files
    // Run syncFromDisk()
    // Verify all files discovered
    // Verify IDs assigned correctly
  });

  it('handles invalid YAML during discovery', async () => {
    // Create invalid YAML file
    // Run syncFromDisk()
    // Should not crash
    // Should mark file as invalid
  });

  it('preserves IDs across resyncs', async () => {
    // Create rule
    // Modify YAML file externally
    // Run resync
    // Verify same ID maintained
  });
});
```

---

### 2. **No File Watcher Tests** (MEDIUM PRIORITY)

**Risk**: File watcher is core to your "watch and sync" feature. If it breaks, external changes won't be detected.

**Missing Coverage**:
- File watcher triggers on external changes
- Debounce prevents resync storms
- Watcher handles rapid file changes

**Why Important**: This is a key differentiator of your tool - live sync with Traefik configs.

**Test to Add**:
```javascript
// server/__tests__/file-watcher.test.js
describe('File Watcher', () => {
  it('detects new YAML files', async () => {
    // Start watcher
    // Create YAML file
    // Wait for debounce
    // Verify resync occurred
  });

  it('debounces rapid changes', async () => {
    // Start watcher
    // Make 10 rapid file changes
    // Verify only 1 resync after debounce
  });
});
```

---

### 3. **No Error Handling Tests** (MEDIUM PRIORITY)

**Risk**: Edge cases like disk full, permission errors, or corrupt files could crash the app.

**Missing Coverage**:
- Disk full during write
- Permission errors
- Corrupt metadata.json
- Missing directories

**Test to Add**:
```javascript
describe('Error Handling', () => {
  it('handles disk full errors gracefully', async () => {
    // Mock fs.writeFile to throw ENOSPC
    // Attempt to create rule
    // Should return error, not crash
  });

  it('recovers from corrupt metadata.json', async () => {
    // Write invalid JSON to metadata.json
    // Start app
    // Should rebuild metadata, not crash
  });
});
```

---

### 4. **No Frontend Tests** (LOW PRIORITY for MVP)

**Risk**: Form logic, YAML editor sync, and UI state management could break without notice.

**Missing Coverage**: Everything frontend

**Why Low Priority**: Manual testing can catch most UI bugs. Backend reliability is more critical for MVP.

**If Time Permits**:
```javascript
// src/app/__tests__/form-yaml-sync.test.tsx
describe('Form ↔ YAML Sync', () => {
  it('syncs form changes to YAML', () => {
    // Render AddReverseProxy
    // Fill form fields
    // Switch to YAML mode
    // Verify YAML contains values
  });
});
```

---

## 📋 **MVP Deployment Checklist**

### Before Deploying

- [x] ✅ **Fix critical security issues** (path traversal, root user)
- [x] ✅ **Add error boundary** (prevent white screens)
- [x] ✅ **Add health/readiness checks**
- [x] ✅ **Document security requirements** (auth, permissions)
- [ ] ⚠️ **Add discovery/resync tests** (HIGH priority)
- [ ] ⚠️ **Add file watcher test** (MEDIUM priority)
- [ ] ⚠️ **Test with real Traefik config** (see below)
- [ ] ⚠️ **Create smoke test script** (see below)

---

## 🧪 **Recommended: Add Discovery Tests NOW**

This is the **most critical gap**. Here's a quick implementation:

```javascript
// server/__tests__/discovery.test.js
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { discoverRules } from '../discovery.js';
import { loadMetadata, saveMetadata } from '../metadata.js';
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
      entryPoints: [web]
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
      entryPoints: [web]
  services:
    app2:
      loadBalancer:
        servers:
          - url: http://localhost:8082
`;

    fs.writeFileSync(path.join(ctx.dynamicPath, 'app1.yaml'), yaml1);
    fs.writeFileSync(path.join(ctx.dynamicPath, 'app2.yml'), yaml2);

    // Run discovery
    const discovered = await discoverRules(ctx.dynamicPath, ctx.metadataPath);

    // Verify
    expect(discovered).toHaveLength(2);
    expect(discovered.map(r => r.name).sort()).toEqual(['app1', 'app2']);
    expect(discovered[0].id).toBeTruthy(); // Has ID
    expect(discovered[0].hostname).toBeTruthy(); // Parsed correctly
  });

  it('handles invalid YAML during discovery', async () => {
    // Create invalid YAML
    const badYaml = 'http:\n  routers:\n    bad:\n      rule: Host(`bad.com`)\n      entryPoints\n        - web';
    fs.writeFileSync(path.join(ctx.dynamicPath, 'bad.yaml'), badYaml);

    // Should not crash
    const discovered = await discoverRules(ctx.dynamicPath, ctx.metadataPath);

    // Should return empty or mark as invalid
    expect(discovered).toBeDefined();
    // Either empty or has rule marked as invalid
    if (discovered.length > 0) {
      expect(discovered[0].isValid).toBe(false);
    }
  });

  it('preserves IDs across resyncs', async () => {
    // Create initial rule
    const yaml = `http:
  routers:
    app:
      rule: Host(\`app.example.com\`)
      service: app
      entryPoints: [web]
  services:
    app:
      loadBalancer:
        servers:
          - url: http://localhost:8080
`;
    fs.writeFileSync(path.join(ctx.dynamicPath, 'app.yaml'), yaml);

    // First discovery
    const first = await discoverRules(ctx.dynamicPath, ctx.metadataPath);
    const originalId = first[0].id;

    // Modify YAML externally (same name)
    const modifiedYaml = yaml.replace('8080', '8081');
    fs.writeFileSync(path.join(ctx.dynamicPath, 'app.yaml'), modifiedYaml);

    // Second discovery (resync)
    const second = await discoverRules(ctx.dynamicPath, ctx.metadataPath);

    // ID should be preserved
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
      entryPoints: [web]
  services:
    app1:
      loadBalancer:
        servers:
          - url: http://localhost:8081
`;
    fs.writeFileSync(path.join(ctx.dynamicPath, 'app1.yaml'), yaml1);

    const first = await discoverRules(ctx.dynamicPath, ctx.metadataPath);
    const id1 = first[0].id;

    // Add second file
    const yaml2 = yaml1.replace(/app1/g, 'app2');
    fs.writeFileSync(path.join(ctx.dynamicPath, 'app2.yaml'), yaml2);

    const second = await discoverRules(ctx.dynamicPath, ctx.metadataPath);

    // Should have 2 rules with different IDs
    expect(second).toHaveLength(2);
    expect(second[0].id).toBe(id1); // First ID preserved
    expect(second[1].id).not.toBe(id1); // New ID for new file
  });
});
```

**Time to implement**: 30 minutes
**Value**: Prevents critical startup failures

---

## 🔥 **Critical: Test with Real Traefik**

Before deploying, you MUST test with actual Traefik:

### Real-World Integration Test

1. **Set up Traefik locally**:
```bash
# Create test Traefik instance
mkdir -p ./test-traefik/dynamic
docker run -d --name traefik-test \
  -p 8080:8080 \
  -v $(pwd)/test-traefik:/etc/traefik \
  traefik:latest
```

2. **Point TRM at Traefik's config**:
```bash
TRAEFIK_DYNAMIC_CONFIG_PATH=./test-traefik/dynamic npm run server
```

3. **Test workflow**:
   - Create rule via TRM UI
   - Check Traefik dashboard (http://localhost:8080) - does it appear?
   - Modify rule via TRM
   - Does Traefik reload it?
   - Edit YAML file directly
   - Does TRM resync correctly?
   - Test with existing Traefik config from your production

4. **Look for**:
   - YAML format issues (does Traefik reject it?)
   - File permissions (can Traefik read TRM-written files?)
   - Syntax errors in generated YAML
   - Missing required fields

**Time**: 1 hour
**Critical**: Yes - this is how users will actually use it

---

## 🎯 **Quick Smoke Test Script**

Create a simple smoke test that runs end-to-end:

```bash
#!/bin/bash
# smoke-test.sh

set -e

echo "🧪 Running smoke tests..."

# 1. Start backend in background
TRAEFIK_DYNAMIC_CONFIG_PATH=/tmp/trm-smoke npm run server &
SERVER_PID=$!
sleep 3

# 2. Test health endpoint
curl -f http://localhost:3001/health || exit 1
echo "✅ Health check passed"

# 3. Test ready endpoint
curl -f http://localhost:3001/ready || exit 1
echo "✅ Ready check passed"

# 4. Create a rule
curl -f -X POST http://localhost:3001/api/rules \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke-test","hostname":"smoke.test","backendUrl":["http://localhost:8080"],"entryPoints":["web"],"tls":false}' \
  || exit 1
echo "✅ Create rule passed"

# 5. List rules
RULES=$(curl -f http://localhost:3001/api/rules)
echo "$RULES" | grep -q "smoke-test" || exit 1
echo "✅ List rules passed"

# 6. Validate YAML file exists
[ -f "/tmp/trm-smoke/smoke-test.yaml" ] || exit 1
echo "✅ YAML file written"

# Cleanup
kill $SERVER_PID
rm -rf /tmp/trm-smoke

echo "✅ All smoke tests passed!"
```

**Usage**:
```bash
chmod +x smoke-test.sh
./smoke-test.sh
```

**Time**: 15 minutes to create
**Value**: Quick confidence check before deploy

---

## 📊 **Test Coverage Recommendations**

### Priority Levels

| Priority | Test Type | Status | Time | Impact |
|----------|-----------|--------|------|--------|
| 🔴 **CRITICAL** | Discovery/resync tests | Missing | 30 min | HIGH |
| 🔴 **CRITICAL** | Real Traefik integration | Missing | 1 hour | HIGH |
| 🟡 **HIGH** | File watcher tests | Missing | 20 min | MEDIUM |
| 🟡 **HIGH** | Smoke test script | Missing | 15 min | MEDIUM |
| 🟢 **MEDIUM** | Error handling tests | Missing | 30 min | LOW |
| ⚪ **LOW** | Frontend tests | Missing | 2+ hours | LOW |

### Current Coverage

- ✅ **Happy path**: Well tested
- ✅ **CRUD operations**: Well tested
- ✅ **Validation**: Well tested
- ⚠️ **Discovery**: Not tested (CRITICAL GAP)
- ⚠️ **File watching**: Not tested
- ⚠️ **Error handling**: Not tested
- ❌ **Frontend**: Not tested

---

## 🚀 **Minimal Viable Test Suite (2 hours)**

If you have limited time, do these in order:

1. **Test with real Traefik** (1 hour) - MUST DO
2. **Add discovery tests** (30 min) - Should do
3. **Create smoke test** (15 min) - Should do
4. **Add file watcher test** (15 min) - Nice to have

Everything else can wait until post-MVP based on user feedback.

---

## ✅ **MVP Ready Criteria**

You can deploy when:

- [x] All existing tests pass
- [x] Security issues fixed
- [x] Documentation updated
- [ ] Discovery tests added (or manually verified extensively)
- [ ] Tested with real Traefik instance
- [ ] Smoke test script created and passing

---

## 🎯 **My Recommendation**

**Before deploying**, spend 1.5 hours on:

1. **Real Traefik integration test** (1 hour) - Non-negotiable
2. **Discovery test** (30 min) - Prevents startup failures

The other tests can be added post-MVP based on bug reports.

Your current test suite covers the **happy path** very well. The gaps are in **edge cases and startup behavior**. For an MVP with real users testing, that's acceptable IF you test with real Traefik first.

---

## 📝 **Post-MVP Test Improvements**

After you have users:

1. Add tests for bugs reported by users
2. Add file watcher tests
3. Add error handling tests
4. Consider frontend tests if UI bugs are common
5. Add test coverage reporting

But don't let perfect be the enemy of good. Ship the MVP!
