import { describe, it, expect } from 'vitest';
import { validateRule, normalizeRule } from '../validation.js';
import { generateTraefikYaml, parseTraefikYaml } from '../yaml.js';

const baseRule = {
  name: 'api',
  hostname: 'api.example.com',
  backendUrl: ['http://127.0.0.1:8080'],
  entryPoints: ['web'],
  tls: true
};

describe('validation and YAML generation', () => {
  it('accepts a valid rule', () => {
    const rule = normalizeRule(baseRule);
    const ok = validateRule(rule);
    expect(ok).toBe(true);
  });

  it('rejects invalid rule names', () => {
    const bad = normalizeRule({ ...baseRule, name: 'bad name with space' });
    const ok = validateRule(bad);
    expect(ok).toBe(false);
  });

  it('builds Traefik-compliant YAML', () => {
    const yaml = generateTraefikYaml(baseRule);
    const parsed = parseTraefikYaml(yaml);
    const router = parsed.http.routers.api;
    const service = parsed.http.services.api;

    expect(router.rule).toBe('Host(`api.example.com`)');
    expect(router.entryPoints).toEqual(['web']);
    expect(router.tls).toBeTruthy();
    expect(service.loadBalancer.servers[0].url).toBe('http://127.0.0.1:8080');
  });
});
