import { useState } from 'react';
import { FolderOpen, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

type DirectorySetupProps = {
  onLoad: () => Promise<void>;
  loading?: boolean;
};

export default function DirectorySetup({ onLoad, loading = false }: DirectorySetupProps) {
  const [error, setError] = useState('');

  const handleLoad = async () => {
    setError('');
    try {
      await onLoad();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-3">
              <FolderOpen className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">Traefik Rules Manager</CardTitle>
              <CardDescription>Connect to the backend and load the configured Traefik dynamic directory.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The backend determines the live Traefik config path from its environment. This step checks connectivity and loads the current rules.
            </AlertDescription>
          </Alert>

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

          <div className="border-t pt-4">
            <h3 className="mb-3">Requirements</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-green-600">✓</span>
                <span>Backend must be reachable and authenticated</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-green-600">✓</span>
                <span>Backend processes `.yml` and `.yaml` files from its configured directory</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-green-600">✓</span>
                <span>Traefik dynamic config should remain a flat directory with no subfolders</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
