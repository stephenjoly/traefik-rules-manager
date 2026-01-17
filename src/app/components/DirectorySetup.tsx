import { useState } from 'react';
import { FolderOpen, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

type DirectorySetupProps = {
  onLoad: (apiBase: string) => Promise<void>;
  loading?: boolean;
  defaultApiBase?: string;
};

export default function DirectorySetup({ onLoad, loading = false, defaultApiBase = 'http://localhost:3001' }: DirectorySetupProps) {
  const [apiBase, setApiBase] = useState(defaultApiBase);
  const [error, setError] = useState('');

  const handleLoad = async () => {
    setError('');
    if (!apiBase.trim()) {
      setError('Please enter a valid API base URL');
      return;
    }

    try {
      await onLoad(apiBase);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FolderOpen className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">Traefik Rules Manager</CardTitle>
              <CardDescription>Connect to your Traefik Rules Manager API</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This application manages Traefik dynamic configuration files. 
                Point it to your running Traefik Rules Manager API.
              </AlertDescription>
            </Alert>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="directory" className="block">
                API Base URL
              </label>
              <Input
                id="directory"
                type="text"
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                placeholder="http://localhost:3001"
                className="font-mono"
              />
              <p className="text-sm text-gray-500">
                URL where Traefik Rules Manager API is running
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleLoad}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? 'Loading...' : 'Load Configuration'}
            </Button>
          </div>

          <div className="pt-4 border-t">
            <h3 className="mb-3">Requirements</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>API must be reachable from your browser</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Backend will process .yml and .yaml files in your configured directory</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Flat directory structure (no subfolders)</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
