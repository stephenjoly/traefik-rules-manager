# Traefik Rules Manager (TRM) - Technical Context

## Project Overview

The Traefik Rules Manager (TRM) is a web-based configuration authoring layer for Traefik's dynamic file provider. It provides a user-friendly interface for creating and managing reverse proxy configurations without requiring users to hand-edit YAML files.

**Deployment Model**: TRM is designed to run on the same machine as Traefik via Docker, with a bind mount to the Traefik dynamic configuration directory. Users can simply run a Docker Compose file and immediately see all their existing Traefik rules in the UI.

### Core Principles

1. **Schema Compliance**: Respect Traefik's configuration schema completely
2. **Safety First**: Never write invalid configurations
3. **File-Based Truth**: File storage is the source of truth, not a database
4. **Hot Reload Support**: Support Traefik's hot-reload workflows
5. **Dual Interface**: Both simple form-based and advanced YAML editing
6. **Zero Configuration Discovery**: Automatically discover and display existing Traefik rules on startup

## MVP Scope

The MVP focuses on three core Traefik components:
- **HTTP Routers**: Route requests based on rules (e.g., hostname matching)
- **Services**: Define backend servers with load balancing
- **Middlewares**: Apply middleware chains to routes

## Features Implemented (Frontend)

### Dashboard
- Table-based view of all reverse proxy rules
- Columns: Name, Hostname, Backend URLs, Entry Points, TLS status, Last Modified
- Actions: Edit, Delete, Export YAML
- Search/filter functionality
- Add New Reverse Proxy button

### Add Reverse Proxy Page
- **Form Builder Mode**: Simple form interface with validation
- **YAML Editor Mode**: Advanced direct YAML editing
- **Single Hostname**: Each rule has exactly one hostname (not multiple)
- **Multiple Backends**: Support for multiple backend server URLs for load balancing
- **Multiple Entry Points**: Support for multiple Traefik entry points (e.g., web, websecure)
- **TLS Configuration**: Toggle for HTTPS/TLS
- **Advanced Configuration** (collapsible accordion):
  - Middlewares (multiple selection)
  - Priority (numeric)
  - Certificate Resolver (string)
  - Pass Host Header (boolean)
  - Sticky Sessions (boolean)
  - Health Check Path (string)
  - Health Check Interval (string)

### Edit Reverse Proxy Page
- **Simple Edit Mode**: Form interface (identical to Add page)
- **YAML Edit Mode**: Direct YAML editing
- Complete feature parity with Add page
- All advanced settings available
- Pre-populated with existing rule data

### Validation Rules
- Rule names: alphanumeric, hyphens, underscores only
- Hostname: required, valid domain format
- Backend URLs: at least one required
- Entry Points: at least one required

## Data Structure

### TraefikRule Type
```typescript
type TraefikRule = {
  id: string;                          // Unique identifier
  name: string;                        // Rule name (used in YAML)
  hostname: string;                    // Single hostname
  backendUrl: string[];                // Multiple backend URLs for load balancing
  entryPoints: string[];               // Entry points (e.g., ["web", "websecure"])
  tls: boolean;                        // TLS enabled
  yamlContent: string;                 // Generated YAML configuration
  lastModified: Date;                  // Last modification timestamp
  
  // Advanced configuration
  middlewares?: string[];              // Middleware names
  priority?: number;                   // Router priority (default: 0)
  certResolver?: string;               // Certificate resolver name
  passHostHeader?: boolean;            // Pass Host header to backend
  stickySession?: boolean;             // Enable sticky sessions
  healthCheckPath?: string;            // Health check endpoint
  healthCheckInterval?: string;        // Health check interval (e.g., "30s")
};
```

## Traefik Configuration Schema

