import { useState, useEffect } from 'react';
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
import type { RulePayload, TraefikRule } from '../types';
import Editor from '@monaco-editor/react';
import * as yaml from 'js-yaml';
import { duplicateRule, ruleToPayload } from '../utils/rules';

type AddReverseProxyProps = {
  onSave: (payload: RulePayload) => Promise<void>;
  onCancel: () => void;
  existingMiddlewares: string[];
  initialValue?: RulePayload;
  templates?: TraefikRule[];
  defaultTemplateId?: string;
};

type FormData = {
  name: string;
  routerName: string;
  serviceName: string;
  hostname: string;
  backendUrl: string;
  entryPoints: string;
  tls: boolean;
  priority: number;
  certResolver: string;
  tlsOptions: string;
  passHostHeader: boolean;
  stickySession: boolean;
  healthCheckPath: string;
  healthCheckInterval: string;
  serversTransport: string;
  serversTransportInsecureSkipVerify: boolean;
};

const DEFAULT_VALUES: FormData = {
  name: '',
  routerName: '',
  serviceName: '',
  hostname: '',
  backendUrl: '',
  entryPoints: 'web,websecure',
  tls: true,
  priority: 0,
  certResolver: '',
  tlsOptions: '',
  passHostHeader: true,
  stickySession: false,
  healthCheckPath: '',
  healthCheckInterval: '30s',
  serversTransport: '',
  serversTransportInsecureSkipVerify: false,
};

