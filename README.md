
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
  