**IMPORTANT NOTE**: The schemas and specific formats of Traefik rules documented here are draft implementations based on common Traefik patterns. Backend engineers should cross-reference all configuration structures with the [official Traefik API documentation](https://doc.traefik.io/traefik/) to ensure full compliance with the latest Traefik version. Pay special attention to:
- Router configuration options and syntax
- Service load balancer configurations
- Middleware definitions and parameters
- TLS configuration structure
- Health check options

### Generated YAML Structure

Each rule generates a Traefik dynamic configuration file with the following structure:

```yaml
http:
  routers:
    {rule-name}:
      rule: "Host(`{hostname}`)"
      service: {rule-name}
      entryPoints:
        - web
        - websecure
      middlewares:                    # Optional
        - compress
        - rate-limit
      priority: 100                   # Optional
      tls:                            # Optional
        certResolver: letsencrypt

  services:
    {rule-name}:
      loadBalancer:
        servers:
          - url: "http://192.168.1.10:8080"
          - url: "http://192.168.1.11:8080"
        passHostHeader: true          # Optional
        sticky:                        # Optional
          cookie:
            name: sticky
        healthCheck:                   # Optional
          path: "/health"
          interval: "30s"
```

### Traefik Schema Requirements

1. **Router Requirements**:
   - `rule`: Must be a valid Traefik rule (e.g., `Host(\`example.com\`)`)
   - `service`: Must reference an existing service name
   - `entryPoints`: Array of entry point names
   - `middlewares`: Optional array of middleware names (must be defined elsewhere)
   - `priority`: Optional integer (higher = evaluated first)
   - `tls`: Optional object with certResolver

2. **Service Requirements**:
   - `loadBalancer.servers`: Array of server objects with `url` property
   - `loadBalancer.passHostHeader`: Optional boolean
   - `loadBalancer.sticky.cookie.name`: Optional sticky session configuration
   - `loadBalancer.healthCheck`: Optional object with `path` and `interval`

3. **Middleware References**:
   - Middlewares are referenced by name in routers
   - Middleware definitions should exist elsewhere (not managed in MVP)
   - App should allow adding middleware names but not validate existence

## Backend Requirements

### Technology Stack Recommendations
- **Runtime**: Node.js
- **Framework**: Express.js or Fastify
- **File Watching**: chokidar (for detecting external YAML changes)
- **YAML Parsing**: js-yaml or yaml
- **Validation**: ajv or joi for schema validation
- **File System**: fs/promises (Node.js native)

### File Storage Structure

```
/config/
  /dynamic/                    # Traefik dynamic configuration directory
    rule-name-1.yaml
    rule-name-2.yaml
    rule-name-3.yaml
  /metadata/                   # TRM metadata storage
    index.json                 # List of all rules with metadata
```

### Metadata Index Structure

```json
{
  "rules": [
    {
      "id": "uuid-v4",
      "name": "my-app",
      "hostname": "app.example.com",
      "backendUrl": ["http://192.168.1.10:8080"],
      "entryPoints": ["web", "websecure"],
      "tls": true,
      "lastModified": "2026-01-17T10:30:00Z",
      "yamlFile": "my-app.yaml",
      "middlewares": ["compress"],
      "priority": 100,
      "certResolver": "letsencrypt",
      "passHostHeader": true,
      "stickySession": false,
      "healthCheckPath": "/health",
      "healthCheckInterval": "30s"
    }
  ]
}
```

### API Endpoints Required

#### GET /api/rules
- **Purpose**: List all reverse proxy rules
- **Response**: Array of TraefikRule objects
- **Implementation**: Read metadata/index.json + parse YAML files

#### GET /api/rules/:id
- **Purpose**: Get a single rule by ID
- **Response**: TraefikRule object
- **Implementation**: Find in index.json, read corresponding YAML

#### POST /api/rules
- **Purpose**: Create a new reverse proxy rule
- **Request Body**: TraefikRule (without id)
- **Response**: Created TraefikRule with id
- **Implementation**:
  1. Generate UUID for id
  2. Validate rule structure
  3. Generate Traefik-compliant YAML
  4. Validate YAML against Traefik schema
  5. Write YAML to /config/dynamic/{name}.yaml
  6. Update metadata/index.json
  7. Return created rule

#### PUT /api/rules/:id
- **Purpose**: Update an existing rule
- **Request Body**: Complete TraefikRule object
- **Response**: Updated TraefikRule
- **Implementation**:
  1. Validate rule exists
  2. Validate new rule structure
  3. Generate new YAML
  4. Validate YAML
  5. Atomically replace YAML file
  6. Update metadata/index.json
  7. Return updated rule

#### DELETE /api/rules/:id
- **Purpose**: Delete a rule
- **Response**: 204 No Content
- **Implementation**:
  1. Validate rule exists
  2. Delete YAML file from /config/dynamic/
  3. Remove from metadata/index.json

#### POST /api/rules/validate
- **Purpose**: Validate YAML without saving
- **Request Body**: { yamlContent: string }
- **Response**: { valid: boolean, errors?: string[] }
- **Implementation**: Parse and validate YAML structure

#### GET /api/rules/:id/yaml
- **Purpose**: Get raw YAML for a rule
- **Response**: Plain text YAML
- **Implementation**: Read YAML file directly

#### GET /api/middlewares
- **Purpose**: Get list of all middleware names referenced across rules
- **Response**: Array of strings
- **Implementation**: Parse all rules and extract unique middleware names

### File System Operations

#### Atomic File Writing
To prevent Traefik from reading partial/corrupt files during writes:

```javascript
// Pseudo-code
async function atomicFileWrite(filePath, content) {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, content, 'utf8');
  await fs.rename(tempPath, filePath); // Atomic on most filesystems
}
```

#### File Watching
Monitor external changes to YAML files:

```javascript
const chokidar = require('chokidar');

const watcher = chokidar.watch('/config/dynamic/*.yaml', {
  persistent: true,
  ignoreInitial: true
});

watcher.on('change', async (path) => {
  // Re-sync metadata/index.json with file system
  await resyncMetadata();
});

watcher.on('unlink', async (path) => {
  // Remove from metadata if file deleted externally
  await removeFromMetadata(path);
});
```

### YAML Generation Logic

The frontend currently generates YAML, but the backend should:
1. Accept structured data (TraefikRule)
2. Generate Traefik-compliant YAML server-side
3. Validate against Traefik schema before writing
4. Return generated YAML to frontend

#### YAML Generation Function

```javascript
function generateTraefikYAML(rule) {
  const config = {
    http: {
      routers: {
        [rule.name]: {
          rule: `Host(\`${rule.hostname}\`)`,
          service: rule.name,
          entryPoints: rule.entryPoints,
          ...(rule.middlewares?.length > 0 && { middlewares: rule.middlewares }),
          ...(rule.priority && { priority: rule.priority }),
          ...(rule.tls && {
            tls: {
              ...(rule.certResolver && { certResolver: rule.certResolver })
            }
          })
        }
      },
      services: {
        [rule.name]: {
          loadBalancer: {
            servers: rule.backendUrl.map(url => ({ url })),
            ...(rule.passHostHeader !== undefined && { passHostHeader: rule.passHostHeader }),
            ...(rule.stickySession && {
              sticky: {
                cookie: { name: 'sticky' }
              }
            }),
            ...(rule.healthCheckPath && {
              healthCheck: {
                path: rule.healthCheckPath,
                ...(rule.healthCheckInterval && { interval: rule.healthCheckInterval })
              }
            })
          }
        }
      }
    }
  };

  return yaml.dump(config, { indent: 2 });
}
```

### Validation Rules

#### Rule Name Validation
- Pattern: `/^[a-zA-Z0-9-_]+$/`
- Must be unique across all rules
- Used as filename: `{name}.yaml`

#### Hostname Validation
- Valid domain name format
- Support for wildcards: `*.example.com`
- Support for subdomains: `app.example.com`

#### Backend URL Validation
- Must be valid URL format
- Support HTTP and HTTPS schemes
- Include port if not standard (80/443)
- Example: `http://192.168.1.10:8080`

