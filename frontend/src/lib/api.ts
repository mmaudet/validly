const API_BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function refreshOnce(): Promise<boolean> {
  if (isRefreshing) return refreshPromise!;
  isRefreshing = true;
  refreshPromise = tryRefreshToken().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const doFetch = async () => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (options?.body != null && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  };

  let res = await doFetch();

  // On 401, try refreshing the token once and retry
  if (res.status === 401) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      res = await doFetch();
    } else {
      // Refresh failed — clear auth and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface ActionInfo {
  action: string;
  workflowTitle: string;
  stepName: string;
  phaseName: string;
  initiatorName: string;
  documents: string[];
}

export interface ActionInfoError {
  error: true;
  reason: string;
}

export async function fetchActionInfo(token: string): Promise<ActionInfo | ActionInfoError> {
  const res = await fetch(`${API_BASE}/actions/${encodeURIComponent(token)}/info`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status === 410) {
    const body = await res.json().catch(() => ({ message: 'expired' }));
    return { error: true, reason: body.message ?? 'expired' };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    return { error: true, reason: body.message ?? res.statusText };
  }

  return res.json();
}
