import path from 'node:path';
import { promises as fs } from 'node:fs';
import { listYamlFiles, statSafe } from './fs-helpers.js';
import { parseTraefikYaml } from './yaml.js';

function extractRuleFromYaml(parsed, filePath, idResolver) {
  if (!parsed?.http?.routers || !parsed?.http?.services) return null;
  const routerName = Object.keys(parsed.http.routers)[0];
  if (!routerName) return null;
  const router = parsed.http.routers[routerName];
  const service = parsed.http.services[routerName];
  if (!router || !service || !router.rule) return null;

  const hostMatch = router.rule.match(/Host\\(`([^`]+)`\\)/);
  const hostname = hostMatch ? hostMatch[1] : '';
  const backendUrl = service.loadBalancer?.servers?.map(server => server.url).filter(Boolean) || [];

  return {
    id: idResolver(routerName, filePath),
    name: routerName,
    hostname,
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
    fileName: path.basename(filePath)
  };
}

export async function discoverRules(dynamicPath, idResolver) {
  const files = await listYamlFiles(dynamicPath);
  const results = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const parsed = parseTraefikYaml(content);
      const rule = extractRuleFromYaml(parsed, file, idResolver);
      if (rule) {
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