#### Entry Points Validation
- Array must not be empty
- Common values: `web` (port 80), `websecure` (port 443)
- Custom entry points allowed (Traefik configuration dependent)

#### Middleware Validation
- Names must match Traefik naming rules
- No validation that middleware exists (out of scope for MVP)
- Just store the reference names

#### Health Check Validation
- Path: Must start with `/`
- Interval: Must be valid duration (e.g., `30s`, `1m`, `500ms`)

### Error Handling

#### Validation Errors
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "name",
      "message": "Rule name already exists"
    },
    {
      "field": "backendUrl",
      "message": "At least one backend URL is required"
    }
  ]
}
```

#### File System Errors
```json
{
  "error": "File operation failed",
  "message": "Unable to write configuration file",
  "code": "EACCES"
}
```

#### YAML Parsing Errors
```json
{
  "error": "Invalid YAML",
  "message": "Unexpected token at line 5",
  "line": 5,
  "column": 12
}
```

### Safety Mechanisms

1. **Pre-Save Validation**: Validate YAML structure before writing
2. **Atomic Writes**: Use temp files + rename for atomic operations
3. **Backup Before Modify**: Keep backup of previous version
4. **Rollback Capability**: Restore previous version on error
5. **Read-After-Write Verification**: Verify file was written correctly
6. **Duplicate Name Prevention**: Check for name collisions before creation

### Configuration

#### Environment Variables
```bash
TRAEFIK_DYNAMIC_CONFIG_PATH=/config/dynamic
TRM_METADATA_PATH=/config/metadata
TRM_BACKUP_PATH=/config/backups
TRM_PORT=3001
TRM_HOST=0.0.0.0
```

#### Directory Structure Setup
```javascript
async function initializeDirectories() {
  await fs.mkdir('/config/dynamic', { recursive: true });
  await fs.mkdir('/config/metadata', { recursive: true });
  await fs.mkdir('/config/backups', { recursive: true });
  
  // Initialize index.json if it doesn't exist
  const indexPath = '/config/metadata/index.json';
  try {
    await fs.access(indexPath);
  } catch {
    await fs.writeFile(indexPath, JSON.stringify({ rules: [] }, null, 2));
  }
}
```

## Integration with Traefik

### Traefik Configuration

Traefik must be configured to watch the dynamic configuration directory:

```yaml
# traefik.yml (static configuration)
providers:
  file:
    directory: /config/dynamic
    watch: true
