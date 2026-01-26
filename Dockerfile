FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY context.md README.md ./ 

ENV NODE_ENV=production
ENV TRAEFIK_DYNAMIC_CONFIG_PATH=/config/dynamic
ENV TRM_METADATA_PATH=/config/metadata
ENV TRM_BACKUP_PATH=/config/backups
ENV TRM_PORT=3001
ENV TRM_HOST=0.0.0.0

RUN mkdir -p /config/dynamic /config/metadata /config/backups && \
    addgroup -g 1000 -S trm && \
    adduser -u 1000 -S trm -G trm && \
    chown -R trm:trm /app /config

USER trm

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "server/index.js"]
