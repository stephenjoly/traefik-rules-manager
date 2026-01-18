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
    const parsed = yaml.load(rule.yamlContent) as any;
    const routerName = Object.keys(parsed?.http?.routers || {})[0] || rule.name;
    const router = parsed?.http?.routers?.[routerName];
    const serviceName = router?.service || routerName;
    const lb = parsed?.http?.services?.[serviceName]?.loadBalancer || {};
    const middlewares = router?.middlewares || [];

    return {
      name: routerName,
      serviceName,
      hostname: router?.rule ? extractHostname(router.rule) : rule.hostname,
      backendUrl: lb.servers?.map((s: any) => s.url).filter(Boolean) || rule.backendUrl || [],
      entryPoints: router?.entryPoints || rule.entryPoints || [],
      tls: !!router?.tls ?? rule.tls,
      middlewares: middlewares.length ? middlewares : rule.middlewares,
      priority: router?.priority ?? rule.priority,
      certResolver: router?.tls?.certResolver ?? rule.certResolver,
      passHostHeader: lb.passHostHeader ?? rule.passHostHeader,
      stickySession: Boolean(lb.sticky ?? rule.stickySession),
      healthCheckPath: lb.healthCheck?.path ?? rule.healthCheckPath,
      healthCheckInterval: lb.healthCheck?.interval ?? rule.healthCheckInterval,
      serversTransport: lb.serversTransport ?? rule.serversTransport,
    };
  } catch {
    return {
      name: rule.name,
      serviceName: rule.serviceName || rule.name,
      hostname: rule.hostname,
      backendUrl: rule.backendUrl || [],
      entryPoints: rule.entryPoints || [],
      tls: rule.tls,
      middlewares: rule.middlewares,
      priority: rule.priority,
      certResolver: rule.certResolver,
      passHostHeader: rule.passHostHeader,
      stickySession: rule.stickySession,
      healthCheckPath: rule.healthCheckPath,
      healthCheckInterval: rule.healthCheckInterval,
      serversTransport: rule.serversTransport
    };
  }
}

export function duplicateRule(rule: TraefikRule): RulePayload {
  return ruleToPayload(rule, { copyName: true });
}

export function ruleToPayload(rule: TraefikRule, opts: { copyName?: boolean } = {}): RulePayload {
  const baseName = rule.fileName ? rule.fileName.replace(/\.ya?ml$/i, '') : rule.name;
  const payload = normalizeRuleFromYaml(rule);
  const name = opts.copyName ? `${baseName}-copy` : baseName;
  return {
    ...payload,
    name,
    serviceName: payload.serviceName || baseName
  };
}
