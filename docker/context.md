# Docker Directory Context

This directory contains the repository-managed container assets:

- `Dockerfile` for the backend image
- `Dockerfile.frontend` for the frontend image
- `docker-compose.yml` for the bundled local stack
- `traefik-config-examples/` for example reverse-proxy resources

The Compose file is stored here for organization, so its bind mounts and build paths intentionally use `..`-relative paths back to the repository root.