export default function AddReverseProxy({
  onSave,
  onCancel,
  existingMiddlewares,
  initialValue,
  templates = [],
  defaultTemplateId,
}: AddReverseProxyProps) {
  const [mode, setMode] = useState<'form' | 'yaml'>('form');
  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm<FormData>({
    defaultValues: DEFAULT_VALUES,
  });

  const [backends, setBackends] = useState<string[]>([]);
  const [entryPoints, setEntryPoints] = useState<string[]>(['web', 'websecure']);
  const [selectedMiddlewares, setSelectedMiddlewares] = useState<string[]>([]);
  const [backendInput, setBackendInput] = useState('');
  const [entryPointInput, setEntryPointInput] = useState('');
  const [middlewareInput, setMiddlewareInput] = useState('');
  const [availableMiddleware, setAvailableMiddleware] = useState('');
  const [yamlContent, setYamlContent] = useState('');
  const [yamlError, setYamlError] = useState('');
  const [saving, setSaving] = useState(false);
  const [yamlTouched, setYamlTouched] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const filenameValue = watch('name', DEFAULT_VALUES.name);
  const tlsValue = watch('tls', true);
  const passHostHeaderValue = watch('passHostHeader', true);
  const stickySessionValue = watch('stickySession', false);
  const serversTransportInsecureValue = watch('serversTransportInsecureSkipVerify', false);

  const setFromPayload = (payload: RulePayload) => {
    reset({
      name: payload.name,
      routerName: payload.routerName || payload.name,
      serviceName: payload.serviceName || payload.name,
      hostname: payload.hostname,
      backendUrl: '',
      entryPoints: payload.entryPoints.join(','),
      tls: payload.tls,
      priority: payload.priority || 0,
      certResolver: payload.certResolver || '',
      tlsOptions: payload.tlsOptions || '',
      passHostHeader: payload.passHostHeader ?? true,
      stickySession: payload.stickySession ?? false,
      healthCheckPath: payload.healthCheckPath || '',
      healthCheckInterval: payload.healthCheckInterval || '',
      serversTransport: payload.serversTransport || '',
      serversTransportInsecureSkipVerify: payload.serversTransportInsecureSkipVerify ?? false,
    });
    setBackends(payload.backendUrl || []);
    setEntryPoints(payload.entryPoints || []);
    setSelectedMiddlewares(payload.middlewares || []);
    setYamlContent(generateYamlFromPayload(payload));
    setYamlTouched(false);
  };

  useEffect(() => {
    if (defaultTemplateId && !selectedTemplateId) {
      setSelectedTemplateId(defaultTemplateId);
    }
    if (initialValue) {
      setFromPayload(initialValue);
    }
  }, [initialValue, reset, defaultTemplateId, selectedTemplateId, templates]);

  useEffect(() => {
    if (!selectedTemplateId) return;
    const tmpl = templates.find(t => t.id === selectedTemplateId);
    if (tmpl) {
      setFromPayload(ruleToPayload(tmpl, { copyName: false }));
    }
  }, [selectedTemplateId, templates]);

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

  const addMiddlewareFromList = () => {
    if (availableMiddleware && !selectedMiddlewares.includes(availableMiddleware)) {
      setSelectedMiddlewares([...selectedMiddlewares, availableMiddleware]);
      setAvailableMiddleware('');
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
    const toBool = (val: any, fallback: boolean) => {
      if (val === true || val === false) return val;
      if (val === 'true') return true;
      if (val === 'false') return false;
      return fallback;
    };

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
      routerName: data.routerName || data.name,
      serviceName: data.serviceName || data.name,
      hostname: data.hostname,
      backendUrl: backends,
      entryPoints: entryPoints,
      tls: toBool(data.tls, false),
      middlewares: selectedMiddlewares.length > 0 ? selectedMiddlewares : undefined,
      priority: data.priority,
      certResolver: data.certResolver,
      tlsOptions: data.tlsOptions,
      passHostHeader: toBool(data.passHostHeader, true),
      stickySession: toBool(data.stickySession, false),
      healthCheckPath: data.healthCheckPath,
      healthCheckInterval: data.healthCheckInterval,
      serversTransport: data.serversTransport || undefined,
      serversTransportInsecureSkipVerify: toBool(data.serversTransportInsecureSkipVerify, false)
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

      const filename = filenameValue?.trim() || '';
      if (!filename) {
        alert('Please enter a rule name (filename) before saving.');
        return;
      }
      if (!/^[a-zA-Z0-9-_]+$/.test(filename)) {
        alert('Filename can only include letters, numbers, hyphens, and underscores.');
        return;
      }

      // Extract basic info from YAML for the rule object
      const config = parsed as any;
      const routerName = Object.keys(config?.http?.routers || {})[0] || 'unnamed';
      const router = config?.http?.routers?.[routerName];
      const serviceName = router?.service || routerName;
      const lb = config?.http?.services?.[serviceName]?.loadBalancer || {};

      const middlewares = router?.middlewares || [];
      const payload: RulePayload = {
        name: filename,
        routerName: routerName,
        serviceName: serviceName,
        hostname: router?.rule ? extractHostname(router.rule) : '',
        backendUrl: lb.servers?.map((s: any) => s.url).filter(Boolean) || [],
        entryPoints: router?.entryPoints || [],
        tls: !!router?.tls,
        middlewares: middlewares.length ? middlewares : undefined,
        priority: router?.priority,
        certResolver: router?.tls?.certResolver,
        tlsOptions: router?.tls?.options,
        passHostHeader: lb.passHostHeader,
        stickySession: Boolean(lb.sticky),
        healthCheckPath: lb.healthCheck?.path,
        healthCheckInterval: lb.healthCheck?.interval,
        serversTransport: lb.serversTransport,
        serversTransportInsecureSkipVerify: lb.serversTransport
          ? Boolean(config?.http?.serversTransports?.[lb.serversTransport]?.insecureSkipVerify)
          : false
      };

      setSaving(true);
      await onSave(payload);
      // populate form fields so user can switch to form mode with data filled
      setValue('name', payload.name);
      setValue('routerName', payload.routerName || payload.name);
      setValue('serviceName', payload.serviceName || payload.name);
      setValue('hostname', payload.hostname);
      setBackends(payload.backendUrl);
      setEntryPoints(payload.entryPoints);
      setSelectedMiddlewares(payload.middlewares || []);
      setValue('tls', payload.tls);
      setValue('priority', payload.priority || 0);
      setValue('certResolver', payload.certResolver || '');
      setValue('tlsOptions', payload.tlsOptions || '');
      setValue('passHostHeader', payload.passHostHeader ?? true);
      setValue('stickySession', payload.stickySession ?? false);
      setValue('healthCheckPath', payload.healthCheckPath || '');
      setValue('healthCheckInterval', payload.healthCheckInterval || '');
      setValue('serversTransport', payload.serversTransport || '');
      setValue('serversTransportInsecureSkipVerify', payload.serversTransportInsecureSkipVerify ?? false);
      setSaving(false);
    } catch (error) {
      setYamlError(error instanceof Error ? error.message : 'Invalid YAML');
      setSaving(false);
    }
  };

  const syncYamlFromForm = () => {
    const data = watch();
    const generated = generateYaml(
      data.name || 'my-service',
      data.routerName || data.name || 'my-service',
      data.serviceName || data.name || 'my-service',
      data.hostname || '',
      backends,
      entryPoints,
      data.tls,
      selectedMiddlewares,
      {
        priority: data.priority || 0,
        certResolver: data.certResolver || '',
        tlsOptions: data.tlsOptions || '',
                        passHostHeader: data.passHostHeader ?? true,
                        stickySession: data.stickySession ?? false,
                        healthCheckPath: data.healthCheckPath || '',
                        healthCheckInterval: data.healthCheckInterval || '',
                        serversTransport: data.serversTransport || '',
                        serversTransportInsecureSkipVerify: data.serversTransportInsecureSkipVerify
                      }
                    );
    setYamlContent(generated);
  };

  const syncFormFromYaml = () => {
    if (!yamlContent) return;
    try {
      const parsed = yaml.load(yamlContent) as any;
      const routerName = Object.keys(parsed?.http?.routers || {})[0] || 'unnamed';
      const router = parsed?.http?.routers?.[routerName];
      const serviceName = router?.service || routerName;
      const lb = parsed?.http?.services?.[serviceName]?.loadBalancer || {};
      const middlewares = router?.middlewares || [];

      const payload: RulePayload = {
        name: filenameValue?.trim() || routerName,
        routerName,
        serviceName,
        hostname: router?.rule ? extractHostname(router.rule) : '',
        backendUrl: lb.servers?.map((s: any) => s.url).filter(Boolean) || [],
        entryPoints: router?.entryPoints || [],
        tls: !!router?.tls,
        middlewares: middlewares.length ? middlewares : undefined,
        priority: router?.priority,
        certResolver: router?.tls?.certResolver,
        passHostHeader: lb.passHostHeader,
        stickySession: Boolean(lb.sticky),
        healthCheckPath: lb.healthCheck?.path,
        healthCheckInterval: lb.healthCheck?.interval,
        serversTransport: lb.serversTransport
      };

      setValue('name', payload.name);
      setValue('routerName', payload.routerName || payload.name);
      setValue('serviceName', payload.serviceName || payload.name);
      setValue('hostname', payload.hostname);
      setBackends(payload.backendUrl);
      setEntryPoints(payload.entryPoints);
      setSelectedMiddlewares(payload.middlewares || []);
      setValue('tls', payload.tls);
      setValue('priority', payload.priority || 0);
      setValue('certResolver', payload.certResolver || '');
      setValue('passHostHeader', payload.passHostHeader ?? true);
      setValue('stickySession', payload.stickySession ?? false);
      setValue('healthCheckPath', payload.healthCheckPath || '');
      setValue('healthCheckInterval', payload.healthCheckInterval || '');
      setValue('serversTransport', payload.serversTransport || '');
    } catch (err) {
      // keep form as-is if YAML invalid
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
            {templates.length > 0 && (
              <div className="mb-4 space-y-2">
                <Label htmlFor="templateSelect">Start from existing rule (optional)</Label>
                <div className="flex gap-2">
                  <select
                    id="templateSelect"
                    className="border rounded px-2 py-2 text-sm w-full"
                    value={selectedTemplateId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedTemplateId(id);
                      const template = templates.find((t) => t.id === id);
                      if (template) {
                        setFromPayload(ruleToPayload(template, { copyName: false }));
                      }
                    }}
                  >
                    <option value="">None</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fileName || `${t.name}.yml`}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-sm text-gray-500">Prefill the form using an existing rule.</p>
              </div>
            )}
            <Tabs
              value={mode}
              onValueChange={(v) => {
                const nextMode = v as 'form' | 'yaml';
                if (nextMode === 'yaml') syncYamlFromForm();
                if (nextMode === 'form') syncFormFromYaml();
                setMode(nextMode);
              }}
            >
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
                      <Label htmlFor="name">Rule Name (used as filename) *</Label>
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

                    {/* Router Name */}
                    <div className="space-y-2">
                      <Label htmlFor="routerName">Router Name</Label>
                      <Input
                        id="routerName"
                        {...register('routerName', { 
                          pattern: {
                            value: /^[a-zA-Z0-9-_]*$/,
                            message: 'Only alphanumeric characters, hyphens, and underscores allowed'
                          }
                        })}
                        placeholder="my-app-router"
                      />
                      <p className="text-sm text-gray-500">Defaults to rule name if left empty.</p>
                    </div>

                    {/* Service Name */}
                    <div className="space-y-2">
                      <Label htmlFor="serviceName">Service Name (optional)</Label>
                      <Input
                        id="serviceName"
                        {...register('serviceName', { 
                          pattern: {
                            value: /^[a-zA-Z0-9-_]*$/,
                            message: 'Only alphanumeric characters, hyphens, and underscores allowed'
                          }
                        })}
                        placeholder="my-app-service"
                      />
                      <p className="text-sm text-gray-500">Defaults to rule name if left empty.</p>
                    </div>

                    {/* Hostname */}
                    <div className="space-y-2">
                      <Label htmlFor="hostname">Hostname *</Label>
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
                        checked={Boolean(tlsValue)}
                        onCheckedChange={(val) => setValue('tls', Boolean(val))}
                      />
                    </div>

                    {Boolean(tlsValue) && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="tlsOptions">TLS Options (name)</Label>
                          <Input
                            id="tlsOptions"
                            list="tlsOptionsList"
                            {...register('tlsOptions')}
                            placeholder="tls-opts@file"
                          />
                          <datalist id="tlsOptionsList">
                            <option value="tls-opts@file" />
                          </datalist>
                          <p className="text-sm text-gray-500">
                            Optional TLS options reference (e.g., tls-opts@file)
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Middlewares */}
                  <div className="space-y-2">
                    <Label htmlFor="middleware">Middlewares</Label>
                    <div className="flex flex-col gap-2">
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
                      {existingMiddlewares.length > 0 && (
                        <div className="flex gap-2 items-center">
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            value={availableMiddleware}
                            onChange={(e) => setAvailableMiddleware(e.target.value)}
                          >
                            <option value="">Select middleware</option>
                            {existingMiddlewares
                              .filter((mw) => !selectedMiddlewares.includes(mw))
                              .map((mw) => (
                                <option key={mw} value={mw}>
                                  {mw}
                                </option>
                              ))}
                          </select>
                          <Button type="button" variant="outline" onClick={addMiddlewareFromList} disabled={!availableMiddleware}>
                            Add
                          </Button>
                        </div>
                      )}
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
                            checked={Boolean(passHostHeaderValue)}
                            onCheckedChange={(val) => setValue('passHostHeader', Boolean(val))}
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
                            checked={Boolean(stickySessionValue)}
                            onCheckedChange={(val) => setValue('stickySession', Boolean(val))}
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

                        {/* Servers Transport */}
                        <div className="space-y-2">
                          <Label htmlFor="serversTransport">Servers Transport</Label>
                          <Input
                            id="serversTransport"
                            {...register('serversTransport')}
                            placeholder="firefox"
                          />
                          <p className="text-sm text-gray-500">
                            Optional serversTransport to use for this service
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="serversTransportInsecureSkipVerify">Servers Transport: Insecure Skip Verify</Label>
                            <p className="text-sm text-gray-500">
                              Allow skipping TLS verification for this serversTransport
                            </p>
                          </div>
                          <Switch
                            id="serversTransportInsecureSkipVerify"
                            checked={Boolean(serversTransportInsecureValue)}
                            onCheckedChange={(val) => setValue('serversTransportInsecureSkipVerify', Boolean(val))}
                          />
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
                  <div className="space-y-2">
                    <Label htmlFor="name">Rule Name (used as filename) *</Label>
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

                  <div className="border rounded-md overflow-hidden">
                    <Editor
                      height="500px"
                      defaultLanguage="yaml"
                      value={yamlContent || generateDefaultYaml()}
                      onChange={(value) => {
                        setYamlContent(value || '');
                      }}
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
  routerName: string,
  serviceName: string,
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
    serversTransport?: string;
  }
): string {
  const router: any = {
    rule: `Host(\`${hostname}\`)`,
    service: serviceName || name,
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
      ...(options.serversTransport ? { serversTransport: options.serversTransport } : {}),
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
        [routerName || name]: router,
      },
      services: {
        [serviceName || name]: service,
      },
    },
  };

  return yaml.dump(config, { indent: 2 });
}

