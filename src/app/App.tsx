import { useEffect, useState } from 'react';
import { loader } from '@monaco-editor/react';
import { Toaster, toast } from 'sonner';
import DirectorySetup from './components/DirectorySetup';
import Dashboard from './components/Dashboard';
import AddReverseProxy from './components/AddReverseProxy';
import EditRule from './components/EditRule';
import LoginScreen from './components/LoginScreen';
import ApiKeysAdmin from './components/ApiKeysAdmin';
import {
  apiCreateApiKey,
  apiCreateRule,
  apiDeleteRule,
  apiGetApiKeys,
  apiGetHealth,
  apiGetMiddlewares,
  apiGetRules,
  apiGetSession,
  apiLogin,
  apiLogout,
  apiResync,
  apiRevokeApiKey,
  apiUpdateRule
} from './api';
import {
  ApiKeyRecord,
  AuthSession,
  RulePayload,
  TraefikRule
} from './types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from './components/ui/dialog';
import { duplicateRule } from './utils/rules';

type View = 'setup' | 'dashboard';
type ApiError = Error & { status?: number };

function resolveDefaultApiBase() {
  const envBase = (import.meta.env.VITE_API_BASE as string | undefined) || '';
  if (envBase.trim()) return envBase.trim();
  return '';
}

function isUnauthorized(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && (error as ApiError).status === 401;
}

