import { RulePayload } from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
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
