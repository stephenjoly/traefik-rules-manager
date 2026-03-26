
# Traefik Rules Manager

Manage Traefik dynamic configuration (.yml/.yaml) with a friendly UI and a small API that watches your config directory, validates rules, and writes changes back to disk.

## Local development

```bash
npm install
# start UI
VITE_API_BASE=http://localhost:3001 npm run dev
# start API
TRAEFIK_DYNAMIC_CONFIG_PATH=./testing/vm-critical/dynamic npm run server
```

Use the sample metadata and backup directories as well if you want the full local test setup:

```bash
TRAEFIK_DYNAMIC_CONFIG_PATH=./testing/vm-critical/dynamic \
TRM_METADATA_PATH=./testing/vm-critical/metadata \
TRM_BACKUP_PATH=./testing/vm-critical/backups \
npm run server
```

Key environment variables:

- `TRAEFIK_DYNAMIC_CONFIG_PATH` (default `/config/dynamic`) – directory with your Traefik dynamic config files. **Must be set before starting** - cannot be changed at runtime.
- `TRM_METADATA_PATH` (default `/config/metadata`) – where the app stores metadata.
- `TRM_BACKUP_PATH` (default `/config/backups`) – backup location for prior versions.
- `TRM_PORT` (default `3001`), `TRM_HOST` (default `0.0.0.0`).
- `TRM_MAX_BACKUP_FILES` (default `10`) – maximum number of backups to keep per rule.
- `TRM_FILE_WATCH_DEBOUNCE` (default `2000`) – milliseconds to wait before resyncing after file changes.
- `TRM_ADMIN_USERNAME`, `TRM_ADMIN_PASSWORD` – bootstrap admin credentials for the built-in login.
- `TRM_SESSION_SECRET` – signing secret for the admin session cookie.
- `TRM_AUTH_ENABLED` – optional explicit auth toggle. Defaults to `true` when bootstrap credentials are present.
- `TRM_SESSION_TTL_HOURS` (default `12`) – admin session lifetime.
- `TRM_COOKIE_SECURE` (default `false`) – set to `true` when serving TRM over HTTPS directly.
- Frontend → backend target: `VITE_API_BASE` (default `http://localhost:3001`).

Admin login credentials are not stored in the repo. The backend only enables admin auth when you provide `TRM_ADMIN_USERNAME`, `TRM_ADMIN_PASSWORD`, and `TRM_SESSION_SECRET`. If those are unset, the UI runs without login.

Tests:

```bash
npm test
```

Interactive docs:

- Swagger UI: `http://localhost:3001/api-docs`
- Raw OpenAPI JSON: `http://localhost:3001/api-docs/openapi.json`

## Bundled Docker Stack

The repository's Docker assets now live under `docker/`.

To run the bundled sample stack against `testing/vm-critical`:

```bash
docker compose -f docker/docker-compose.yml up --build
```

If you want admin login enabled for that stack, export these before starting Compose:

```bash
export TRM_ADMIN_USERNAME=admin
export TRM_ADMIN_PASSWORD=change-me
export TRM_SESSION_SECRET=$(openssl rand -hex 32)
docker compose -f docker/docker-compose.yml up --build
```

## Containers (GHCR)

This repo builds and publishes two images to GHCR (via GitHub Actions on `main` and tags):

- `ghcr.io/stephenjoly/traefik-rules-manager-backend:latest` – API, port `3001`.
- `ghcr.io/stephenjoly/traefik-rules-manager-frontend:latest` – UI, port `4173`, expects `VITE_API_BASE`.

To pull:

```bash
docker pull ghcr.io/stephenjoly/traefik-rules-manager-backend:latest
docker pull ghcr.io/stephenjoly/traefik-rules-manager-frontend:latest
```

## Quick deploy with Docker Compose

Create `docker-compose.yml` alongside your Traefik setup:

