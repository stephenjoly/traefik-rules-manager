import { ArrowLeft, ExternalLink, KeyRound, LogOut } from 'lucide-react';
import type { ApiKeyRecord } from '../types';
import ApiKeysAdmin from './ApiKeysAdmin';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

type ApiKeysPageProps = {
  apiKeys: ApiKeyRecord[];
  loading?: boolean;
  lastCreatedKey: string | null;
  username?: string;
  onBack: () => void;
  onDismissLastCreatedKey: () => void;
  apiDocsUrl: string;
  onCreate: (input: { name: string; expiresAt?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
  onLogout: () => void;
};

export default function ApiKeysPage({
  apiKeys,
  loading = false,
  lastCreatedKey,
  username,
  onBack,
  onDismissLastCreatedKey,
  apiDocsUrl,
  onCreate,
  onDelete,
  onRefresh,
  onRevoke,
  onLogout
}: ApiKeysPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Button variant="ghost" className="-ml-3 w-fit" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-slate-700" />
                  <h1 className="text-3xl">Automation API Keys</h1>
                </div>
                <p className="max-w-3xl text-sm text-gray-600">
                  Create, revoke, and permanently delete bearer credentials for automation clients without squeezing the workflow into a modal.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {username && (
                <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                  Signed in as {username}
                </Badge>
              )}
              <Button variant="ghost" onClick={onLogout} disabled={loading}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Test the API</CardTitle>
            <CardDescription>
              Use the interactive docs to sign in, create a key, and exercise both admin and automation endpoints directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Open the Swagger UI, call <span className="font-mono">POST /api/auth/login</span>, then try the admin key endpoints or bearer-authenticated automation routes.
            </p>
            <Button asChild>
              <a href={apiDocsUrl} target="_blank" rel="noreferrer">
                Open API Docs
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>

        <ApiKeysAdmin
          apiKeys={apiKeys}
          loading={loading}
          lastCreatedKey={lastCreatedKey}
          onDismissLastCreatedKey={onDismissLastCreatedKey}
          onCreate={onCreate}
          onDelete={onDelete}
          onRefresh={onRefresh}
          onRevoke={onRevoke}
        />
      </div>
    </div>
  );
}
