import { Plus, RefreshCw, FolderOpen, Search, Edit2, Trash2, Shield, CheckCircle, AlertCircle, Globe, Server, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
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
import { useState } from 'react';
import RuleCard from './RuleCard';

type DashboardProps = {
  workingDirectory: string;
  rules: TraefikRule[];
  onAddProxy: () => void;
  onEditRule: (rule: TraefikRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onReload: () => void;
  onChangeDirectory: () => void;
  busy?: boolean;
};

type SortField = 'name' | 'hostname' | 'status' | 'lastModified';
type SortDirection = 'asc' | 'desc';

export default function Dashboard({
  workingDirectory,
  rules,
  onAddProxy,
  onEditRule,
  onDeleteRule,
  onReload,
  onChangeDirectory,
  busy = false,
}: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastModified');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 inline opacity-30" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 inline" />
      : <ArrowDown className="w-3 h-3 ml-1 inline" />;
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);

  // Deduplicate by id to avoid accidental duplicates from upstream state updates
  const uniqueRules = Array.from(
    new Map(rules.map((rule) => [rule.id, rule])).values()
  );

  const filteredRules = (queryTerms.length ? uniqueRules.filter((rule) => {
    const fields = [
      rule.name,
      rule.fileName,
      rule.routerName,
      rule.serviceName,
      rule.hostname,
      ...(rule.backendUrl || []),
      ...(rule.entryPoints || []),
      ...(rule.middlewares || []),
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    return queryTerms.every((term) => fields.some((field) => field.includes(term)));
  }) : uniqueRules)
    .slice()
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'hostname':
          const hostnameA = String(a.hostname || '');
          const hostnameB = String(b.hostname || '');
          comparison = hostnameA.localeCompare(hostnameB);
          break;
        case 'status':
          comparison = (a.isValid === b.isValid) ? 0 : a.isValid ? -1 : 1;
          break;
        case 'lastModified':
          comparison = a.lastModified.getTime() - b.lastModified.getTime();
          break;
      }
      
      // Stable-ish tie-breaker to avoid shuffling on equal values
      if (comparison === 0) {
        comparison = a.id.localeCompare(b.id);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const validRules = rules.filter((r) => r.isValid).length;
  const invalidRules = rules.filter((r) => !r.isValid).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl">Traefik Rules Manager</h1>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                <FolderOpen className="w-4 h-4" />
                <span className="font-mono">{workingDirectory}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onChangeDirectory}
                >
                  Change
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onReload} disabled={busy}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload
              </Button>
              <Button onClick={onAddProxy} disabled={busy}>
                <Plus className="w-4 h-4 mr-2" />
                Add Reverse Proxy
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Rules</CardDescription>
              <CardTitle className="text-3xl">{rules.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Valid Rules</CardDescription>
              <CardTitle className="text-3xl text-green-600">{validRules}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Invalid Rules</CardDescription>
              <CardTitle className="text-3xl text-red-600">{invalidRules}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search rules by name or hostname..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Rules Table */}
        <Card>
          <CardContent className="p-0">
            {filteredRules.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-500">
                  {searchQuery
                    ? 'No rules match your search'
                    : 'No rules found. Click "Add Reverse Proxy" to create your first rule.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[1300px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('status')}
                      >
                        Status <SortIcon field="status" />
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('name')}
                      >
                        Name <SortIcon field="name" />
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('hostname')}
                      >
                        Hostname <SortIcon field="hostname" />
                      </TableHead>
                      <TableHead>Services</TableHead>
                      <TableHead>Entry Point</TableHead>
                      <TableHead>Security</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('lastModified')}
                      >
                        Last Edited <SortIcon field="lastModified" />
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rule.routerName || rule.name}</div>
                            <div className="text-sm text-gray-500 font-mono">{rule.fileName || `${rule.name}.yaml`}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Globe className="w-3 h-3 text-gray-400" />
                            <span className="font-mono">{rule.hostname}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {rule.backendUrl.map((url, idx) => (
                              <div key={idx} className="flex items-center gap-1 text-sm">
                                <Server className="w-3 h-3 text-gray-400" />
                                <span className="font-mono text-gray-600">{url}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {rule.entryPoints[0] || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {rule.tls && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 w-fit">
                                <Shield className="w-3 h-3 mr-1" />
                                TLS
                              </Badge>
                            )}
                            {rule.middlewares && rule.middlewares.length > 0 && (
                              <div className="text-xs text-gray-500">
                                {rule.middlewares.length} middleware{rule.middlewares.length > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-600">
                            {formatDate(rule.lastModified)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => onEditRule(rule)}>
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
                                  <AlertDialogAction onClick={() => onDeleteRule(rule.id)} className="bg-red-600 hover:bg-red-700">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
