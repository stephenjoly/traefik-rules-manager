import { useState } from 'react';
import { ArrowLeft, Code2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import type { RulePayload, TraefikRule } from '../types';
import Editor from '@monaco-editor/react';
import SimpleEdit from './SimpleEdit';
import * as yaml from 'js-yaml';

type EditRuleProps = {
  rule: TraefikRule;
  onSave: (payload: RulePayload) => Promise<void>;
  onCancel: () => void;
  existingMiddlewares: string[];
};

export default function EditRule({
  rule,
  onSave,
  onCancel,
  existingMiddlewares,
}: EditRuleProps) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [yamlContent, setYamlContent] = useState(rule.yamlContent);
  const [yamlError, setYamlError] = useState('');

  const handleSimpleSave = async (payload: RulePayload) => {
    await onSave(payload);
  };

  const handleAdvancedSave = async () => {
    try {
      // Validate YAML
      const parsed = yaml.load(yamlContent);
      setYamlError('');

      const config = parsed as any;
      const routerName = Object.keys(config?.http?.routers || {})[0] || rule.name;
      const router = config?.http?.routers?.[routerName];
      const payload: RulePayload = {
        name: routerName,
        hostname: router?.rule ? extractHostname(router.rule) : rule.hostname,
        backendUrl: config?.http?.services?.[routerName]?.loadBalancer?.servers?.map((s: any) => s.url) || rule.backendUrl,
        entryPoints: router?.entryPoints || rule.entryPoints,
        tls: !!router?.tls,
        middlewares: router?.middlewares,
        priority: router?.priority,
        certResolver: router?.tls?.certResolver,
        passHostHeader: config?.http?.services?.[routerName]?.loadBalancer?.passHostHeader,
        stickySession: Boolean(config?.http?.services?.[routerName]?.loadBalancer?.sticky),
        healthCheckPath: config?.http?.services?.[routerName]?.loadBalancer?.healthCheck?.path,
        healthCheckInterval: config?.http?.services?.[routerName]?.loadBalancer?.healthCheck?.interval,
      };

      await onSave(payload);
    } catch (error) {
      setYamlError(error instanceof Error ? error.message : 'Invalid YAML');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="ghost" onClick={onCancel} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Edit Rule: {rule.name}</CardTitle>
            <CardDescription>
              Modify this reverse proxy configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'simple' | 'advanced')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="simple">Simple Mode</TabsTrigger>
                <TabsTrigger value="advanced">
                  <Code2 className="w-4 h-4 mr-2" />
                  Advanced (YAML)
                </TabsTrigger>
              </TabsList>

              <TabsContent value="simple" className="mt-6">
                <SimpleEdit
                  rule={rule}
                  onSave={handleSimpleSave}
                  onCancel={onCancel}
                  existingMiddlewares={existingMiddlewares}
                />
              </TabsContent>

              <TabsContent value="advanced" className="mt-6">
                <div className="space-y-4">
                  <div className="border rounded-md overflow-hidden">
                    <Editor
                      height="500px"
                      defaultLanguage="yaml"
                      value={yamlContent}
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
                    <Button onClick={handleAdvancedSave} size="lg">
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={onCancel}>
                      Cancel
                    </Button>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Advanced Mode:</strong> You have full control over the YAML configuration. 
                      Make sure to maintain valid Traefik configuration schema.
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

function extractHostname(rule: string): string {
  const match = rule.match(/Host\(`([^`]+)`\)/);
  return match ? match[1] : '';
}