```yaml
services:
  trm-backend:
    image: ghcr.io/stephenjoly/traefik-rules-manager-backend:latest
    environment:
      TRAEFIK_DYNAMIC_CONFIG_PATH: /config/dynamic
      TRM_METADATA_PATH: /config/metadata
      TRM_BACKUP_PATH: /config/backups
      TRM_PORT: 3001
      TRM_HOST: 0.0.0.0
    volumes:
      - /path/to/traefik/dynamic:/config/dynamic
      - /path/to/trm/metadata:/config/metadata
      - /path/to/trm/backups:/config/backups
    ports:
      - "3001:3001"
    restart: unless-stopped

  trm-frontend:
    image: ghcr.io/stephenjoly/traefik-rules-manager-frontend:latest
    environment:
      VITE_API_BASE: http://trm-backend:3001
    depends_on:
      - trm-backend
    ports:
      - "4173:4173"
    restart: unless-stopped
```

Then run:

```bash
docker compose up -d
```

Browse the UI at `http://localhost:4173`, select your Traefik dynamic config directory (or rely on the backend defaults), and manage rules. The backend processes `.yml`/`.yaml` files in a flat directory (no subfolders).

## Security Considerations

TRM now supports built-in admin authentication and one-time automation API keys.

Recommended production setup:

1. Set `TRM_ADMIN_USERNAME`, `TRM_ADMIN_PASSWORD`, and `TRM_SESSION_SECRET`
2. Keep the backend on a trusted network or behind your reverse proxy
3. Set `TRM_COOKIE_SECURE=true` if TRM is served directly over HTTPS
4. Restrict which systems can reach the automation API
5. Rotate or revoke API keys when automation no longer needs them

The admin UI uses an `HttpOnly` session cookie. Automation clients should use `Authorization: Bearer <api-key>` against the dedicated automation endpoints under `/api/automation`.

For production deployments:

1. **Restrict network access** via firewall rules or Docker networks
2. **Use volume permissions** to ensure the container can read/write config files:
   ```bash
   # Container runs as UID 1000 (typical first Linux user)
   # If your volumes are already owned by your user (uid 1000), no action needed
   # Otherwise, set proper ownership:
   sudo chown -R 1000:1000 /path/to/traefik/dynamic
   sudo chown -R 1000:1000 /path/to/trm/metadata
   sudo chown -R 1000:1000 /path/to/trm/backups
   ```
3. **Monitor the application** using the `/health` and `/ready` endpoints
4. **Backup your configs** regularly - TRM creates backups but they're stored locally

### Admin and Automation APIs

- `POST /api/auth/login` – create admin session
- `POST /api/auth/logout` – clear admin session
- `GET /api/auth/session` – inspect current admin session
- `GET /api/admin/api-keys` – list API keys without secrets
- `POST /api/admin/api-keys` – create a new API key and return the plaintext once
- `POST /api/admin/api-keys/:id/revoke` – revoke a key
- `POST /api/automation/rules` – create a rule with bearer auth
- `GET /api/automation/rules` – list rules with bearer auth
- `GET /api/automation/rules/:id` – fetch a rule with bearer auth
- `PUT /api/automation/rules/:id` – update a rule with bearer auth
- `DELETE /api/automation/rules/:id` – delete a rule with bearer auth

### Interactive API Docs

TRM serves Swagger UI directly from the backend:

- `GET /api-docs` – interactive docs with Try It Out support
- `GET /api-docs/openapi.json` – raw OpenAPI document

How to use the docs:

1. Open `/api-docs`
2. Call `POST /api/auth/login` first if you want to exercise admin/session-based endpoints
3. Use the bearer auth control for `/api/automation/*` routes after creating an API key

### Health & Readiness Checks

- **`GET /health`** - Liveness check (filesystem accessible)
- **`GET /ready`** - Readiness check (initial discovery completed)

## Publishing to your own GitHub repo

1. Create a new GitHub repo and push this code.
2. GitHub Actions (`.github/workflows/docker-publish.yml`) will build and push images to GHCR using the repo’s `GITHUB_TOKEN` whenever you push to `main` or tag `v*.*.*`.
3. Pull and run the images as shown above on any machine that can reach your Traefik config directory.
  