export default function App() {
  loader.config({ paths: { vs: '/monaco/vs' } });

  const [currentView, setCurrentView] = useState<View>('setup');
  const [apiBase] = useState<string>(resolveDefaultApiBase());
  const [workingDirectory, setWorkingDirectory] = useState<string>('');
  const [rules, setRules] = useState<TraefikRule[]>([]);
  const [existingMiddlewares, setExistingMiddlewares] = useState<string[]>([]);
  const [selectedRule, setSelectedRule] = useState<TraefikRule | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [autoConnectTried, setAutoConnectTried] = useState(false);
  const [draftRule, setDraftRule] = useState<RulePayload | null>(null);
  const [draftTemplateId, setDraftTemplateId] = useState<string | undefined>(undefined);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [lastCreatedKey, setLastCreatedKey] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession>({
    authEnabled: true,
    authenticated: false
  });

  const mapRule = (rule: any): TraefikRule => ({
    ...rule,
    lastModified: new Date(rule.lastModified || Date.now()),
    isValid: rule.isValid ?? true,
    validationErrors: rule.validationErrors || []
  });

  const handleUnauthorized = () => {
    setSession({
      authEnabled: true,
      authenticated: false
    });
    setCurrentView('setup');
    setAutoConnectTried(false);
    setAdminOpen(false);
    setRules([]);
    setExistingMiddlewares([]);
    toast.error('Your session expired. Sign in again.');
  };

  const loadRules = async () => {
    const data = await apiGetRules(apiBase);
    setRules(data.map(mapRule));
  };

  const loadMiddlewares = async () => {
    const data = await apiGetMiddlewares(apiBase);
    setExistingMiddlewares(data);
  };

  const loadApiKeys = async () => {
    setApiKeysLoading(true);
    try {
      const data = await apiGetApiKeys(apiBase);
      setApiKeys(data);
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setApiKeysLoading(false);
    }
  };

  const refreshSession = async () => {
    setAuthLoading(true);
    try {
      const nextSession = await apiGetSession(apiBase);
      setSession(nextSession);
    } catch (err) {
      if (isUnauthorized(err)) {
        setSession({
          authEnabled: true,
          authenticated: false
        });
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to check session');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDirectoryLoad = async () => {
    setLoading(true);
    try {
      const health = await apiGetHealth(apiBase);
      await loadRules();
      await loadMiddlewares();
      const resolvedPath = health.configPath || workingDirectory || '/config/dynamic';
      setWorkingDirectory(resolvedPath);
      setCurrentView('dashboard');
      toast.success(`Connected to Traefik config at ${resolvedPath}`);
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Failed to load';
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  useEffect(() => {
    if (authLoading || autoConnectTried) return;
    if (session.authEnabled && !session.authenticated) return;
    setAutoConnectTried(true);
    handleDirectoryLoad().catch(() => {
      // stay on setup view if connection fails
    });
  }, [authLoading, autoConnectTried, session.authEnabled, session.authenticated]);

  const handleLogin = async (username: string, password: string) => {
    setLoginLoading(true);
    try {
      const nextSession = await apiLogin(apiBase, username, password);
      setSession(nextSession);
      setAutoConnectTried(false);
      toast.success('Signed in');
    } catch (err) {
      throw err;
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    setActionLoading(true);
    try {
      await apiLogout(apiBase);
      setSession({
        authEnabled: true,
        authenticated: false
      });
      setCurrentView('setup');
      setAutoConnectTried(false);
      setAdminOpen(false);
      setRules([]);
      setExistingMiddlewares([]);
      setLastCreatedKey(null);
      toast.success('Signed out');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign out');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddProxy = () => {
    setDraftRule(null);
    setDraftTemplateId(undefined);
    setAddOpen(true);
  };

  const handleEditRule = (rule: TraefikRule) => {
    const baseName = rule.fileName ? rule.fileName.replace(/\.ya?ml$/i, '') : rule.name;
    setSelectedRule({ ...rule, name: baseName });
    setDraftRule(null);
    setDraftTemplateId(undefined);
    setEditOpen(true);
  };

  const handleDeleteRule = async (ruleId: string) => {
    const rule = rules.find((entry) => entry.id === ruleId);
    setActionLoading(true);
    try {
      await apiDeleteRule(apiBase, ruleId);
      await loadRules();
      toast.success(`Deleted rule: ${rule ? rule.name : 'rule'}`);
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to delete rule';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNewProxy = async (payload: RulePayload) => {
    setActionLoading(true);
    try {
      await apiCreateRule(apiBase, payload);
      setCurrentView('dashboard');
      setAddOpen(false);
      setDraftTemplateId(undefined);
      await loadRules();
      toast.success(`Created new reverse proxy: ${payload.name}`);
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Failed to create rule';
      toast.error(message);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEditedRule = async (id: string, payload: RulePayload) => {
    setActionLoading(true);
    try {
      await apiUpdateRule(apiBase, id, payload);
      setCurrentView('dashboard');
      setEditOpen(false);
      setDraftTemplateId(undefined);
      await loadRules();
      toast.success(`Updated rule: ${payload.name}`);
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Failed to update rule';
      toast.error(message);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedRule(null);
    setDraftRule(null);
    setDraftTemplateId(undefined);
  };

  const handleReload = async () => {
    setActionLoading(true);
    toast.info('Reloading configuration files...');
    try {
      await apiResync(apiBase);
      await loadRules();
      toast.success('Configuration reloaded');
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to reload';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenAdmin = async () => {
    setAdminOpen(true);
    await loadApiKeys();
  };

  const handleCreateApiKey = async (input: { name: string; expiresAt?: string }) => {
    try {
      const created = await apiCreateApiKey(apiBase, input);
      setLastCreatedKey(created.apiKey);
      toast.success(`Created API key: ${created.record.name}`);
      await loadApiKeys();
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Failed to create API key');
      throw err;
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    try {
      await apiRevokeApiKey(apiBase, id);
      toast.success('API key revoked');
      await loadApiKeys();
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Failed to revoke API key');
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        Checking admin session...
      </div>
    );
  }

  if (session.authEnabled && !session.authenticated) {
    return (
      <>
        <Toaster position="bottom-center" richColors />
        <LoginScreen loading={loginLoading} onLogin={handleLogin} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="bottom-center" richColors />

      {currentView === 'setup' && (
        <DirectorySetup onLoad={handleDirectoryLoad} loading={loading} />
      )}

      {currentView === 'dashboard' && (
        <>
          <Dashboard
            workingDirectory={workingDirectory}
            rules={rules}
            onAddProxy={handleAddProxy}
            onEditRule={handleEditRule}
            onDeleteRule={handleDeleteRule}
            onReload={handleReload}
            onChangeDirectory={() => setCurrentView('setup')}
            onManageApiKeys={handleOpenAdmin}
            onLogout={handleLogout}
            username={session.username}
            busy={actionLoading}
          />

          <Dialog
            open={adminOpen}
            onOpenChange={(open) => {
              setAdminOpen(open);
              if (!open) {
                setLastCreatedKey(null);
              }
            }}
          >
            <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
              <DialogTitle>Automation API Keys</DialogTitle>
              <DialogDescription>Create one-time secrets for remote rule management.</DialogDescription>
              <ApiKeysAdmin
                apiKeys={apiKeys}
                loading={apiKeysLoading}
                lastCreatedKey={lastCreatedKey}
                onCreate={handleCreateApiKey}
                onRefresh={loadApiKeys}
                onRevoke={handleRevokeApiKey}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) handleBackToDashboard(); }}>
            <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
              <DialogTitle className="sr-only">Add Reverse Proxy</DialogTitle>
              <DialogDescription className="sr-only">Create a new Traefik reverse proxy configuration.</DialogDescription>
              <AddReverseProxy
                onSave={handleSaveNewProxy}
                onCancel={() => { setAddOpen(false); handleBackToDashboard(); }}
                existingMiddlewares={existingMiddlewares}
                templates={rules}
                initialValue={draftRule || undefined}
                defaultTemplateId={draftTemplateId}
              />
            </DialogContent>
          </Dialog>

          {selectedRule && (
            <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) handleBackToDashboard(); }}>
              <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
                <DialogTitle className="sr-only">Edit Reverse Proxy</DialogTitle>
                <DialogDescription className="sr-only">Edit this Traefik reverse proxy configuration.</DialogDescription>
                <EditRule
                  rule={selectedRule}
                  onSave={(payload) => handleSaveEditedRule(selectedRule.id, payload)}
                  onCancel={() => { setEditOpen(false); handleBackToDashboard(); }}
                  existingMiddlewares={existingMiddlewares}
                  onDuplicate={() => {
                    setDraftRule(duplicateRule(selectedRule, rules));
                    setDraftTemplateId(selectedRule.id);
                    setEditOpen(false);
                    setAddOpen(true);
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </div>
  );
}
