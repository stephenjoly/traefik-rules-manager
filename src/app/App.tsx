import { useState } from 'react';
import { Toaster, toast } from 'sonner';
import DirectorySetup from './components/DirectorySetup';
import Dashboard from './components/Dashboard';
import AddReverseProxy from './components/AddReverseProxy';
import EditRule from './components/EditRule';
import { RulePayload, TraefikRule } from './types';
import {
  apiCreateRule,
  apiDeleteRule,
  apiGetHealth,
  apiGetMiddlewares,
  apiGetRules,
  apiResync,
  apiUpdateRule,
  apiSetDynamicPath
} from './api';
import { useEffect } from 'react';
import { duplicateRule } from './utils/rules';

type View = 'setup' | 'dashboard' | 'add' | 'edit';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('setup');
  const [apiBase, setApiBase] = useState<string>(import.meta.env.VITE_API_BASE || 'http://localhost:3001');
  const [workingDirectory, setWorkingDirectory] = useState<string>('');
  const [rules, setRules] = useState<TraefikRule[]>([]);
  const [existingMiddlewares, setExistingMiddlewares] = useState<string[]>([]);
  const [selectedRule, setSelectedRule] = useState<TraefikRule | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [autoConnectTried, setAutoConnectTried] = useState(false);
  const [draftRule, setDraftRule] = useState<RulePayload | null>(null);

  const mapRule = (rule: any): TraefikRule => ({
    ...rule,
    lastModified: new Date(rule.lastModified || Date.now()),
    isValid: rule.isValid ?? true,
    validationErrors: rule.validationErrors || []
  });

  const loadRules = async (base: string) => {
    const data = await apiGetRules(base);
    setRules(data.map(mapRule));
  };

  const loadMiddlewares = async (base: string) => {
    const data = await apiGetMiddlewares(base);
    setExistingMiddlewares(data);
  };

  const handleDirectoryLoad = async (path?: string) => {
    setLoading(true);
    try {
      if (path) {
        await apiSetDynamicPath(apiBase, path);
      }
      const health = await apiGetHealth(apiBase);
      await loadRules(apiBase);
      await loadMiddlewares(apiBase);
      const resolvedPath = health.configPath || path || workingDirectory || '/config/dynamic';
      setWorkingDirectory(resolvedPath);
      setCurrentView('dashboard');
      toast.success(`Connected to Traefik config at ${health.configPath || path || apiBase}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load';
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Attempt auto-connect on first load
  useEffect(() => {
    if (autoConnectTried) return;
    setAutoConnectTried(true);
    handleDirectoryLoad().catch(() => {
      // keep setup view if it fails
    });
  }, [autoConnectTried, apiBase]);

  const handleAddProxy = () => {
    setDraftRule(null);
    setCurrentView('add');
  };

  const handleEditRule = (rule: TraefikRule) => {
    const baseName = rule.fileName ? rule.fileName.replace(/\.ya?ml$/i, '') : rule.name;
    setSelectedRule({ ...rule, name: baseName });
    setDraftRule(null);
    setCurrentView('edit');
  };

  const handleDeleteRule = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    setActionLoading(true);
    try {
      await apiDeleteRule(apiBase, ruleId);
      setRules(rules.filter(r => r.id !== ruleId));
      toast.success(`Deleted rule: ${rule ? rule.name : 'rule'}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete rule';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNewProxy = async (payload: RulePayload) => {
    setActionLoading(true);
    try {
      const created = await apiCreateRule(apiBase, payload);
      const mapped = mapRule(created);
      setRules([...rules, mapped]);
      setCurrentView('dashboard');
      toast.success(`Created new reverse proxy: ${mapped.name}`);
    } catch (err) {
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
      const updated = await apiUpdateRule(apiBase, id, payload);
      const mapped = mapRule(updated);
      setRules(rules.map(r => r.id === mapped.id ? mapped : r));
      setCurrentView('dashboard');
      toast.success(`Updated rule: ${mapped.name}`);
    } catch (err) {
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
  };

  const handleReload = async () => {
    setActionLoading(true);
    toast.info('Reloading configuration files...');
    try {
      await apiResync(apiBase);
      await loadRules(apiBase);
      toast.success('Configuration reloaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reload';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" richColors />
      
      {currentView === 'setup' && (
        <DirectorySetup onLoad={handleDirectoryLoad} loading={loading} />
      )}

      {currentView === 'dashboard' && (
        <Dashboard
          workingDirectory={workingDirectory}
          rules={rules}
          onAddProxy={handleAddProxy}
          onEditRule={handleEditRule}
          onDeleteRule={handleDeleteRule}
          onReload={handleReload}
          onChangeDirectory={() => setCurrentView('setup')}
          busy={actionLoading}
        />
      )}

      {currentView === 'add' && (
        <AddReverseProxy
          onSave={handleSaveNewProxy}
          onCancel={handleBackToDashboard}
          existingMiddlewares={existingMiddlewares}
          templates={rules}
          initialValue={draftRule || undefined}
          defaultTemplateId={draftRule ? draftRule.name : undefined}
        />
      )}

      {currentView === 'edit' && selectedRule && (
        <EditRule
          rule={selectedRule}
          onSave={(payload) => handleSaveEditedRule(selectedRule.id, payload)}
          onCancel={handleBackToDashboard}
          existingMiddlewares={existingMiddlewares}
          onDuplicate={() => {
            setDraftRule(duplicateRule(selectedRule));
            setCurrentView('add');
          }}
        />
      )}
    </div>
  );
}
