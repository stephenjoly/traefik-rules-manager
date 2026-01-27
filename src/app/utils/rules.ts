import { RulePayload, TraefikRule } from '../types';
import yaml from 'js-yaml';

function extractHostname(ruleStr: string) {
  const match =
    ruleStr?.match(/Host\(`?([^`]+)`?\)/) ||
    ruleStr?.match(/Host\("([^"]+)"\)/) ||
    ruleStr?.match(/Host\('([^']+)'\)/);
  return match ? match[1] : '';
}

export function normalizeRuleFromYaml(rule: TraefikRule): RulePayload {
  try {
    if (!rule.yamlContent) {
      throw new Error('no yaml');
    }
    const baseName = rule.fileName ? rule.fileName.replace(/\.ya?ml$/i, '') : rule.name;
    const parsed = yaml.load(rule.yamlContent) as any;
    const routerName = Object.keys(parsed?.http?.routers || {})[0] || rule.name;
    const router = parsed?.http?.routers?.[routerName];
    const serviceName = router?.service || routerName;
    const lb = parsed?.http?.services?.[serviceName]?.loadBalancer || {};
    const middlewares = router?.middlewares || [];
    const tlsOptions = router?.tls?.options;
    const serversTransportName = lb.serversTransport;
    const insecureSkipVerify = serversTransportName
      ? Boolean(parsed?.http?.serversTransports?.[serversTransportName]?.insecureSkipVerify)
      : false;

    return {
      name: baseName,
      routerName,
      serviceName,
      hostname: router?.rule ? extractHostname(router.rule) : rule.hostname,
      backendUrl: lb.servers?.map((s: any) => s.url).filter(Boolean) || rule.backendUrl || [],
      entryPoints: router?.entryPoints || rule.entryPoints || [],
      tls: !!router?.tls,
      middlewares: middlewares.length ? middlewares : rule.middlewares,
      priority: router?.priority ?? rule.priority,
      certResolver: router?.tls?.certResolver ?? rule.certResolver,
      tlsOptions: tlsOptions ?? rule.tlsOptions,
      passHostHeader: lb.passHostHeader ?? rule.passHostHeader,
      stickySession: Boolean(lb.sticky ?? rule.stickySession),
      healthCheckPath: lb.healthCheck?.path ?? rule.healthCheckPath,
      healthCheckInterval: lb.healthCheck?.interval ?? rule.healthCheckInterval,
      serversTransport: lb.serversTransport ?? rule.serversTransport,
      serversTransportInsecureSkipVerify: insecureSkipVerify ?? rule.serversTransportInsecureSkipVerify,
    };
  } catch {
    return {
      name: rule.fileName ? rule.fileName.replace(/\.ya?ml$/i, '') : rule.name,
      routerName: rule.routerName || rule.name,
      serviceName: rule.serviceName || rule.name,
      hostname: rule.hostname,
      backendUrl: rule.backendUrl || [],
      entryPoints: rule.entryPoints || [],
      tls: rule.tls,
      middlewares: rule.middlewares,
      priority: rule.priority,
      certResolver: rule.certResolver,
      tlsOptions: rule.tlsOptions,
      passHostHeader: rule.passHostHeader,
      stickySession: rule.stickySession,
      healthCheckPath: rule.healthCheckPath,
      healthCheckInterval: rule.healthCheckInterval,
      serversTransport: rule.serversTransport,
      serversTransportInsecureSkipVerify: rule.serversTransportInsecureSkipVerify
    };
  }
}

function uniqueName(base: string, taken: Set<string>): string {
  let candidate = base;
  while (taken.has(candidate)) {
    candidate = `${candidate}-copy`;
  }
  return candidate;
}

export function duplicateRule(rule: TraefikRule, existing: TraefikRule[] = []): RulePayload {
  const taken = new Set(existing.map((r) => (r.fileName ? r.fileName.replace(/\.ya?ml$/i, '') : r.name)));
  return ruleToPayload(rule, { copyName: true, taken });
}

export function ruleToPayload(
  rule: TraefikRule,
  opts: { copyName?: boolean; taken?: Set<string> } = {}
): RulePayload {
  // Prefer filename base if present
  const baseName = rule.fileName ? rule.fileName.replace(/\.ya?ml$/i, '') : rule.name;
  const payload = normalizeRuleFromYaml(rule);
  const rawName = opts.copyName ? `${baseName}-copy` : baseName;
  const name = opts.taken ? uniqueName(rawName, opts.taken) : rawName;
  return {
    ...payload,
    name,
    serviceName: payload.serviceName || baseName
  };
}
