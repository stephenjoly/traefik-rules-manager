import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, removeAdditional: 'all', coerceTypes: true });
addFormats(ajv);

const ruleSchema = {
  type: 'object',
  required: ['name', 'hostname', 'backendUrl', 'entryPoints', 'tls'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string', pattern: '^[a-zA-Z0-9-_]+$' },
    hostname: { type: 'string', minLength: 1 },
    backendUrl: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', format: 'uri' }
    },
    entryPoints: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', minLength: 1 }
    },
    tls: { type: 'boolean' },
    middlewares: {
      type: 'array',
      items: { type: 'string', minLength: 1 }
    },
    yamlContent: { type: 'string' },
    validationErrors: { type: 'array', items: { type: 'string' } },
    lastModified: {},
    priority: { type: 'integer', minimum: 0 },
    certResolver: { type: 'string' },
    passHostHeader: { type: 'boolean' },
    stickySession: { type: 'boolean' },
    healthCheckPath: { type: 'string' },
    healthCheckInterval: { type: 'string' },
    entrypoints: { type: 'array' } // tolerance for typo
  }
};

export const validateRule = ajv.compile(ruleSchema);

export function normalizeRule(input) {
  const rule = { ...input };
  if (rule.entrypoints && !rule.entryPoints) {
    rule.entryPoints = rule.entrypoints;
    delete rule.entrypoints;
  }
  return rule;
}
