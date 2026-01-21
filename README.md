
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

Key environment variables:

- `TRAEFIK_DYNAMIC_CONFIG_PATH` (default `/config/dynamic`) – directory with your Traefik dynamic config files. **Must be set before starting** - cannot be changed at runtime.
- `TRM_METADATA_PATH` (default `/config/metadata`) – where the app stores metadata.
- `TRM_BACKUP_PATH` (default `/config/backups`) – backup location for prior versions.
- `TRM_PORT` (default `3001`), `TRM_HOST` (default `0.0.0.0`).
- `TRM_MAX_BACKUP_FILES` (default `10`) – maximum number of backups to keep per rule.
- `TRM_FILE_WATCH_DEBOUNCE` (default `2000`) – milliseconds to wait before resyncing after file changes.
- Frontend → backend target: `VITE_API_BASE` (default `http://localhost:3001`).

Tests:

```bash
npm test
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

**Important**: This application has **no built-in authentication or authorization**. Anyone who can access port 3001 can modify your Traefik configuration.

For production deployments:

1. **Run behind a reverse proxy with authentication** (e.g., Traefik with BasicAuth middleware, Authelia, Authentik)
2. **Restrict network access** via firewall rules or Docker networks
3. **Use volume permissions** to ensure the container can read/write config files:
   ```bash
   # Set proper ownership for volumes
   sudo chown -R 1001:1001 /path/to/traefik/dynamic
   sudo chown -R 1001:1001 /path/to/trm/metadata
   sudo chown -R 1001:1001 /path/to/trm/backups
   ```
4. **Monitor the application** using the `/health` and `/ready` endpoints
5. **Backup your configs** regularly - TRM creates backups but they're stored locally

### Health & Readiness Checks

- **`GET /health`** - Liveness check (filesystem accessible)
- **`GET /ready`** - Readiness check (initial discovery completed)

## Publishing to your own GitHub repo

1. Create a new GitHub repo and push this code.
2. GitHub Actions (`.github/workflows/docker-publish.yml`) will build and push images to GHCR using the repo’s `GITHUB_TOKEN` whenever you push to `main` or tag `v*.*.*`.
3. Pull and run the images as shown above on any machine that can reach your Traefik config directory.
  
