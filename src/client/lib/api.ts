// ============================================================
// API Client - Centralized fetch wrapper
// ============================================================

import { useAuthStore } from '../stores/auth.store';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' })) as { error?: string; code?: string };
    
    // Auto-logout on 401
    if (response.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    
    throw new ApiError(
      errorData.error ?? `HTTP ${response.status}`,
      response.status,
      errorData.code
    );
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  }),
  put: <T>(path: string, body?: unknown) => request<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { ApiError };
