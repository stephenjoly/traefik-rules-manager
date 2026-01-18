import { useState } from 'react';
import { FolderOpen, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

type DirectorySetupProps = {
  onLoad: (path?: string) => Promise<void>;
  loading?: boolean;
};

export default function DirectorySetup({ onLoad, loading = false }: DirectorySetupProps) {
  const [path, setPath] = useState('/config/dynamic');
  const [error, setError] = useState('');

  const handleLoad = async () => {
    setError('');
    try {
      await onLoad(path);
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
              <CardDescription>Select your Traefik dynamic configuration directory</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This application manages Traefik dynamic configuration files. 
                Choose the directory where your Traefik YAML rules live.
              </AlertDescription>
            </Alert>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="directory" className="block">
                Traefik Dynamic Config Path
              </label>
              <Input
                id="directory"
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/config/dynamic"
                className="font-mono"
              />
              <p className="text-sm text-gray-500">
                Absolute path on the server/container where Traefik watches for dynamic config
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
                <span>Backend must be reachable (same server/container as this UI)</span>
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
