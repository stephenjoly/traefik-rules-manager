import path from 'node:path';

const root = process.cwd();

export const config = {
  host: process.env.TRM_HOST || '0.0.0.0',
  port: Number(process.env.TRM_PORT || 3001),
  dynamicPath: process.env.TRAEFIK_DYNAMIC_CONFIG_PATH || path.resolve(root, 'config/dynamic'),
  metadataPath: process.env.TRM_METADATA_PATH || path.resolve(root, 'config/metadata'),
  backupsPath: process.env.TRM_BACKUP_PATH || path.resolve(root, 'config/backups'),
  maxBackups: Number(process.env.TRM_MAX_BACKUP_FILES || 10),
  logLevel: process.env.TRM_LOG_LEVEL || 'info'
};
