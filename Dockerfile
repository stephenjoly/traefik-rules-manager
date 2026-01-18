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

RUN mkdir -p /config/dynamic /config/metadata /config/backups

EXPOSE 3001
CMD ["node", "server/index.js"]