```

### Hot Reload Behavior

When TRM writes a new or updated YAML file:
1. Traefik detects the file change
2. Traefik validates the configuration
3. Traefik applies the new configuration without restart
4. Invalid configurations are logged but don't crash Traefik

### TRM's Responsibility
- Generate valid YAML that Traefik can parse
- Prevent invalid configurations from being written
- Provide clear error messages when validation fails

## Docker Deployment

### Design Goals
1. **Single-Machine Deployment**: Run TRM on the same machine as Traefik
2. **Bind Mount Integration**: Mount the existing Traefik rules directory
3. **Zero Configuration**: Automatically discover and display existing rules on startup
4. **Docker Compose Ready**: Simple `docker-compose up` to get started
5. **No Data Loss**: Existing Traefik configurations remain untouched

### Docker Compose Example

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Traefik dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - ./traefik/dynamic:/config/dynamic
      - ./traefik/acme.json:/acme.json
    networks:
      - traefik-network

  trm:
    image: traefik-rules-manager:latest
    container_name: trm
    restart: unless-stopped
    ports:
      - "3001:3001"  # TRM web interface
    environment:
      - TRAEFIK_DYNAMIC_CONFIG_PATH=/config/dynamic
      - TRM_METADATA_PATH=/config/metadata
      - TRM_BACKUP_PATH=/config/backups
      - TRM_PORT=3001
      - TRM_HOST=0.0.0.0
    volumes:
      # Bind mount the Traefik dynamic config directory
      - ./traefik/dynamic:/config/dynamic
      # TRM's own metadata storage (separate from Traefik)
      - ./trm/metadata:/config/metadata
      - ./trm/backups:/config/backups
    networks:
      - traefik-network
    depends_on:
      - traefik

networks:
  traefik-network:
    external: true
```

### Directory Structure for Docker Deployment

