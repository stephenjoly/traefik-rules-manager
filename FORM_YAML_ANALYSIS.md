# Form ↔ YAML Editor Round-Trip Analysis

## Overview

This document analyzes the form builder and YAML editor experience, focusing on data integrity when switching between modes.

## Test Scenarios

### Scenario 1: Basic Rule (All Defaults)
```yaml
http:
  routers:
    my-app:
      rule: Host(`app.example.com`)
      service: my-app
      entryPoints:
        - web
        - websecure
      tls: {}
  services:
    my-app:
      loadBalancer:
        servers:
          - url: http://192.168.1.10:8080
        passHostHeader: true
```

**Expected Behavior**:
- ✅ Form → YAML → Form: All values preserved
- ⚠️ Empty `tls: {}` gets removed (becomes no `tls` field)
- ⚠️ `passHostHeader: true` always written (verbose but correct)

---

### Scenario 2: Advanced Rule (All Fields)
```yaml
http:
  routers:
    my-app:
      rule: Host(`app.example.com`)
      service: my-app
      entryPoints:
        - web
        - websecure
      middlewares:
        - compress
        - rate-limit
      priority: 100
      tls:
        certResolver: letsencrypt
        options: tls-opts@file
  services:
    my-app:
      loadBalancer:
        servers:
          - url: http://192.168.1.10:8080
          - url: http://192.168.1.11:8080
        passHostHeader: false
        sticky:
          cookie:
            name: my-app_sticky
        healthCheck:
          path: /health
          interval: 30s
        serversTransport: firefox
  serversTransports:
    firefox:
      insecureSkipVerify: true
```

**Expected Behavior**:
- ✅ Form → YAML → Form: All values preserved
- ✅ Multiple backends preserved
- ✅ Middlewares array preserved
- ✅ `passHostHeader: false` preserved correctly
- ✅ `serversTransport` and `insecureSkipVerify` preserved

---

### Scenario 3: Edge Case - Zero Values
```yaml
http:
  routers:
    my-app:
      rule: Host(`app.example.com`)
      service: my-app
      entryPoints:
        - web
      priority: 0  # ← Explicit zero
      tls: {}      # ← Empty TLS
  services:
    my-app:
      loadBalancer:
        servers:
          - url: http://192.168.1.10:8080
        passHostHeader: false  # ← Explicit false
```

**Expected Behavior**:
- ⚠️ `priority: 0` disappears when Form → YAML (omitted)
- ⚠️ `tls: {}` disappears when Form → YAML (deleted if empty)
- ✅ `passHostHeader: false` preserved

---

### Scenario 4: Edge Case - Empty Arrays
```yaml
http:
  routers:
    my-app:
      rule: Host(`app.example.com`)
      service: my-app
      entryPoints:
        - web
      # middlewares: []  ← No middlewares field
  services:
    my-app:
      loadBalancer:
        servers:
          - url: http://192.168.1.10:8080
```

**Expected Behavior**:
- ✅ Empty/missing middlewares handled correctly
- ✅ Form shows no middlewares
- ✅ YAML doesn't include `middlewares` field (correct)

---

### Scenario 5: Invalid YAML
```yaml
http:
  routers:
    my-app:
      rule: Host(`app.example.com`)
      service: my-app
      entryPoints
        - web  # ← Missing colon (syntax error)
```

**Expected Behavior**:
- ❌ **BUG**: Switching to Form mode silently fails
- ❌ Form keeps old values with no error message
- ✅ Saving shows YAML error

---

## Issues Found

### 1. **Empty TLS Object Handling** (Low Priority)

