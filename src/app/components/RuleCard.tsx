import { Edit2, Trash2, Globe, Server, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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
import type { TraefikRule } from '../types';

type RuleCardProps = {
  rule: TraefikRule;
  onEdit: () => void;
  onDelete: () => void;
};

export default function RuleCard({ rule, onEdit, onDelete }: RuleCardProps) {
  return (
    <Card className={rule.isValid ? '' : 'border-red-300'}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl">{rule.name}</CardTitle>
              {rule.isValid ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Valid
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Invalid
                </Badge>
              )}
              {rule.tls && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Shield className="w-3 h-3 mr-1" />
                  TLS
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1 font-mono">{rule.fileName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{rule.name}"? This will remove the file from disk and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Hostnames */}
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Globe className="w-4 h-4" />
              <span>Hostnames</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {rule.hostname.map((host, idx) => (
                <Badge key={idx} variant="secondary" className="font-mono">
                  {host}
                </Badge>
              ))}
            </div>
          </div>

          {/* Backend URLs */}
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Server className="w-4 h-4" />
              <span>Backend Servers</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {rule.backendUrl.map((url, idx) => (
                <Badge key={idx} variant="outline" className="font-mono">
                  {url}
                </Badge>
              ))}
            </div>
          </div>

          {/* EntryPoints */}
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <span>Entry Points</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {rule.entryPoints.map((ep, idx) => (
                <Badge key={idx} variant="outline">
                  {ep}
                </Badge>
              ))}
            </div>
          </div>

          {/* Middlewares */}
          {rule.middlewares && rule.middlewares.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Middlewares</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {rule.middlewares.map((mw, idx) => (
                  <Badge key={idx} variant="outline">
                    {mw}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {!rule.isValid && rule.validationErrors && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700 mb-1">Validation Errors:</p>
              <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                {rule.validationErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
