const API_BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

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
