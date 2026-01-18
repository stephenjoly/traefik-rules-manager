import yaml from 'js-yaml';

function buildLoadBalancer(rule) {
  const loadBalancer = {
    servers: rule.backendUrl.map(url => ({ url }))
  };

  if (rule.serversTransport) {
    loadBalancer.serversTransport = rule.serversTransport;
  }

  if (rule.passHostHeader !== undefined) {
    loadBalancer.passHostHeader = rule.passHostHeader;
  }

  if (rule.stickySession) {
    loadBalancer.sticky = { cookie: { name: 'sticky' } };
  }

  if (rule.healthCheckPath) {
    loadBalancer.healthCheck = {
      path: rule.healthCheckPath
    };
    if (rule.healthCheckInterval) {
      loadBalancer.healthCheck.interval = rule.healthCheckInterval;
    }
  }

  return loadBalancer;
}

export function generateTraefikYaml(rule) {
  const serviceName = rule.serviceName || rule.name;
  const routerName = rule.routerName || rule.name;
  const config = {
    http: {
      routers: {
        [routerName]: {
          rule: `Host(\`${rule.hostname}\`)`,
          service: serviceName,
          entryPoints: rule.entryPoints,
          ...(rule.middlewares?.length ? { middlewares: rule.middlewares } : {}),
          ...(rule.priority ? { priority: rule.priority } : {}),
          ...(rule.tls
            ? {
                tls: {
                  ...(rule.certResolver ? { certResolver: rule.certResolver } : {})
                }
              }
            : {})
        }
      },
      services: {
        [serviceName]: {
          loadBalancer: buildLoadBalancer(rule)
        }
      }
    }
  };

  return yaml.dump(config, { indent: 2 });
}

export function parseTraefikYaml(content) {
  return yaml.load(content);
}