```
project-root/
├── docker-compose.yml
├── traefik/
│   ├── traefik.yml                # Traefik static configuration
│   ├── acme.json                  # Let's Encrypt certificates
│   └── dynamic/                   # Traefik dynamic configs (shared with TRM)
│       ├── rule-1.yaml
│       ├── rule-2.yaml
│       └── rule-3.yaml
└── trm/
    ├── metadata/                  # TRM metadata (not touched by Traefik)
    │   └── index.json
    └── backups/                   # TRM backups (not touched by Traefik)
        └── ...
```

### Dockerfile Requirements

The TRM Dockerfile should:

1. **Multi-stage build**: Separate build and runtime stages
2. **Node.js runtime**: Use official Node.js Alpine image for small size
3. **Non-root user**: Run as non-root for security
4. **Health check**: Implement health check endpoint
5. **Proper signal handling**: Graceful shutdown on SIGTERM

```dockerfile
# Example Dockerfile structure
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
RUN addgroup -g 1001 -S trm && adduser -u 1001 -S trm -G trm
COPY --from=builder --chown=trm:trm /app/dist ./dist
COPY --from=builder --chown=trm:trm /app/node_modules ./node_modules
COPY --from=builder --chown=trm:trm /app/package.json ./

USER trm
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/server.js"]
```

### Startup Discovery Logic

On application startup, TRM should:

1. **Scan the `/config/dynamic` directory** for all `.yaml` and `.yml` files
2. **Parse each YAML file** to extract router and service configurations
3. **Build metadata index** from parsed configurations
4. **Generate UUIDs** for rules that don't have metadata yet
5. **Write metadata/index.json** with discovered rules
6. **Expose via API** so frontend can display existing rules immediately

