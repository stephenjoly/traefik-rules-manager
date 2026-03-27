import { useMemo, useState } from 'react';
import { CheckCircle2, Copy, KeyRound, RefreshCw, ShieldAlert, TerminalSquare, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiTestAutomationKey } from '../api';
import { ApiKeyRecord } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './ui/table';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

type ApiKeysAdminProps = {
  apiKeys: ApiKeyRecord[];
  loading?: boolean;
  lastCreatedKey: string | null;
  onDismissLastCreatedKey: () => void;
  automationTestUrl: string;
  onCreate: (input: { name: string; expiresAt?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
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

export default function ApiKeysAdmin({
  apiKeys,
  loading = false,
  lastCreatedKey,
  onDismissLastCreatedKey,
  automationTestUrl,
  onCreate,
  onDelete,
  onRefresh,
  onRevoke
}: ApiKeysAdminProps) {
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [testKey, setTestKey] = useState('');
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    status: number;
    statusText: string;
    body: unknown;
  } | null>(null);

  const activeKey = useMemo(() => apiKeys.find((key) => !key.revokedAt), [apiKeys]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await onCreate({
        name,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined
      });
      setName('');
      setExpiresAt('');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (value: string) => {
    if (navigator?.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
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
  };

  const handleCopyKey = async () => {
    if (!lastCreatedKey) return;

    try {
      await copyToClipboard(lastCreatedKey);
      toast.success('API key copied');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to copy API key');
    }
  };

  const curlExample = activeKey
    ? `curl -X POST "$TRM_BASE_URL/api/automation/rules" \\
  -H "Authorization: Bearer ${activeKey.prefix}_REDACTED" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"example","hostname":"example.com","backendUrl":["http://app:8080"],"entryPoints":["web"],"tls":true}'`
    : 'Create an API key to see a ready-to-use curl example.';

  const actionsSnippet = activeKey
    ? `- name: Create Traefik rule
  run: |
    curl -X POST "$TRM_BASE_URL/api/automation/rules" \\
      -H "Authorization: Bearer $TRM_API_KEY" \\
      -H "Content-Type: application/json" \\
      -d '{"name":"github-action","hostname":"gh.example.com","backendUrl":["http://app:8080"],"entryPoints":["web"],"tls":true}'`
    : 'Create an API key to see a GitHub Actions example.';

  const handleTestKey = async () => {
    setTestingKey(true);
    try {
      const base = automationTestUrl.replace(/\/api\/automation\/rules$/, '');
      const result = await apiTestAutomationKey(base, testKey.trim());
      setTestResult(result);
      if (result.ok) {
        toast.success('API key test succeeded');
      } else {
        toast.error(`API key test failed: ${result.status} ${result.statusText}`);
      }
    } catch (err) {
      setTestResult({
        ok: false,
        status: 0,
        statusText: 'Request failed',
        body: err instanceof Error ? { error: err.message } : { error: 'Request failed' }
      });
      toast.error(err instanceof Error ? err.message : 'Failed to test API key');
    } finally {
      setTestingKey(false);
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Create API Key
          </CardTitle>
          <CardDescription>Keys are shown once in a modal. Store the plaintext immediately after creation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="api-key-name" className="block text-sm">Key name</label>
            <Input
              id="api-key-name"
              value={name}
              placeholder="GitHub Actions deploy"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="api-key-expiry" className="block text-sm">Optional expiry</label>
            <Input
              id="api-key-expiry"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              min={toDatetimeLocal(new Date().toISOString())}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleCreate} disabled={submitting || loading || !name.trim()}>
              {submitting ? 'Creating...' : 'Create Key'}
            </Button>
            <Button variant="outline" onClick={onRefresh} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Keys</CardTitle>
          <CardDescription>Revoked keys remain visible for auditability.</CardDescription>
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
          <CardTitle className="flex items-center gap-2">
            <TerminalSquare className="h-5 w-5" />
            Interactive API Key Test
          </CardTitle>
          <CardDescription>
            Paste a plaintext API key and run a safe read-only check against <span className="font-mono">GET {automationTestUrl}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="api-key-tester" className="block text-sm">Plaintext API key</label>
            <Textarea
              id="api-key-tester"
              value={testKey}
              placeholder="trm_xxxxxxxx_your_saved_secret"
              onChange={(event) => setTestKey(event.target.value)}
              className="min-h-24 font-mono text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleTestKey} disabled={testingKey || !testKey.trim()}>
              {testingKey ? 'Testing...' : 'Test Key'}
            </Button>
            {testResult && (
              <Badge
                variant="outline"
                className={testResult.ok
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-red-300 bg-red-50 text-red-700'}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                ) : (
                  <XCircle className="mr-1 h-3 w-3" />
                )}
                {testResult.status === 0
                  ? testResult.statusText
                  : `${testResult.status} ${testResult.statusText}`}
              </Badge>
            )}
          </div>

          <Alert>
            <AlertDescription>
              Success means the bearer token can reach the automation API and list rules. Failure responses are shown exactly so you can debug auth or expiry issues.
            </AlertDescription>
          </Alert>

          {testResult && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Response</div>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(testResult.body, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>Reusable examples for automation clients. More template types can be added here without changing the page layout.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="curl" className="gap-4">
            <TabsList className="w-full justify-start sm:w-auto">
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="github-actions">GitHub Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="curl" className="space-y-3">
              <div className="text-sm text-gray-600">
                Automation clients call the dedicated bearer-authenticated endpoints.
              </div>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">{curlExample}</pre>
            </TabsContent>

            <TabsContent value="github-actions" className="space-y-3">
              <div className="text-sm text-gray-600">
                Store the plaintext key in <span className="font-mono">TRM_API_KEY</span> and point <span className="font-mono">TRM_BASE_URL</span> at this service.
              </div>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">{actionsSnippet}</pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
