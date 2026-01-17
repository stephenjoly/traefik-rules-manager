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
  apiUpdateRule
} from './api';

type View = 'setup' | 'dashboard' | 'add' | 'edit';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('setup');
  const [apiBase, setApiBase] = useState<string>(import.meta.env.VITE_API_BASE || 'http://localhost:3001');
  const [workingDirectory, setWorkingDirectory] = useState<string>('');
  const [rules, setRules] = useState<TraefikRule[]>([]);
  const [existingMiddlewares, setExistingMiddlewares] = useState<string[]>([]);
  const [selectedRule, setSelectedRule] = useState<TraefikRule | null>(null);
  const [loading, setLoading] = useState(false);

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

  const handleDirectoryLoad = async (base: string) => {
    setLoading(true);
    try {
      const health = await apiGetHealth(base);
      await loadRules(base);
      await loadMiddlewares(base);
      setApiBase(base);
      setWorkingDirectory(health.configPath || base);
      setCurrentView('dashboard');
      toast.success(`Connected to API at ${base}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load';
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleAddProxy = () => {
    setCurrentView('add');
  };

  const handleEditRule = (rule: TraefikRule) => {
    setSelectedRule(rule);
    setCurrentView('edit');
  };

  const handleDeleteRule = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    await apiDeleteRule(apiBase, ruleId);
    setRules(rules.filter(r => r.id !== ruleId));
    if (rule) {
      toast.success(`Deleted rule: ${rule.name}`);
    } else {
      toast.success('Deleted rule');
    }
  };

  const handleSaveNewProxy = async (payload: RulePayload) => {
    const created = await apiCreateRule(apiBase, payload);
    const mapped = mapRule(created);
    setRules([...rules, mapped]);
    setCurrentView('dashboard');
    toast.success(`Created new reverse proxy: ${mapped.name}`);
  };

  const handleSaveEditedRule = async (id: string, payload: RulePayload) => {
    const updated = await apiUpdateRule(apiBase, id, payload);
    const mapped = mapRule(updated);
    setRules(rules.map(r => r.id === mapped.id ? mapped : r));
    setCurrentView('dashboard');
    toast.success(`Updated rule: ${mapped.name}`);
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedRule(null);
  };

  const handleReload = async () => {
    toast.info('Reloading configuration files...');
    await apiResync(apiBase);
    await loadRules(apiBase);
    toast.success('Configuration reloaded');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" richColors />
      
      {currentView === 'setup' && (
        <DirectorySetup onLoad={handleDirectoryLoad} loading={loading} defaultApiBase={apiBase} />
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
        />
      )}

      {currentView === 'add' && (
        <AddReverseProxy
          onSave={handleSaveNewProxy}
          onCancel={handleBackToDashboard}
          existingMiddlewares={existingMiddlewares}
        />
      )}

      {currentView === 'edit' && selectedRule && (
        <EditRule
          rule={selectedRule}
          onSave={(payload) => handleSaveEditedRule(selectedRule.id, payload)}
          onCancel={handleBackToDashboard}
          existingMiddlewares={existingMiddlewares}
        />
      )}
    </div>
  );
}