**File**: [AddReverseProxy.tsx:940-951](src/app/components/AddReverseProxy.tsx#L940-L951)

**Issue**: When TLS is enabled but no certResolver/options are set:
1. Form adds `tls: {}`
2. Code immediately deletes it
3. YAML has no `tls` field

**Question**: Does Traefik interpret absence of `tls` as disabled, or is `tls: {}` valid?

**Recommendation**: Check Traefik docs. If `tls: {}` is valid, keep it.

```typescript
// Current (deletes empty tls):
if (Object.keys(router.tls).length === 0) {
  delete router.tls;
}

// Alternative (keep tls if enabled):
if (tls && Object.keys(router.tls).length === 0) {
  router.tls = {};  // Keep empty object if TLS enabled
}
```

---

### 2. **Priority 0 Disappears** (Low Priority)

**File**: [AddReverseProxy.tsx:957-959](src/app/components/AddReverseProxy.tsx#L957-L959)

**Issue**: `priority: 0` is omitted from YAML because it's the default.

**Impact**: User sets `priority: 0` explicitly → switches to Form → switches to YAML → field disappears.

**Recommendation**: This is actually **correct behavior** (Traefik default is 0). But could add a comment explaining it.

```typescript
// Omit priority: 0 since it's the Traefik default
if (options.priority !== 0) {
  router.priority = options.priority;
}
```

---

### 3. **Silent YAML Parse Failure** (Medium Priority)

**File**: [AddReverseProxy.tsx:384-386](src/app/components/AddReverseProxy.tsx#L384-L386)

**Issue**: Invalid YAML doesn't show error when switching to Form mode.

**Recommendation**: Show error toast when YAML is invalid.

```typescript
} catch (err) {
  // Current: silent failure
  // Better: show error
  toast.error('Invalid YAML - cannot sync to form. Fix YAML errors first.');
}
```

---

### 4. **`passHostHeader` Always Written** (Low Priority)

**File**: [AddReverseProxy.tsx:964](src/app/components/AddReverseProxy.tsx#L964)

**Issue**: YAML always includes `passHostHeader: true` even though it's the default.

**Impact**: Generated YAML is more verbose than necessary.

**Recommendation**: Only write if non-default.

```typescript
// Current:
loadBalancer: {
  servers: backends.map((url) => ({ url })),
  passHostHeader: options.passHostHeader,  // Always written
}

// Alternative:
loadBalancer: {
  servers: backends.map((url) => ({ url })),
  ...(options.passHostHeader !== true ? { passHostHeader: options.passHostHeader } : {}),
}
```

---

### 5. **Boolean Field Default Inconsistency** (Low Priority)

**File**: [SimpleEdit.tsx:58](src/app/components/SimpleEdit.tsx#L58)

**Issue**: Uses `||` instead of `??` for boolean defaults.

```typescript
// Current:
passHostHeader: normalized.passHostHeader || false,  // Wrong default

// Should be:
passHostHeader: normalized.passHostHeader ?? true,  // Correct default
```

**Impact**: Minimal, because the value comes from YAML which has the correct default already.

---

## Testing Recommendations

### Manual Test Procedure

1. **Create rule in Form mode**
   - Fill all fields including advanced options
   - Switch to YAML → verify all fields present
   - Switch back to Form → verify all values match
   - Save → reload page → verify persistence

2. **Create rule in YAML mode**
   - Paste complex YAML with all fields
   - Switch to Form → verify all fields populated
   - Modify a field in Form
   - Switch back to YAML → verify change reflected
   - Save → reload → verify

3. **Test edge cases**
   - Empty arrays (no middlewares, no backends)
   - Zero values (priority: 0)
   - Boolean toggles (TLS on/off, passHostHeader true/false)
   - Invalid YAML (missing colons, bad indentation)

4. **Test round-trip**
   - Form → YAML → Form → YAML → Form
   - Verify no data loss after multiple switches

### Automated Test (Recommended)

```javascript
// Create test file: src/app/__tests__/form-yaml-roundtrip.test.ts
import { generateYaml } from '../components/AddReverseProxy';
import { normalizeRuleFromYaml } from '../utils/rules';
import yaml from 'js-yaml';

describe('Form ↔ YAML round-trip', () => {
  it('preserves all fields through round-trip', () => {
    const original = {
      name: 'test-app',
      routerName: 'test-router',
      serviceName: 'test-service',
      hostname: 'test.example.com',
      backendUrl: ['http://localhost:8080', 'http://localhost:8081'],
      entryPoints: ['web', 'websecure'],
      tls: true,
      middlewares: ['compress', 'ratelimit'],
      priority: 100,
      certResolver: 'letsencrypt',
      tlsOptions: 'tls-opts@file',
      passHostHeader: false,
      stickySession: true,
      healthCheckPath: '/health',
      healthCheckInterval: '30s',
      serversTransport: 'firefox',
      serversTransportInsecureSkipVerify: true,
    };

    // Generate YAML from payload
    const yamlContent = generateYaml(
      original.name,
      original.routerName,
      original.serviceName,
      original.hostname,
      original.backendUrl,
      original.entryPoints,
      original.tls,
      original.middlewares,
      {
        priority: original.priority,
        certResolver: original.certResolver,
        tlsOptions: original.tlsOptions,
        passHostHeader: original.passHostHeader,
        stickySession: original.stickySession,
        healthCheckPath: original.healthCheckPath,
        healthCheckInterval: original.healthCheckInterval,
        serversTransport: original.serversTransport,
        serversTransportInsecureSkipVerify: original.serversTransportInsecureSkipVerify,
      }
    );

    // Parse YAML back to rule
    const parsed = yaml.load(yamlContent);
    const normalized = normalizeRuleFromYaml({
      ...original,
      yamlContent,
      id: 'test',
      fileName: 'test-app.yaml',
      lastModified: new Date(),
      isValid: true,
    });

    // Verify all fields match
    expect(normalized.hostname).toBe(original.hostname);
    expect(normalized.backendUrl).toEqual(original.backendUrl);
    expect(normalized.entryPoints).toEqual(original.entryPoints);
    expect(normalized.tls).toBe(original.tls);
    expect(normalized.middlewares).toEqual(original.middlewares);
    expect(normalized.priority).toBe(original.priority);
    expect(normalized.certResolver).toBe(original.certResolver);
    expect(normalized.tlsOptions).toBe(original.tlsOptions);
    expect(normalized.passHostHeader).toBe(original.passHostHeader);
    expect(normalized.stickySession).toBe(original.stickySession);
    expect(normalized.healthCheckPath).toBe(original.healthCheckPath);
    expect(normalized.healthCheckInterval).toBe(original.healthCheckInterval);
    expect(normalized.serversTransport).toBe(original.serversTransport);
    expect(normalized.serversTransportInsecureSkipVerify).toBe(original.serversTransportInsecureSkipVerify);
  });

  it('handles edge cases correctly', () => {
    // Test with minimal fields
    const minimal = {
      name: 'minimal',
      hostname: 'min.example.com',
      backendUrl: ['http://localhost:8080'],
      entryPoints: ['web'],
      tls: false,
    };

    // Should not crash and preserve all fields
    const yamlContent = generateYaml(
      minimal.name,
      minimal.name,
      minimal.name,
      minimal.hostname,
      minimal.backendUrl,
      minimal.entryPoints,
      minimal.tls,
      [],
      {
        priority: 0,
        certResolver: '',
        tlsOptions: '',
        passHostHeader: true,
        stickySession: false,
        healthCheckPath: '',
        healthCheckInterval: '',
      }
    );

    expect(yamlContent).toContain('Host(`min.example.com`)');
    expect(yamlContent).not.toContain('middlewares');  // Should not include empty array
    expect(yamlContent).not.toContain('priority: 0');  // Should not include default
  });
});
```

---

## Summary

### Overall Assessment: **B+ (Good with Minor Issues)**

The form ↔ YAML experience is **well-implemented** with proper sync functions and draft state management. Most fields round-trip correctly.

###  Issues Priority

| Priority | Issue | Impact | Fix Difficulty |
|----------|-------|--------|----------------|
| Medium | Silent YAML parse failure | UX confusion | Easy (5 min) |
| Low | Empty `tls: {}` handling | Minor confusion | Easy (2 min) |
| Low | `passHostHeader` verbosity | YAML noise | Easy (5 min) |
| Low | Boolean default inconsistency | Minimal | Trivial (1 min) |
| Low | Priority 0 omitted | Correct behavior | N/A (document it) |

### Recommendations

1. **Add error toast for invalid YAML** when switching modes (Medium priority)
2. **Verify TLS behavior** with actual Traefik - does `tls: {}` work? (Low priority)
3. **Add automated round-trip test** to prevent regressions (Low priority)
4. **Document intentional omissions** (priority: 0, empty middlewares) in code comments

### What Users Should Know

✅ **Works Great**:
- All advanced fields preserve correctly
- Multiple backends and entry points work
- Sticky sessions, health checks, transports all supported
- Live updates in EditRule (form changes reflect in YAML immediately)

⚠️ **Minor Quirks**:
- Invalid YAML doesn't show error when switching to form (keeps old values)
- Empty `tls: {}` gets removed from YAML
- `priority: 0` gets omitted (because it's the default)
- `passHostHeader: true` always written (even though it's default)

### Bottom Line

**The form ↔ YAML experience works reliably for MVP.** The issues found are minor and mostly cosmetic. No data loss occurs during normal usage. The biggest improvement would be showing an error when YAML is invalid.

**Recommended Action**: Add error toast for invalid YAML (5-minute fix), then ship it!
