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