```javascript
// Pseudo-code for startup discovery
async function discoverExistingRules() {
  const dynamicConfigPath = process.env.TRAEFIK_DYNAMIC_CONFIG_PATH;
  const metadataPath = process.env.TRM_METADATA_PATH;
  
  // Read all YAML files in dynamic config directory
  const files = await fs.readdir(dynamicConfigPath);
  const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  
  const discoveredRules = [];
  
  for (const file of yamlFiles) {
    const filePath = path.join(dynamicConfigPath, file);
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = yaml.load(content);
    
    // Extract router and service info from parsed YAML
    const rule = extractRuleFromYAML(parsed, file);
    
    if (rule) {
      discoveredRules.push(rule);
    }
  }
  
  // Load existing metadata if it exists
  let existingMetadata = { rules: [] };
  try {
    const metadataFile = path.join(metadataPath, 'index.json');
    const content = await fs.readFile(metadataFile, 'utf8');
    existingMetadata = JSON.parse(content);
  } catch (err) {
    // No existing metadata, that's okay
  }
  
  // Merge discovered rules with existing metadata
  const mergedRules = mergeRulesWithMetadata(discoveredRules, existingMetadata.rules);
  
  // Write updated metadata
  await writeMetadata({ rules: mergedRules });
  
  console.log(`Discovered ${mergedRules.length} Traefik rules`);
  
  return mergedRules;
}

function extractRuleFromYAML(parsed, filename) {
  // Extract router and service configurations
  // This is a simplified example - real implementation needs to be robust
  
  if (!parsed.http?.routers || !parsed.http?.services) {
    return null;
  }
  
  const routerName = Object.keys(parsed.http.routers)[0];
  const router = parsed.http.routers[routerName];
  const service = parsed.http.services[routerName];
  
  if (!router || !service) {
    return null;
  }
  
  // Parse Host rule to extract hostname
  const hostMatch = router.rule?.match(/Host\(`([^`]+)`\)/);
  const hostname = hostMatch ? hostMatch[1] : '';
  
  // Extract backend URLs
  const backendUrl = service.loadBalancer?.servers?.map(s => s.url) || [];
  
  return {
    id: generateUUID(),
    name: routerName,
    hostname,
    backendUrl,
    entryPoints: router.entryPoints || [],
    tls: !!router.tls,
    yamlContent: yaml.dump(parsed),
    lastModified: await getFileModifiedTime(filename),
    middlewares: router.middlewares || [],
    priority: router.priority || 0,
    certResolver: router.tls?.certResolver || '',
    passHostHeader: service.loadBalancer?.passHostHeader,
    stickySession: !!service.loadBalancer?.sticky,
    healthCheckPath: service.loadBalancer?.healthCheck?.path || '',
    healthCheckInterval: service.loadBalancer?.healthCheck?.interval || '',
  };
}
```

### Volume Permissions

Important considerations for bind mounts:

1. **TRM needs read/write access** to the dynamic config directory
2. **Traefik needs read access** to the dynamic config directory
3. **File ownership** should allow both containers to access files
4. **Consider using a shared group** or appropriate umask

```bash
# Example: Set proper permissions on host
sudo chown -R 1001:1001 ./traefik/dynamic
sudo chown -R 1001:1001 ./trm/metadata
sudo chown -R 1001:1001 ./trm/backups
```

### Health Check Endpoint

TRM should expose a health check endpoint:

```javascript
app.get('/health', (req, res) => {
  // Check if filesystem is accessible
  const configPath = process.env.TRAEFIK_DYNAMIC_CONFIG_PATH;
  
  try {
    fs.accessSync(configPath, fs.constants.R_OK | fs.constants.W_OK);
    res.status(200).json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      configPath,
      rulesCount: getRulesCount()
    });
  } catch (err) {
    res.status(503).json({ 
      status: 'unhealthy',
      error: 'Cannot access config directory',
      timestamp: new Date().toISOString()
    });
  }
});
```

### User Experience Flow

1. **User has existing Traefik setup** with YAML files in `/path/to/traefik/dynamic/`
2. **User downloads docker-compose.yml** for TRM
3. **User updates volumes** in docker-compose.yml to point to their Traefik directory
4. **User runs** `docker-compose up -d`
5. **TRM starts and scans** the dynamic config directory
6. **TRM displays all existing rules** in the web UI immediately
7. **User can edit/create/delete rules** through the UI
8. **Changes are written** to the shared directory
9. **Traefik automatically detects** and applies changes

### Migration from Existing Setup

For users with existing Traefik configurations:

1. **No migration required**: TRM reads existing YAML files directly
2. **Backwards compatible**: Generated YAML is standard Traefik format
3. **Can revert**: Users can stop TRM and continue using Traefik standalone
4. **No lock-in**: All configs remain as plain YAML files

### Security Considerations for Docker

1. **Network isolation**: Use Docker networks to isolate TRM
2. **Read-only where possible**: Mount Traefik static config as read-only
3. **Secrets management**: Use Docker secrets for sensitive data
4. **Resource limits**: Set memory and CPU limits
5. **Regular updates**: Keep base images updated

```yaml
# Enhanced security example
services:
  trm:
    image: traefik-rules-manager:latest
    read_only: true
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    tmpfs:
      - /tmp
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

### Logging and Monitoring

TRM should provide comprehensive logging for Docker environments:

```javascript
// Structured logging example
const logger = {
  info: (msg, meta = {}) => {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message: msg,
      ...meta
    }));
  },
  error: (msg, error, meta = {}) => {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message: msg,
      error: error.message,
      stack: error.stack,
      ...meta
    }));
  }
};

// Log all rule operations
logger.info('Rule created', { ruleId, ruleName, hostname });
logger.info('Rule updated', { ruleId, ruleName, changes });
logger.info('Rule deleted', { ruleId, ruleName });
logger.error('Failed to write rule', error, { ruleId, ruleName });
```

### Environment Variables Reference

Complete list of environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `TRAEFIK_DYNAMIC_CONFIG_PATH` | `/config/dynamic` | Path to Traefik dynamic config directory (must be bind mounted) |
| `TRM_METADATA_PATH` | `/config/metadata` | Path to TRM metadata storage |
| `TRM_BACKUP_PATH` | `/config/backups` | Path to backup directory |
| `TRM_PORT` | `3001` | Port for TRM web server |
| `TRM_HOST` | `0.0.0.0` | Host binding for TRM web server |
| `TRM_LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `TRM_FILE_WATCH_DEBOUNCE` | `1000` | Debounce time for file watching (ms) |
| `TRM_MAX_BACKUP_FILES` | `10` | Maximum number of backup files to retain |

### Quick Start Guide for Users

```markdown
# Quick Start

