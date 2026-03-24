import path from 'node:path';

const root = process.cwd();
const authEnabledFromEnv = process.env.TRM_AUTH_ENABLED;
const hasBootstrapCreds = Boolean(process.env.TRM_ADMIN_USERNAME && process.env.TRM_ADMIN_PASSWORD);

export const config = {
  host: process.env.TRM_HOST || '0.0.0.0',
  port: Number(process.env.TRM_PORT || 3001),
  dynamicPath: process.env.TRAEFIK_DYNAMIC_CONFIG_PATH || path.resolve(root, 'config/dynamic'),
  metadataPath: process.env.TRM_METADATA_PATH || path.resolve(root, 'config/metadata'),
  backupsPath: process.env.TRM_BACKUP_PATH || path.resolve(root, 'config/backups'),
  maxBackups: Number(process.env.TRM_MAX_BACKUP_FILES || 10),
  logLevel: process.env.TRM_LOG_LEVEL || 'info',
  authEnabled: authEnabledFromEnv
    ? authEnabledFromEnv === 'true'
    : hasBootstrapCreds,
  adminUsername: process.env.TRM_ADMIN_USERNAME || '',
  adminPassword: process.env.TRM_ADMIN_PASSWORD || '',
  sessionSecret: process.env.TRM_SESSION_SECRET || '',
  sessionTtlHours: Number(process.env.TRM_SESSION_TTL_HOURS || 12),
  cookieSecure: process.env.TRM_COOKIE_SECURE === 'true'
};
