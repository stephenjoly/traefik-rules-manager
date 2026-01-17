import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, X, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import type { RulePayload, TraefikRule } from '../types';

type SimpleEditProps = {
  rule: TraefikRule;
  onSave: (payload: RulePayload) => Promise<void>;
  onCancel: () => void;
  existingMiddlewares: string[];
};

type FormData = {
  name: string;
  hostname: string;
  entryPoints: string;
  tls: boolean;
  priority: number;
  certResolver: string;
  passHostHeader: boolean;
  stickySession: boolean;
  healthCheckPath: string;
  healthCheckInterval: string;
};

export default function SimpleEdit({
  rule,
  onSave,
  onCancel,
  existingMiddlewares,
}: SimpleEditProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      name: rule.name,
      hostname: rule.hostname,
      entryPoints: rule.entryPoints.join(','),
      tls: rule.tls,
      priority: rule.priority || 0,
      certResolver: rule.certResolver || '',
      passHostHeader: rule.passHostHeader || false,
      stickySession: rule.stickySession || false,
      healthCheckPath: rule.healthCheckPath || '',
      healthCheckInterval: rule.healthCheckInterval || '',
    },
  });

  const [backends, setBackends] = useState<string[]>(rule.backendUrl);
  const [entryPoints, setEntryPoints] = useState<string[]>(rule.entryPoints);
  const [selectedMiddlewares, setSelectedMiddlewares] = useState<string[]>(rule.middlewares || []);
  const [backendInput, setBackendInput] = useState('');
  const [entryPointInput, setEntryPointInput] = useState('');
  const [middlewareInput, setMiddlewareInput] = useState('');
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

  const addEntryPoint = () => {
    if (entryPointInput.trim() && !entryPoints.includes(entryPointInput.trim())) {
      setEntryPoints([...entryPoints, entryPointInput.trim()]);
      setEntryPointInput('');
    }
  };

  const removeEntryPoint = (entryPoint: string) => {
    setEntryPoints(entryPoints.filter((ep) => ep !== entryPoint));
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

  const onSubmit = async (data: FormData) => {
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
      priority: data.priority,
      certResolver: data.certResolver,
      passHostHeader: data.passHostHeader,
      stickySession: data.stickySession,
      healthCheckPath: data.healthCheckPath,
      healthCheckInterval: data.healthCheckInterval,
      middlewares: selectedMiddlewares
    };

    setSaving(true);
    try {
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Rule Name</Label>
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
        <Label htmlFor="hostname">Hostnames</Label>
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
        <Label htmlFor="backendUrl">Backend Server URLs</Label>
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
        <Label htmlFor="entryPoints">Entry Points</Label>
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
          defaultChecked={rule.tls}
        />
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
                defaultChecked={rule.passHostHeader}
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
                defaultChecked={rule.stickySession}
              />
            </div>

            {/* Health Check Path */}
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
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
