
  # Mockup Traefik Rules Manager

  This is a code bundle for Mockup Traefik Rules Manager. The original project is available at https://www.figma.com/design/pRkiz7pOyDVJYcgo0xcy0b/Mockup-Traefik-Rules-Manager.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the frontend (Vite).

  Run `npm run server` to start the backend API (Express). Configure paths with:

  - `TRAEFIK_DYNAMIC_CONFIG_PATH` (default: `./config/dynamic`)
  - `TRM_METADATA_PATH` (default: `./config/metadata`)
  - `TRM_BACKUP_PATH` (default: `./config/backups`)
  - `TRM_PORT` (default: `3001`)
  - `TRM_MAX_BACKUP_FILES` (default: `10`)

  Frontend API target: set `VITE_API_BASE` (default: `http://localhost:3001`) to point the UI at your running backend.

  ## Docker

  Build and run backend + frontend:

  ```
  docker compose up --build
  ```

  - Backend runs on `3001`, frontend on `4173` (talking to backend).
  - Update volumes in `docker-compose.yml` to point to your Traefik dynamic config (`/config/dynamic`) and metadata/backups.
  - If you see npm/node_modules issues in the frontend container, rerun with `docker compose down && docker compose up --build` (frontend service wipes its node_modules on start).

  ## Tests / Smoke

  Run backend unit/integration tests (includes CRUD + YAML validation):

  ```
  npm test
  ```
  
