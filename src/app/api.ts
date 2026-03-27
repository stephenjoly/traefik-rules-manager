import {
  ApiKeyRecord,
  AuthSession,
  CreateApiKeyPayload,
  CreatedApiKeyResponse,
  RulePayload
} from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await res.json().catch(() => null);
      const message = body?.error || body?.message || res.statusText;
      const error = new Error(message);
      (error as Error & { status?: number }).status = res.status;
      throw error;
    }

    const text = await res.text();
    const error = new Error(text || res.statusText);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiGetHealth(base: string) {
  return request<{ status: string; configPath?: string }>(`${base}/api/health`);
}

export async function apiGetRules(base: string) {
  return request<any[]>(`${base}/api/rules`);
}

export async function apiCreateRule(base: string, payload: RulePayload) {
  return request<any>(`${base}/api/rules`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function apiUpdateRule(base: string, id: string, payload: RulePayload) {
  return request<any>(`${base}/api/rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function apiDeleteRule(base: string, id: string) {
  return request<void>(`${base}/api/rules/${id}`, { method: 'DELETE' });
}

export async function apiGetMiddlewares(base: string) {
  return request<string[]>(`${base}/api/middlewares`);
}

export async function apiResync(base: string) {
  return request(`${base}/api/resync`, { method: 'POST' });
}

export async function apiGetSession(base: string) {
  return request<AuthSession>(`${base}/api/auth/session`);
}

export async function apiLogin(base: string, username: string, password: string) {
  return request<AuthSession>(`${base}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function apiLogout(base: string) {
  return request<void>(`${base}/api/auth/logout`, {
    method: 'POST'
  });
}

export async function apiGetApiKeys(base: string) {
  return request<ApiKeyRecord[]>(`${base}/api/admin/api-keys`);
}

export async function apiCreateApiKey(base: string, payload: CreateApiKeyPayload) {
  return request<CreatedApiKeyResponse>(`${base}/api/admin/api-keys`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function apiRevokeApiKey(base: string, id: string) {
  return request<ApiKeyRecord>(`${base}/api/admin/api-keys/${id}/revoke`, {
    method: 'POST'
  });
}

export async function apiDeleteApiKey(base: string, id: string) {
  return request<void>(`${base}/api/admin/api-keys/${id}`, {
    method: 'DELETE'
  });
}

export async function apiTestAutomationKey(base: string, apiKey: string) {
  const res = await fetch(`${base}/api/automation/rules`, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text().catch(() => '');

  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    body
  };
}
