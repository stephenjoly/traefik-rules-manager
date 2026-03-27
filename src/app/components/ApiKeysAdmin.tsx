import { useMemo, useState } from 'react';
import { Copy, KeyRound, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { ApiKeyRecord } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './ui/table';

type ApiKeysAdminProps = {
  apiKeys: ApiKeyRecord[];
  loading?: boolean;
  lastCreatedKey: string | null;
  onDismissLastCreatedKey: () => void;
  onCreate: (input: { name: string; expiresAt?: string }) => Promise<void>;
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
  onCreate,
  onRefresh,
  onRevoke
}: ApiKeysAdminProps) {
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Create API Key
            </CardTitle>
            <CardDescription>Keys are shown once. Store the plaintext immediately after creation.</CardDescription>
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
            <div className="flex items-center gap-3">
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
            <CardTitle>One-Time Secret</CardTitle>
            <CardDescription>New plaintext keys open in a dedicated one-time modal instead of persisting on the page.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription>
                  After you create a key, a modal appears so you can copy it once and explicitly dismiss it.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-gray-600">
                Plaintext secrets are never shown again after you click Done.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRevoke(key.id)}
                        disabled={loading || Boolean(key.revokedAt)}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>cURL</CardTitle>
            <CardDescription>Automation clients call the dedicated bearer-authenticated endpoints.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">{curlExample}</pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>GitHub Actions</CardTitle>
            <CardDescription>Store the plaintext key in `TRM_API_KEY` and point `TRM_BASE_URL` at this service.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">{actionsSnippet}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