1. Create a directory for your deployment:
   mkdir traefik-rules-manager && cd traefik-rules-manager

2. Download the docker-compose.yml file

3. Update the volume paths to point to your existing Traefik directory:
   volumes:
     - /your/path/to/traefik/dynamic:/config/dynamic

4. Start the services:
   docker-compose up -d

5. Access the TRM web interface:
   http://localhost:3001

6. Your existing Traefik rules will be automatically discovered and displayed!
```

## Future Enhancements (Post-MVP)

1. **Middleware Management**: Full CRUD for middleware definitions
2. **TCP/UDP Routers**: Support for non-HTTP protocols
3. **Bulk Operations**: Import/export multiple rules
4. **Template System**: Pre-configured rule templates
5. **Audit Log**: Track all configuration changes
6. **Role-Based Access**: User authentication and permissions
7. **Configuration Testing**: Test rules before applying
8. **Traefik Status Integration**: Show which rules are active in Traefik
9. **Certificate Management**: View and manage TLS certificates
10. **Load Balancer Algorithms**: Support for weighted, round-robin, etc.

## Development Guidelines

### Code Quality
- Use TypeScript for type safety
- Write unit tests for validation logic
- Write integration tests for API endpoints
- Use ESLint and Prettier for code formatting

### Security Considerations
- Validate all user input
- Sanitize file paths to prevent directory traversal
- Implement rate limiting on API endpoints
- Consider authentication/authorization for production
- Never expose Traefik's static configuration
- Validate YAML to prevent code injection

### Performance Considerations
- Cache metadata in memory (with file watching for invalidation)
- Use efficient YAML parsing libraries
- Implement pagination for large rule lists
- Consider debouncing for file system operations

### Testing Strategy
1. **Unit Tests**: Validation functions, YAML generation
2. **Integration Tests**: API endpoints, file operations
3. **End-to-End Tests**: Full workflow from UI to file system
4. **Schema Validation Tests**: Ensure generated YAML is Traefik-compliant

## Current State

### Implemented (Frontend)
- ✅ Dashboard with table view
- ✅ Add Reverse Proxy page (form + YAML modes)
- ✅ Edit Reverse Proxy page (form + YAML modes)
- ✅ Multiple backend support with load balancing
- ✅ Multiple entry points support
- ✅ TLS configuration
- ✅ Advanced settings (middlewares, priority, cert resolver, etc.)
- ✅ Form validation
- ✅ API-driven flows wired to backend (health, rules CRUD, middlewares, resync)

### Implemented (Backend)
- ✅ Express server with health endpoint
- ✅ REST API for rules CRUD, YAML fetch, validation, middleware listing, resync
- ✅ File system operations with atomic writes and backups
- ✅ YAML generation/parsing
- ✅ Metadata management (index.json)
- ✅ File watching + startup discovery of dynamic config directory
- ✅ Validation via AJV and rule name uniqueness checks

### Remaining / Next Steps

1. Add automated tests (unit for validation/YAML, integration for API + fs side effects)
2. Harden error handling and document backup pruning behavior (`TRM_MAX_BACKUP_FILES`)
3. Add authentication/rate limiting for production use
4. Wire Traefik integration tests with real config samples

## Resources

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Traefik File Provider](https://doc.traefik.io/traefik/providers/file/)
- [Traefik HTTP Routers](https://doc.traefik.io/traefik/routing/routers/)
- [Traefik Services](https://doc.traefik.io/traefik/routing/services/)
- [Traefik Middlewares](https://doc.traefik.io/traefik/middlewares/overview/)
- [js-yaml Documentation](https://github.com/nodeca/js-yaml)
- [chokidar Documentation](https://github.com/paulmillr/chokidar)

## Contact & Support

This document serves as the complete technical specification for implementing the backend of the Traefik Rules Manager. For questions or clarifications, refer to the Traefik documentation or consult with the frontend development team.

---

**Last Updated**: January 17, 2026  
**Version**: 1.0.0  
**Status**: MVP Specification
