import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  locale: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: !!localStorage.getItem('token'),
    isLoading: true,
  });

  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setState({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }
    try {
      const user = await apiFetch<User>('/auth/me');
      setState({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    await fetchProfile();
  }, [fetchProfile]);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const res = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    localStorage.setItem('token', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    await fetchProfile();
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore logout errors
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return { ...state, login, signup, logout };
}
