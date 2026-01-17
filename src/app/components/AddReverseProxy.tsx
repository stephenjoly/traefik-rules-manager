import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Plus, X, Code2, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Textarea } from './ui/textarea';
import type { RulePayload } from '../types';
import Editor from '@monaco-editor/react';
import * as yaml from 'js-yaml';

type AddReverseProxyProps = {
  onSave: (payload: RulePayload) => Promise<void>;
  onCancel: () => void;
  existingMiddlewares: string[];
};

type FormData = {
  name: string;
  hostname: string;
  backendUrl: string;
  entryPoints: string;
  tls: boolean;
  priority: number;
  certResolver: string;
  passHostHeader: boolean;
  stickySession: boolean;
  healthCheckPath: string;
  healthCheckInterval: string;
};

const DEFAULT_VALUES: FormData = {
  name: '',
  hostname: '',
  backendUrl: '',
  entryPoints: 'web,websecure',
  tls: true,
  priority: 0,
  certResolver: '',
  passHostHeader: true,
  stickySession: false,
  healthCheckPath: '',
  healthCheckInterval: '30s',
};

export default function AddReverseProxy({
  onSave,
  onCancel,
  existingMiddlewares,
}: AddReverseProxyProps) {
  const [mode, setMode] = useState<'form' | 'yaml'>('form');
  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormData>({
    defaultValues: DEFAULT_VALUES,
  });

  const [backends, setBackends] = useState<string[]>([]);
  const [entryPoints, setEntryPoints] = useState<string[]>(['web', 'websecure']);
  const [selectedMiddlewares, setSelectedMiddlewares] = useState<string[]>([]);
  const [backendInput, setBackendInput] = useState('');
  const [entryPointInput, setEntryPointInput] = useState('');
  const [middlewareInput, setMiddlewareInput] = useState('');
  const [yamlContent, setYamlContent] = useState('');
  const [yamlError, setYamlError] = useState('');
  const [saving, setSaving] = useState(false);

  const addBackend = () => {
    if (backendInput.trim() && !backends.includes(backendInput.trim())) {
      setBackends([...backends, backendInput.trim()]);
      setBackendInput('');
    }
  };

  const removeBackend = (backend: string) => {
    setBackends(backends.filter((b) => b !== backend));
  };

  const addMiddleware = () => {
    if (middlewareInput.trim() && !selectedMiddlewares.includes(middlewareInput.trim())) {
      setSelectedMiddlewares([...selectedMiddlewares, middlewareInput.trim()]);
      setMiddlewareInput('');
    }
  };

  const removeMiddleware = (middleware: string) => {
    setSelectedMiddlewares(selectedMiddlewares.filter((m) => m !== middleware));
  };

  const addEntryPoint = () => {
    if (entryPointInput.trim() && !entryPoints.includes(entryPointInput.trim())) {
      setEntryPoints([...entryPoints, entryPointInput.trim()]);
      setEntryPointInput('');
    }
  };

  const removeEntryPoint = (entryPoint: string) => {
    setEntryPoints(entryPoints.filter((ep) => ep !== entryPoint));
  };

  const onSubmitForm = async (data: FormData) => {
    if (!data.hostname.trim()) {
      alert('Please enter a hostname');
      return;
    }

    if (backends.length === 0) {
      alert('Please add at least one backend server');
      return;
    }

    if (entryPoints.length === 0) {
      alert('Please add at least one entry point');
      return;
    }

    const payload: RulePayload = {
      name: data.name,
      hostname: data.hostname,
      backendUrl: backends,
      entryPoints: entryPoints,
      tls: data.tls,
      middlewares: selectedMiddlewares.length > 0 ? selectedMiddlewares : undefined,
      priority: data.priority,
      certResolver: data.certResolver,
      passHostHeader: data.passHostHeader,
      stickySession: data.stickySession,
      healthCheckPath: data.healthCheckPath,
      healthCheckInterval: data.healthCheckInterval
    };

    setSaving(true);
    try {
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  const onSubmitYaml = async () => {
    try {
      // Validate YAML
      const parsed = yaml.load(yamlContent);
      setYamlError('');

      // Extract basic info from YAML for the rule object
      const config = parsed as any;
      const routerName = Object.keys(config?.http?.routers || {})[0] || 'unnamed';
      const router = config?.http?.routers?.[routerName];

      const middlewares = router?.middlewares || [];
      const payload: RulePayload = {
        name: routerName,
        hostname: router?.rule ? extractHostname(router.rule) : '',
        backendUrl: config?.http?.services?.[routerName]?.loadBalancer?.servers?.map((s: any) => s.url) || [],
        entryPoints: router?.entryPoints || [],
        tls: !!router?.tls,
        middlewares: middlewares.length ? middlewares : undefined,
        priority: router?.priority,
        certResolver: router?.tls?.certResolver,
        passHostHeader: config?.http?.services?.[routerName]?.loadBalancer?.passHostHeader,
        stickySession: Boolean(config?.http?.services?.[routerName]?.loadBalancer?.sticky),
        healthCheckPath: config?.http?.services?.[routerName]?.loadBalancer?.healthCheck?.path,
        healthCheckInterval: config?.http?.services?.[routerName]?.loadBalancer?.healthCheck?.interval,
      };

      setSaving(true);
      await onSave(payload);
      setSaving(false);
    } catch (error) {
      setYamlError(error instanceof Error ? error.message : 'Invalid YAML');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="ghost" onClick={onCancel} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Add Reverse Proxy</CardTitle>
            <CardDescription>
              Create a new Traefik reverse proxy configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'form' | 'yaml')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="form">Form Builder</TabsTrigger>
                <TabsTrigger value="yaml">
                  <Code2 className="w-4 h-4 mr-2" />
                  YAML Editor
                </TabsTrigger>
              </TabsList>

              <TabsContent value="form" className="mt-6">
                <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
                  {/* Basic Settings */}
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2">
                      Basic Configuration
                    </h3>

                    {/* Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name">Rule Name *</Label>
                      <Input
                        id="name"
                        {...register('name', { 
                          required: 'Name is required',
                          pattern: {
                            value: /^[a-zA-Z0-9-_]+$/,
                            message: 'Only alphanumeric characters, hyphens, and underscores allowed'
                          }
                        })}
                        placeholder="my-app"
                      />
                      {errors.name && (
                        <p className="text-sm text-red-600">{errors.name.message}</p>
                      )}
                    </div>

                    {/* Hostnames */}
                    <div className="space-y-2">
                      <Label htmlFor="hostname">Hostnames *</Label>
                      <Input
                        id="hostname"
                        {...register('hostname', { required: 'Hostname is required' })}
                        placeholder="app.example.com"
                      />
                      {errors.hostname && (
                        <p className="text-sm text-red-600">{errors.hostname.message}</p>
                      )}
                    </div>

                    {/* Backend URLs */}
                    <div className="space-y-2">
                      <Label htmlFor="backendUrl">Backend Server URLs *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="backendUrl"
                          value={backendInput}
                          onChange={(e) => setBackendInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addBackend();
                            }
                          }}
                          placeholder="http://192.168.1.10:8080"
                        />
                        <Button type="button" onClick={addBackend}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      {backends.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {backends.map((backend) => (
                            <Badge key={backend} variant="outline">
                              {backend}
                              <button
                                type="button"
                                onClick={() => removeBackend(backend)}
                                className="ml-2"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* EntryPoints */}
                    <div className="space-y-2">
                      <Label htmlFor="entryPoints">Entry Points *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="entryPoints"
                          value={entryPointInput}
                          onChange={(e) => setEntryPointInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addEntryPoint();
                            }
                          }}
                          placeholder="web,websecure"
                        />
                        <Button type="button" onClick={addEntryPoint}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      {entryPoints.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {entryPoints.map((entryPoint) => (
                            <Badge key={entryPoint} variant="outline">
                              {entryPoint}
                              <button
                                type="button"
                                onClick={() => removeEntryPoint(entryPoint)}
                                className="ml-2"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      {errors.entryPoints && (
                        <p className="text-sm text-red-600">{errors.entryPoints.message}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        Comma-separated list (default: web,websecure)
                      </p>
                    </div>

                    {/* TLS */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="tls">Enable TLS</Label>
                        <p className="text-sm text-gray-500">
                          Enable HTTPS/TLS for this route
                        </p>
                      </div>
                      <Switch
                        id="tls"
                        {...register('tls')}
                        defaultChecked={true}
                      />
                    </div>
                  </div>

                  {/* Advanced Settings */}
                  <Accordion type="single" collapsible className="border rounded-lg">
                    <AccordionItem value="advanced" className="border-none">
                      <AccordionTrigger className="px-4">
                        <div className="flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          <span>Advanced Configuration</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-4">
                        {/* Middlewares */}
                        <div className="space-y-2">
                          <Label htmlFor="middleware">Middlewares</Label>
                          <div className="flex gap-2">
                            <Input
                              id="middleware"
                              value={middlewareInput}
                              onChange={(e) => setMiddlewareInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addMiddleware();
                                }
                              }}
                              placeholder="compress, rate-limit, etc."
                            />
                            <Button type="button" onClick={addMiddleware}>
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                          {selectedMiddlewares.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {selectedMiddlewares.map((mw) => (
                                <Badge key={mw} variant="outline">
                                  {mw}
                                  <button
                                    type="button"
                                    onClick={() => removeMiddleware(mw)}
                                    className="ml-2"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                          <p className="text-sm text-gray-500">
                            Add middleware names (must be defined elsewhere)
                          </p>
                        </div>

                        {/* Priority */}
                        <div className="space-y-2">
                          <Label htmlFor="priority">Priority</Label>
                          <Input
                            id="priority"
                            type="number"
                            {...register('priority')}
                            placeholder="0"
                          />
                          <p className="text-sm text-gray-500">
                            Higher priority routes are evaluated first (default: 0)
                          </p>
                        </div>

                        {/* Cert Resolver */}
                        <div className="space-y-2">
                          <Label htmlFor="certResolver">Certificate Resolver</Label>
                          <Input
                            id="certResolver"
                            {...register('certResolver')}
                            placeholder="letsencrypt"
                          />
                          <p className="text-sm text-gray-500">
                            Name of the certificate resolver to use for TLS
                          </p>
                        </div>

                        {/* Pass Host Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="passHostHeader">Pass Host Header</Label>
                            <p className="text-sm text-gray-500">
                              Forward the Host header to backend
                            </p>
                          </div>
                          <Switch
                            id="passHostHeader"
                            {...register('passHostHeader')}
                            defaultChecked={true}
                          />
                        </div>

                        {/* Sticky Session */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="stickySession">Sticky Sessions</Label>
                            <p className="text-sm text-gray-500">
                              Enable cookie-based sticky sessions
                            </p>
                          </div>
                          <Switch
                            id="stickySession"
                            {...register('stickySession')}
                            defaultChecked={false}
                          />
                        </div>

                        {/* Health Check */}
                        <div className="space-y-2">
                          <Label htmlFor="healthCheckPath">Health Check Path</Label>
                          <Input
                            id="healthCheckPath"
                            {...register('healthCheckPath')}
                            placeholder="/health"
                          />
                          <p className="text-sm text-gray-500">
                            Path for backend health checks (leave empty to disable)
                          </p>
                        </div>

                        {/* Health Check Interval */}
                        <div className="space-y-2">
                          <Label htmlFor="healthCheckInterval">Health Check Interval</Label>
                          <Input
                            id="healthCheckInterval"
                            {...register('healthCheckInterval')}
                            placeholder="30s"
                          />
                          <p className="text-sm text-gray-500">
                            Interval between health checks (default: 30s)
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4">
                    <Button type="submit" size="lg" disabled={saving}>
                      {saving ? 'Saving...' : 'Create Reverse Proxy'}
                    </Button>
                    <Button type="button" variant="outline" onClick={onCancel}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="yaml" className="mt-6">
                <div className="space-y-4">
                  <div className="border rounded-md overflow-hidden">
                    <Editor
                      height="500px"
                      defaultLanguage="yaml"
                      value={yamlContent || generateDefaultYaml()}
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
                    <Button onClick={onSubmitYaml} size="lg" disabled={saving}>
                      {saving ? 'Saving...' : 'Create from YAML'}
                    </Button>
                    <Button variant="outline" onClick={onCancel}>
                      Cancel
                    </Button>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>YAML Mode:</strong> Write your Traefik configuration directly. 
                      Make sure to follow the Traefik dynamic configuration schema.
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

function generateYaml(
  name: string,
  hostname: string,
  backends: string[],
  entryPoints: string[],
  tls: boolean,
  middlewares: string[],
  options: {
    priority: number;
    certResolver: string;
    passHostHeader: boolean;
    stickySession: boolean;
    healthCheckPath: string;
    healthCheckInterval: string;
  }
): string {
  const router: any = {
    rule: `Host(\`${hostname}\`)`,
    service: name,
    entryPoints: entryPoints,
  };

  if (tls) {
    router.tls = options.certResolver ? { certResolver: options.certResolver } : {};
  }

  if (middlewares.length > 0) {
    router.middlewares = middlewares;
  }

  if (options.priority !== 0) {
    router.priority = options.priority;
  }

  const service: any = {
    loadBalancer: {
      servers: backends.map((url) => ({ url })),
      passHostHeader: options.passHostHeader,
    },
  };

  if (options.stickySession) {
    service.loadBalancer.sticky = {
      cookie: {
        name: `${name}_sticky`,
      },
    };
  }

  if (options.healthCheckPath) {
    service.loadBalancer.healthCheck = {
      path: options.healthCheckPath,
      interval: options.healthCheckInterval || '30s',
    };
  }

  const config = {
    http: {
      routers: {
        [name]: router,
      },
      services: {
        [name]: service,
      },
    },
  };

  return yaml.dump(config, { indent: 2 });
}

function generateDefaultYaml(): string {
  return `http:
  routers:
    my-service:
      rule: "Host(\`example.com\`)"
      service: my-service
      entryPoints:
        - web
        - websecure
      tls: {}
  
  services:
    my-service:
      loadBalancer:
        servers:
          - url: "http://192.168.1.10:8080"
        passHostHeader: true
`;
}

function extractHostname(rule: string): string {
  const match = rule.match(/Host\(`([^`]+)`\)/);
  return match ? match[1] : '';
}
