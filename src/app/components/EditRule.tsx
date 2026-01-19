import { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, Code2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import type { RulePayload, TraefikRule } from '../types';
import Editor from '@monaco-editor/react';
import SimpleEdit from './SimpleEdit';
import * as yaml from 'js-yaml';
import { normalizeRuleFromYaml } from '../utils/rules';

type EditRuleProps = {
  rule: TraefikRule;
  onSave: (payload: RulePayload) => Promise<void>;
  onCancel: () => void;
  existingMiddlewares: string[];
  onDuplicate: () => void;
};

export default function EditRule({
  rule,
  onSave,
  onCancel,
  existingMiddlewares,
  onDuplicate,
}: EditRuleProps) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [yamlContent, setYamlContent] = useState(rule.yamlContent);
  const [yamlError, setYamlError] = useState('');
  const [draft, setDraft] = useState<RulePayload | null>(normalizeRuleFromYaml(rule));
  const [yamlFilename, setYamlFilename] = useState<string>(rule.name);

  const handleSimpleSave = async (payload: RulePayload) => {
    await onSave({ ...payload, previousName: rule.name });
  };

  const handleAdvancedSave = async () => {
    try {
      // Validate YAML
      const parsed = yaml.load(yamlContent);
      setYamlError('');

      const config = parsed as any;
      // filename comes from user input, then meta hint, then draft/current
      const fileNameFromYaml = (yamlFilename || '').trim() || config?.meta?.name || draft?.name || rule.name;
      const routerName = Object.keys(config?.http?.routers || {})[0] || rule.routerName || rule.name;
      const router = config?.http?.routers?.[routerName];
      const serviceName = router?.service || routerName;
      const loadBalancer = config?.http?.services?.[serviceName]?.loadBalancer || {};
      const serversTransportName = loadBalancer?.serversTransport;
      const serversTransportConfig = serversTransportName
        ? config?.http?.serversTransports?.[serversTransportName]
        : undefined;
      const backendServers = loadBalancer?.servers?.map((s: any) => s.url).filter(Boolean) || [];
      const tlsEnabled = !!router?.tls;
      const payload: RulePayload = {
        name: fileNameFromYaml,
        previousName: rule.name,
        routerName,
        serviceName,
        hostname: router?.rule ? extractHostname(router.rule) : rule.hostname,
        backendUrl: backendServers.length ? backendServers : rule.backendUrl,
        entryPoints: router?.entryPoints || rule.entryPoints,
        tls: tlsEnabled,
        middlewares: router?.middlewares,
        priority: router?.priority,
        certResolver: router?.tls?.certResolver,
        tlsOptions: router?.tls?.options,
        passHostHeader: loadBalancer?.passHostHeader,
        stickySession: Boolean(loadBalancer?.sticky),
        healthCheckPath: loadBalancer?.healthCheck?.path,
        healthCheckInterval: loadBalancer?.healthCheck?.interval,
        serversTransport: serversTransportName,
        serversTransportInsecureSkipVerify: Boolean(serversTransportConfig?.insecureSkipVerify),
      };

      await onSave(payload);
    } catch (error) {
      setYamlError(error instanceof Error ? error.message : 'Invalid YAML');
    }
  };

  const syncYamlFromDraft = () => {
    const source = draft || normalizeRuleFromYaml(rule);
    setYamlContent(buildYamlFromPayload(source));
  };

  const syncDraftFromYaml = () => {
    try {
      const parsed = yaml.load(yamlContent || '') as any;
      const fileNameFromYaml = (yamlFilename || '').trim() || parsed?.meta?.name || draft?.name || rule.name;
      const routerName = Object.keys(parsed?.http?.routers || {})[0] || draft?.routerName || rule.routerName || rule.name;
      const router = parsed?.http?.routers?.[routerName];
      const serviceName = router?.service || routerName;
      const lb = parsed?.http?.services?.[serviceName]?.loadBalancer || {};
      const serversTransportName = lb.serversTransport;
      const serversTransportConfig = serversTransportName
        ? parsed?.http?.serversTransports?.[serversTransportName]
        : undefined;
      const middlewares = router?.middlewares || [];
      const payload: RulePayload = {
        name: fileNameFromYaml,
        previousName: rule.name,
        routerName,
        serviceName,
        hostname: router?.rule ? extractHostname(router.rule) : draft?.hostname || rule.hostname,
        backendUrl: lb.servers?.map((s: any) => s.url).filter(Boolean) || draft?.backendUrl || rule.backendUrl || [],
        entryPoints: router?.entryPoints || draft?.entryPoints || rule.entryPoints || [],
        tls: !!router?.tls,
        middlewares: middlewares.length ? middlewares : draft?.middlewares,
        priority: router?.priority ?? draft?.priority,
        certResolver: router?.tls?.certResolver ?? draft?.certResolver,
        tlsOptions: router?.tls?.options ?? draft?.tlsOptions,
        passHostHeader: lb.passHostHeader ?? draft?.passHostHeader,
        stickySession: Boolean(lb.sticky ?? draft?.stickySession),
        healthCheckPath: lb.healthCheck?.path ?? draft?.healthCheckPath,
        healthCheckInterval: lb.healthCheck?.interval ?? draft?.healthCheckInterval,
        serversTransport: serversTransportName ?? draft?.serversTransport,
        serversTransportInsecureSkipVerify: serversTransportName
          ? Boolean(serversTransportConfig?.insecureSkipVerify)
          : draft?.serversTransportInsecureSkipVerify,
      };
      setDraft(payload);
      setYamlError('');
    } catch {
      // Keep existing draft and surface errors elsewhere
    }
  };

  useEffect(() => {
    setYamlFilename(draft?.name || rule.name);
  }, [draft, rule.name]);

  const currentRule: TraefikRule = useMemo(() => {
    if (!draft) return rule;
    return {
      ...rule,
      name: draft.name,
      routerName: draft.routerName,
      serviceName: draft.serviceName,
      hostname: draft.hostname,
      backendUrl: draft.backendUrl,
      entryPoints: draft.entryPoints,
      tls: draft.tls,
      middlewares: draft.middlewares,
      priority: draft.priority,
      certResolver: draft.certResolver,
      tlsOptions: draft.tlsOptions,
      passHostHeader: draft.passHostHeader,
      stickySession: draft.stickySession,
      healthCheckPath: draft.healthCheckPath,
      healthCheckInterval: draft.healthCheckInterval,
      serversTransport: draft.serversTransport,
      serversTransportInsecureSkipVerify: draft.serversTransportInsecureSkipVerify,
      yamlContent: buildYamlFromPayload(draft),
    };
  }, [draft, rule]);

  return (
    <div className="bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" onClick={onCancel}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <Button variant="outline" onClick={onDuplicate}>
            Duplicate Rule
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Edit Rule: {rule.name}</CardTitle>
            <CardDescription>
              Modify this reverse proxy configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={mode}
              onValueChange={(v) => {
                const next = v as 'simple' | 'advanced';
                if (next === 'advanced') {
                  syncYamlFromDraft();
                } else {
                  syncDraftFromYaml();
                }
                setMode(next);
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="simple">Form Builder</TabsTrigger>
                <TabsTrigger value="advanced">
                  <Code2 className="w-4 h-4 mr-2" />
                  YAML Editor
                </TabsTrigger>
              </TabsList>

              <TabsContent value="simple" className="mt-6" forceMount>
                <SimpleEdit
                  rule={currentRule}
                  onSave={handleSimpleSave}
                  onCancel={onCancel}
                  existingMiddlewares={existingMiddlewares}
                  onChangeDraft={setDraft}
                />
              </TabsContent>

              <TabsContent value="advanced" className="mt-6" forceMount>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="yamlFilename">Rule Name (used as filename) *</Label>
                    <Input
                      id="yamlFilename"
                      value={yamlFilename}
                      onChange={(e) => setYamlFilename(e.target.value)}
                      placeholder="my-service"
                    />
                  </div>

                  <div className="border rounded-md overflow-hidden">
                    <Editor
                      height="500px"
                      defaultLanguage="yaml"
                      value={yamlContent}
                      onChange={(value) => setYamlContent(value || '')}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  </div>

                  {yamlError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-700">{yamlError}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Button onClick={handleAdvancedSave} size="lg">
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={onCancel}>
                      Cancel
                    </Button>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Advanced Mode:</strong> You have full control over the YAML configuration. 
                      Make sure to maintain valid Traefik configuration schema.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function extractHostname(rule: string): string {
  const match = rule.match(/Host\(`([^`]+)`\)/);
  return match ? match[1] : '';
}

function buildYamlFromPayload(payload: RulePayload): string {
  const routerName = payload.routerName || payload.name;
  const serviceName = payload.serviceName || payload.name;

  const router: any = {
    rule: `Host(\`${payload.hostname}\`)`,
    service: serviceName,
    entryPoints: payload.entryPoints || [],
  };

  if (payload.tls) {
    router.tls = {};
    if (payload.certResolver) router.tls.certResolver = payload.certResolver;
    if (payload.tlsOptions) router.tls.options = payload.tlsOptions;
    if (Object.keys(router.tls).length === 0) delete router.tls;
  } else {
    delete router.tls;
  }

  if (payload.middlewares?.length) {
    router.middlewares = payload.middlewares;
  }
  if (payload.priority) {
    router.priority = payload.priority;
  }

  const service: any = {
    loadBalancer: {
      servers: (payload.backendUrl || []).map((url) => ({ url })),
      passHostHeader: payload.passHostHeader ?? true,
      ...(payload.serversTransport ? { serversTransport: payload.serversTransport } : {}),
    },
  };

  if (payload.stickySession) {
    service.loadBalancer.sticky = { cookie: { name: `${payload.name}_sticky` } };
  }
  if (payload.healthCheckPath) {
    service.loadBalancer.healthCheck = {
      path: payload.healthCheckPath,
      interval: payload.healthCheckInterval || '30s',
    };
  }

  const config: any = {
    http: {
      routers: { [routerName]: router },
      services: { [serviceName]: service },
    },
  };

  if (payload.serversTransport) {
    config.http.serversTransports = {
      [payload.serversTransport]: payload.serversTransportInsecureSkipVerify
        ? { insecureSkipVerify: true }
        : {},
    };
  }

  return yaml.dump(config, { indent: 2 });
}
