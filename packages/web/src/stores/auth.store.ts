import { create } from 'zustand';
import type { UserInfo } from '@jian-agent/shared-domain';
import * as authApi from '../api/auth.api.js';

interface AuthState {
  readonly user: UserInfo | null;
  readonly token: string | null;
  readonly loading: boolean;
  readonly error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: sessionStorage.getItem('token'),
  loading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const result = await authApi.login({ username, password });
      sessionStorage.setItem('token', result.token);
      set({ token: result.token, user: result.user, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message ?? 'Login failed' });
      throw err;
    }
  },

  logout: () => {
    sessionStorage.removeItem('token');
    set({ token: null, user: null });
  },

  loadUser: async () => {
    try {
      const user = await authApi.getMe();
      set({ user });
    } catch {
      sessionStorage.removeItem('token');
      set({ token: null, user: null });
    }
  },
}));
