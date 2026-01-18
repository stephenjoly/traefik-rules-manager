import path from 'node:path';
import { promises as fs } from 'node:fs';
import { listYamlFiles, statSafe } from './fs-helpers.js';
import { parseTraefikYaml } from './yaml.js';

function extractHost(ruleStr) {
  if (!ruleStr) return '';
  const hostMatch = String(ruleStr).match(/Host\(([^)]+)\)/);
  if (!hostMatch) return '';
  const raw = hostMatch[1].trim();
  return raw.replace(/^['"`]+|['"`]+$/g, '');
}

function extractRulesFromYaml(parsed, filePath, idResolver) {
  if (!parsed?.http?.routers) return [];
  const rules = [];

  for (const [routerName, router] of Object.entries(parsed.http.routers)) {
    const serviceName = router.service || routerName;
    const service = parsed.http.services?.[serviceName];
    if (!router || !service || !router.rule) continue;

    const backendUrl = service.loadBalancer?.servers?.map(server => server.url).filter(Boolean) || [];
    rules.push({
      id: idResolver(routerName, filePath),
      name: routerName,
      serviceName,
      hostname: extractHost(router.rule),
      backendUrl,
      entryPoints: router.entryPoints || [],
      tls: Boolean(router.tls),
      middlewares: router.middlewares || [],
      yamlContent: null,
      validationErrors: [],
      isValid: true,
      lastModified: null,
      priority: router.priority,
      certResolver: router.tls?.certResolver,
      passHostHeader: service.loadBalancer?.passHostHeader,
      stickySession: Boolean(service.loadBalancer?.sticky),
      healthCheckPath: service.loadBalancer?.healthCheck?.path,
      healthCheckInterval: service.loadBalancer?.healthCheck?.interval,
      serversTransport: service.loadBalancer?.serversTransport,
      fileName: path.basename(filePath)
    });
  }

  return rules;
}

export async function discoverRules(dynamicPath, idResolver) {
  const files = await listYamlFiles(dynamicPath);
  const results = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const parsed = parseTraefikYaml(content);
      const rulesFromFile = extractRulesFromYaml(parsed, file, idResolver);
      for (const rule of rulesFromFile) {
        const stats = await statSafe(file);
        if (stats) rule.lastModified = stats.mtime.toISOString();
        rule.yamlContent = content;
        results.push(rule);
      }
    } catch (err) {
      // ignore invalid YAML; errors handled elsewhere
      console.error(`Failed to parse ${file}:`, err.message);
    }
  }

  return results;
}
