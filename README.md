
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

- `TRAEFIK_DYNAMIC_CONFIG_PATH` (default `/config/dynamic`) – directory with your Traefik dynamic config files.
- `TRM_METADATA_PATH` (default `/config/metadata`) – where the app stores metadata.
- `TRM_BACKUP_PATH` (default `/config/backups`) – backup location for prior versions.
- `TRM_PORT` (default `3001`), `TRM_HOST` (default `0.0.0.0`).
- `TRM_MAX_BACKUP_FILES` (default `10`).
- Frontend → backend target: `VITE_API_BASE` (default `http://localhost:3001`).

Tests:

```bash
npm test
```

## Containers (GHCR)

This repo builds and publishes two images to GHCR (via GitHub Actions on `main` and tags):

- `ghcr.io/<owner>/<repo>-backend:latest` – API, port `3001`.
- `ghcr.io/<owner>/<repo>-frontend:latest` – UI, port `4173`, expects `VITE_API_BASE`.

To pull:

```bash
docker pull ghcr.io/<owner>/<repo>-backend:latest
docker pull ghcr.io/<owner>/<repo>-frontend:latest
```

## Quick deploy with Docker Compose

Create `docker-compose.yml` alongside your Traefik setup:

```yaml
services:
  trm-backend:
    image: ghcr.io/<owner>/<repo>-backend:latest
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
    image: ghcr.io/<owner>/<repo>-frontend:latest
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

## Publishing to your own GitHub repo

1. Create a new GitHub repo and push this code.
2. GitHub Actions (`.github/workflows/docker-publish.yml`) will build and push images to GHCR using the repo’s `GITHUB_TOKEN` whenever you push to `main` or tag `v*.*.*`.
3. Pull and run the images as shown above on any machine that can reach your Traefik config directory.
  
