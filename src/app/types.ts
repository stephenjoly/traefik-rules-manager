export type TraefikRule = {
  id: string;
  fileName: string;
  name: string;
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
  passHostHeader?: boolean;
  stickySession?: boolean;
  healthCheckPath?: string;
  healthCheckInterval?: string;
  serversTransport?: string;
};

export type RulePayload = {
  name: string;
  hostname: string;
  backendUrl: string[];
  entryPoints: string[];
  tls: boolean;
  middlewares?: string[];
  priority?: number;
  certResolver?: string;
  passHostHeader?: boolean;
  stickySession?: boolean;
  healthCheckPath?: string;
  healthCheckInterval?: string;
  serversTransport?: string;
};
