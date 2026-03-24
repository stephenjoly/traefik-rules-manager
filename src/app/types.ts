export type TraefikRule = {
  id: string;
  fileName: string;
  name: string; // filename base
  routerName?: string;
  serviceName?: string;
  hostname: string;
  backendUrl: string[];
  entryPoints: string[];
  tls: boolean;
  middlewares?: string[];
  yamlContent: string;
  isValid: boolean;
  validationErrors?: string[];
  lastModified: Date;
  priority?: number;
  certResolver?: string;
  tlsOptions?: string;
  passHostHeader?: boolean;
  stickySession?: boolean;
  healthCheckPath?: string;
  healthCheckInterval?: string;
  serversTransport?: string;
  serversTransportInsecureSkipVerify?: boolean;
  previousName?: string;
};

export type RulePayload = {
  name: string;
  previousName?: string;
  routerName?: string;
  serviceName?: string;
  hostname: string;
  backendUrl: string[];
  entryPoints: string[];
  tls: boolean;
  middlewares?: string[];
  priority?: number;
  certResolver?: string;
  tlsOptions?: string;
  passHostHeader?: boolean;
  stickySession?: boolean;
  healthCheckPath?: string;
  healthCheckInterval?: string;
  serversTransport?: string;
  serversTransportInsecureSkipVerify?: boolean;
};

export type AuthSession = {
  authEnabled: boolean;
  authenticated: boolean;
  username?: string;
};

export type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  createdBy: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedBy?: string | null;
  expiresAt: string | null;
};

export type CreateApiKeyPayload = {
  name: string;
  expiresAt?: string;
};

export type CreatedApiKeyResponse = {
  apiKey: string;
  record: ApiKeyRecord;
};