function generateDefaultYaml(): string {
  return generateYaml(
    DEFAULT_VALUES.name || 'my-service',
    DEFAULT_VALUES.routerName || DEFAULT_VALUES.name || 'my-service',
    DEFAULT_VALUES.serviceName || DEFAULT_VALUES.name || 'my-service',
    DEFAULT_VALUES.hostname || 'example.com',
    [],
    DEFAULT_VALUES.entryPoints.split(',').filter(Boolean),
    DEFAULT_VALUES.tls,
    [],
    {
      priority: DEFAULT_VALUES.priority,
      certResolver: DEFAULT_VALUES.certResolver,
      passHostHeader: DEFAULT_VALUES.passHostHeader,
      stickySession: DEFAULT_VALUES.stickySession,
      healthCheckPath: DEFAULT_VALUES.healthCheckPath,
      healthCheckInterval: DEFAULT_VALUES.healthCheckInterval,
    }
  );
}

function extractHostname(rule: string): string {
  const match =
    rule.match(/Host\(`?([^`]+)`?\)/) ||
    rule.match(/Host\("([^"]+)"\)/) ||
    rule.match(/Host\('([^']+)'\)/);
  return match ? match[1] : '';
}

function generateYamlFromPayload(payload: RulePayload): string {
  return generateYaml(
    payload.name,
    payload.routerName || payload.name,
    payload.serviceName || payload.name,
    payload.hostname,
    payload.backendUrl || [],
    payload.entryPoints || [],
    payload.tls,
    payload.middlewares || [],
    {
      priority: payload.priority || 0,
      certResolver: payload.certResolver || '',
      passHostHeader: payload.passHostHeader ?? true,
      stickySession: payload.stickySession ?? false,
      healthCheckPath: payload.healthCheckPath || '',
      healthCheckInterval: payload.healthCheckInterval || '',
      serversTransport: payload.serversTransport,
    }
  );
}
