import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, KeyRound, RefreshCw, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiRunAutomationRequest } from '../api';
import { ApiKeyRecord, TraefikRule } from '../types';
import { Alert, AlertDescription } from './ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';

type ApiKeysAdminProps = {
  apiKeys: ApiKeyRecord[];
  loading?: boolean;
  lastCreatedKey: string | null;
  onDismissLastCreatedKey: () => void;
  automationTestUrl: string;
  rules: TraefikRule[];
  onCreate: (input: { name: string; expiresAt?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onRefreshRules: () => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
};

type ExampleTab = 'read' | 'search' | 'create' | 'delete';
type ExampleResult = {
  ok: boolean;
  status: number;
  statusText: string;
  summary: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  responseBody: string;
};

const SAMPLE_RULE_PREFIX = 'playground-sample-rule';
const SAMPLE_RULE_PAYLOAD = {
  name: SAMPLE_RULE_PREFIX,
  hostname: `${SAMPLE_RULE_PREFIX}.example.com`,
  backendUrl: ['http://app:8080'],
  entryPoints: ['web'],
  tls: false
};

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/$/, '');
}

function formatResponseBody(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return 'No response body';
  }

  if (typeof value === 'string') {
    return value;
  }

  return stringifyJson(value);
}

function copyWithFallback(value: string) {
  if (navigator?.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(value);
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.focus();
  input.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(input);

  if (!copied) {
    throw new Error('Clipboard copy failed');
  }

  return Promise.resolve();
}

export default function ApiKeysAdmin({
  apiKeys,
  loading = false,
  lastCreatedKey,
  onDismissLastCreatedKey,
  automationTestUrl,
  rules,
  onCreate,
  onDelete,
  onRefresh,
  onRefreshRules,
  onRevoke
}: ApiKeysAdminProps) {
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [activeExampleTab, setActiveExampleTab] = useState<ExampleTab>('read');
  const [exampleBaseUrl, setExampleBaseUrl] = useState('');
  const [exampleApiKey, setExampleApiKey] = useState('');
  const [exampleBusy, setExampleBusy] = useState(false);
  const [exampleResult, setExampleResult] = useState<ExampleResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('playground');
  const [createRuleBody, setCreateRuleBody] = useState(stringifyJson(SAMPLE_RULE_PAYLOAD));
  const [deleteRuleIdOverride, setDeleteRuleIdOverride] = useState('');

  const sampleRule = useMemo(
    () => rules.find((rule) => String(rule.name || '').startsWith(SAMPLE_RULE_PREFIX)),
    [rules]
  );

  const deleteTargetId = deleteRuleIdOverride.trim() || sampleRule?.id || '';
  const deleteTargetPath = deleteTargetId ? `/api/automation/rules/${deleteTargetId}` : '/api/automation/rules/:id';
  const automationBase = automationTestUrl.replace(/\/api\/automation\/rules$/, '');

  useEffect(() => {
    if (lastCreatedKey) {
      setExampleApiKey(lastCreatedKey);
    }
  }, [lastCreatedKey]);

  useEffect(() => {
    setExampleBaseUrl(automationBase);
  }, [automationBase]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await onCreate({
        name,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined
      });
      setName('');
      setExpiresAt('');
      setCreateOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyKey = async () => {
    if (!lastCreatedKey) return;

    try {
      await copyWithFallback(lastCreatedKey);
      toast.success('API key copied');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to copy API key');
    }
  };

  const runExampleRequest = async ({
    method,
    path,
    body,
    successSummary,
    onSuccess
  }: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    body?: unknown;
    successSummary: string;
    onSuccess?: (responseBody: unknown) => { summary: string; responseBody?: unknown };
  }) => {
    const baseUrl = normalizeBaseUrl(exampleBaseUrl);
    const apiKey = exampleApiKey.trim();
    if (!baseUrl) {
      toast.error('Provide a base URL first');
      return;
    }
    if (!apiKey) {
      toast.error('Paste a plaintext API key first');
      return;
    }

    setExampleBusy(true);
    try {
      const result = await apiRunAutomationRequest(baseUrl, apiKey, method, path, body);

      let summary = successSummary;
      let responseBody = result.body;
      if (result.ok && onSuccess) {
        const successDetails = onSuccess(result.body);
        summary = successDetails.summary;
        if (successDetails.responseBody !== undefined) {
          responseBody = successDetails.responseBody;
        }
      } else if (!result.ok) {
        summary = result.message || `${result.status} ${result.statusText}`;
      }

      setExampleResult({
        ok: result.ok,
        status: result.status,
        statusText: result.statusText,
        summary,
        method,
        path,
        responseBody: formatResponseBody(responseBody)
      });

      if (result.ok) {
        if (method !== 'GET') {
          await onRefreshRules();
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run example request';
      setExampleResult({
        ok: false,
        status: 0,
        statusText: 'Request failed',
        summary: message,
        method,
        path,
        responseBody: message
      });
      toast.error(message);
    } finally {
      setExampleBusy(false);
    }
  };

  const handleRunReadRules = async () => {
    await runExampleRequest({
      method: 'GET',
      path: '/api/automation/rules',
      successSummary: 'Read rules succeeded',
      onSuccess: (responseBody) => {
        const count = Array.isArray(responseBody) ? responseBody.length : 0;
        return {
          summary: `Read ${count} rules`
        };
      }
    });
  };

  const handleRunSearchRules = async () => {
    const query = searchTerm.trim().toLowerCase();
    await runExampleRequest({
      method: 'GET',
      path: '/api/automation/rules',
      successSummary: 'Search succeeded',
      onSuccess: (responseBody) => {
        const rulesList = Array.isArray(responseBody) ? responseBody : [];
        const matches = rulesList.filter((rule) => {
          const fields = [
            rule?.name,
            rule?.fileName,
            rule?.routerName,
            rule?.serviceName,
            rule?.hostname
          ]
            .filter(Boolean)
            .map((value) => String(value).toLowerCase());

          return !query || fields.some((field) => field.includes(query));
        });
        return {
          summary: `Found ${matches.length} matching rule${matches.length === 1 ? '' : 's'}${query ? ` for "${searchTerm.trim()}"` : ''}`,
          responseBody: matches
        };
      }
    });
  };

  const handleRunCreateRule = async () => {
    let payload: unknown;
    try {
      payload = JSON.parse(createRuleBody);
    } catch {
      setExampleResult({
        ok: false,
        status: 0,
        statusText: 'Invalid JSON',
        summary: 'Create rule body must be valid JSON'
      });
      toast.error('Create rule body must be valid JSON');
      return;
    }

    await runExampleRequest({
      method: 'POST',
      path: '/api/automation/rules',
      body: payload,
      successSummary: 'Created sample rule'
    });
  };

  const handleRunDeleteRule = async () => {
    if (!deleteTargetId) {
      setExampleResult({
        ok: false,
        status: 0,
        statusText: 'Missing rule id',
        summary: 'Create the sample rule first or paste a rule id to delete'
      });
      toast.error('Create the sample rule first or paste a rule id to delete');
      return;
    }

    await runExampleRequest({
      method: 'DELETE',
      path: `/api/automation/rules/${deleteTargetId}`,
      successSummary: `Deleted rule ${deleteTargetId}`
    });
  };

  const searchTermValue = searchTerm.trim().toLowerCase() || 'playground';
  const currentBaseUrl = normalizeBaseUrl(exampleBaseUrl) || automationBase;
  const currentApiKey = exampleApiKey.trim() || 'YOUR_API_KEY';

  const readRulesCurl = `curl ${shellQuote(`${currentBaseUrl}/api/automation/rules`)} \\
  -H ${shellQuote(`Authorization: Bearer ${currentApiKey}`)}`;

  const searchRulesCurl = `curl ${shellQuote(`${currentBaseUrl}/api/automation/rules`)} \\
  -H ${shellQuote(`Authorization: Bearer ${currentApiKey}`)} | jq --arg query ${shellQuote(searchTermValue)} '.[] | select(
    ((.name // "") | ascii_downcase | contains($query)) or
    ((.fileName // "") | ascii_downcase | contains($query)) or
    ((.routerName // "") | ascii_downcase | contains($query)) or
    ((.serviceName // "") | ascii_downcase | contains($query)) or
    ((.hostname // "") | ascii_downcase | contains($query))
  )'`;

  const createRuleCurl = `curl -X POST ${shellQuote(`${currentBaseUrl}/api/automation/rules`)} \\
  -H ${shellQuote(`Authorization: Bearer ${currentApiKey}`)} \\
  -H 'Content-Type: application/json' \\
  --data-raw ${shellQuote(createRuleBody)}`;

  const deleteRuleCurl = `curl -X DELETE ${shellQuote(`${currentBaseUrl}${deleteTargetPath}`)} \\
  -H ${shellQuote(`Authorization: Bearer ${currentApiKey}`)}`;

  const activeCurlCommand = activeExampleTab === 'read'
    ? readRulesCurl
    : activeExampleTab === 'search'
      ? searchRulesCurl
      : activeExampleTab === 'create'
        ? createRuleCurl
        : deleteRuleCurl;

  const handleCopyCurl = async () => {
    try {
      await copyWithFallback(activeCurlCommand);
      toast.success('cURL command copied');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to copy cURL command');
    }
  };

  return (
    <div className="space-y-6">
      <AlertDialog open={Boolean(lastCreatedKey)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Copy Your One-Time API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This plaintext key is only shown once. Copy it now before closing this dialog.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Once you click Done, this value is removed from the UI and cannot be retrieved again from the server.
              </AlertDescription>
            </Alert>

            <div className="max-h-48 overflow-y-auto rounded-md border bg-slate-950 p-4 font-mono text-sm text-slate-100 break-all">
              {lastCreatedKey}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={handleCopyKey}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Key
              </Button>
              <AlertDialogAction onClick={onDismissLastCreatedKey}>
                Done
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open && !submitting) {
            setName('');
            setExpiresAt('');
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Create API Key
            </DialogTitle>
            <DialogDescription>
              The plaintext key is shown once in a follow-up modal. Store it immediately after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Key name</Label>
              <Input
                id="api-key-name"
                value={name}
                placeholder="GitHub Actions deploy"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key-expiry">Optional expiry</Label>
              <Input
                id="api-key-expiry"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                min={toDatetimeLocal(new Date().toISOString())}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting || loading || !name.trim()}>
              {submitting ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Existing Keys</CardTitle>
              <CardDescription>Revoked keys remain visible for auditability.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setCreateOpen(true)} disabled={loading}>
                <KeyRound className="mr-2 h-4 w-4" />
                Create API Key
              </Button>
              <Button variant="outline" onClick={onRefresh} disabled={loading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKeys.length === 0 ? (
            <p className="text-sm text-gray-500">No API keys created yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{key.name}</div>
                        <div className="text-xs text-gray-500">Created by {key.createdBy}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{key.prefix}</TableCell>
                    <TableCell>{formatDate(key.createdAt)}</TableCell>
                    <TableCell>{formatDate(key.lastUsedAt)}</TableCell>
                    <TableCell>{key.expiresAt ? formatDate(key.expiresAt) : 'No expiry'}</TableCell>
                    <TableCell>
                      {key.revokedAt ? (
                        <Badge variant="destructive">Revoked</Badge>
                      ) : key.expiresAt && new Date(key.expiresAt).getTime() < Date.now() ? (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">Expired</Badge>
                      ) : (
                        <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRevoke(key.id)}
                          disabled={loading || Boolean(key.revokedAt)}
                        >
                          Revoke
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                              <AlertDialogDescription>
                                Delete "{key.name}" permanently. This removes it from the audit list and any clients using it will stop working immediately.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => onDelete(key.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            Static copy-paste templates for common automation client setups.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="curl" className="gap-4">
            <TabsList className="w-full justify-start sm:w-auto">
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="github-actions">GitHub Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="curl" className="space-y-3">
              <div className="text-sm text-gray-600">
                Use this as a starting point for bearer-authenticated automation requests.
              </div>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
{`curl -X POST "$TRM_BASE_URL/api/automation/rules" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"example","hostname":"example.com","backendUrl":["http://app:8080"],"entryPoints":["web"],"tls":true}'`}
              </pre>
            </TabsContent>

            <TabsContent value="github-actions" className="space-y-3">
              <div className="text-sm text-gray-600">
                Store the plaintext key in <span className="font-mono">TRM_API_KEY</span> and point <span className="font-mono">TRM_BASE_URL</span> at this service.
              </div>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
{`- name: Create Traefik rule
  run: |
    curl -X POST "$TRM_BASE_URL/api/automation/rules" \\
      -H "Authorization: Bearer $TRM_API_KEY" \\
      -H "Content-Type: application/json" \\
      -d '{"name":"github-action","hostname":"gh.example.com","backendUrl":["http://app:8080"],"entryPoints":["web"],"tls":true}'`}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Examples</CardTitle>
          <CardDescription>
            Build a ready-to-run cURL command with your current base URL and bearer key, then execute it here and inspect the response inline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="live-example-base-url">Base URL</Label>
              <Input
                id="live-example-base-url"
                value={exampleBaseUrl}
                placeholder="http://localhost:3001"
                onChange={(event) => setExampleBaseUrl(event.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="live-example-api-key">Plaintext API key</Label>
              <Textarea
                id="live-example-api-key"
                value={exampleApiKey}
                placeholder="trm_xxxxxxxx_your_saved_secret"
                onChange={(event) => setExampleApiKey(event.target.value)}
                className="min-h-20 font-mono text-sm"
              />
            </div>
          </div>

          <Tabs value={activeExampleTab} onValueChange={(value) => setActiveExampleTab(value as ExampleTab)} className="gap-4">
            <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="read">Read All Existing Rules</TabsTrigger>
              <TabsTrigger value="search">Search For A Specific Rule</TabsTrigger>
              <TabsTrigger value="create">Create A New Rule</TabsTrigger>
              <TabsTrigger value="delete">Delete A Specific Rule</TabsTrigger>
            </TabsList>

            <TabsContent value="read" className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  Fetch the full list of automation-managed rules from the current server.
                </div>
              </div>
            </TabsContent>

            <TabsContent value="search" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search-rule-term">Search term</Label>
                <Input
                  id="search-rule-term"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="portainer"
                />
              </div>
              <div className="text-sm text-gray-600">
                Run a list request, then filter the response by name, file, router, service, or hostname.
              </div>
            </TabsContent>

            <TabsContent value="create" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-rule-body">Rule JSON</Label>
                <Textarea
                  id="create-rule-body"
                  value={createRuleBody}
                  onChange={(event) => setCreateRuleBody(event.target.value)}
                  className="min-h-48 font-mono text-sm"
                />
              </div>
              <div className="text-sm text-gray-600">
                Start from the sample payload, adjust it, then create a rule through the automation API.
              </div>
            </TabsContent>

            <TabsContent value="delete" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="delete-rule-id">Rule id</Label>
                <Input
                  id="delete-rule-id"
                  value={deleteRuleIdOverride}
                  placeholder={sampleRule?.id || 'Create the sample rule first or paste a rule id'}
                  onChange={(event) => setDeleteRuleIdOverride(event.target.value)}
                />
              </div>
              <Alert>
                <AlertDescription>
                  {sampleRule
                    ? `Detected sample rule "${sampleRule.name}" and will use it by default unless you provide another id.`
                    : 'No sample rule is currently detected. Create the sample first or paste a valid rule id.'}
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Generated cURL</div>
                  <div className="text-sm text-gray-600">
                    This command uses the base URL and plaintext key currently entered above.
                  </div>
                </div>
                <Button variant="outline" onClick={handleCopyCurl}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy cURL
                </Button>
              </div>

              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">{activeCurlCommand}</pre>

              <div className="flex flex-wrap items-center gap-3">
                {activeExampleTab === 'read' && (
                  <Button onClick={handleRunReadRules} disabled={exampleBusy || !exampleApiKey.trim() || !exampleBaseUrl.trim()}>
                    {exampleBusy ? 'Running...' : 'Run Example'}
                  </Button>
                )}
                {activeExampleTab === 'search' && (
                  <Button onClick={handleRunSearchRules} disabled={exampleBusy || !exampleApiKey.trim() || !exampleBaseUrl.trim()}>
                    {exampleBusy ? 'Running...' : 'Run Example'}
                  </Button>
                )}
                {activeExampleTab === 'create' && (
                  <Button onClick={handleRunCreateRule} disabled={exampleBusy || !exampleApiKey.trim() || !exampleBaseUrl.trim()}>
                    {exampleBusy ? 'Running...' : 'Run Example'}
                  </Button>
                )}
                {activeExampleTab === 'delete' && (
                  <Button
                    onClick={handleRunDeleteRule}
                    disabled={exampleBusy || !exampleApiKey.trim() || !exampleBaseUrl.trim() || !deleteTargetId}
                  >
                    {exampleBusy ? 'Running...' : 'Run Example'}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-xl border bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Latest Response</div>
                  <div className="text-sm text-gray-600">
                    Run an example to inspect the status and response payload here.
                  </div>
                </div>
                {exampleResult && (
                  <Badge
                    variant="outline"
                    className={exampleResult.ok
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : 'border-red-300 bg-red-50 text-red-700'}
                  >
                    {exampleResult.ok ? (
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                    ) : (
                      <XCircle className="mr-1 h-3 w-3" />
                    )}
                    {exampleResult.status === 0
                      ? exampleResult.statusText
                      : `${exampleResult.status} ${exampleResult.statusText}`}
                  </Badge>
                )}
              </div>

              {exampleResult ? (
                <div className="space-y-3">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{exampleResult.method}</span>{' '}
                    <span className="font-mono text-xs">{exampleResult.path}</span>
                  </div>
                  <p className="text-sm text-gray-600">{exampleResult.summary}</p>
                  <pre className="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
                    {exampleResult.responseBody}
                  </pre>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-gray-500">
                  No example has been run yet.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
