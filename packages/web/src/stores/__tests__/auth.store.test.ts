import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted: runs before any module import so auth.store.ts can access sessionStorage
vi.hoisted(() => {
  const s: Record<string, string> = {};
  (globalThis as any).__authTestStorage = s;
  globalThis.sessionStorage = {
    getItem: vi.fn((k: string) => s[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { s[k] = v; }),
    removeItem: vi.fn((k: string) => { delete s[k]; }),
    clear: vi.fn(() => { Object.keys(s).forEach((k) => delete s[k]); }),
    length: 0,
    key: () => null,
  } as unknown as Storage;
});

vi.mock('../../api/auth.api.js', () => ({
  login: vi.fn(),
  getMe: vi.fn(),
}));

import { useAuthStore } from '../auth.store.js';
import * as authApi from '../../api/auth.api.js';

const mockedLogin = vi.mocked(authApi.login);
const mockedGetMe = vi.mocked(authApi.getMe);

beforeEach(() => {
  const s = (globalThis as any).__authTestStorage as Record<string, string>;
  Object.keys(s).forEach((k) => delete s[k]);
  useAuthStore.setState({ user: null, token: null, loading: false, error: null });
  vi.clearAllMocks();
});

describe('useAuthStore', () => {
  it('login stores token and user on success', async () => {
    const mockResult = { token: 'tok123', user: { id: '1', username: 'admin', role: 5, createdAt: '' } };
    mockedLogin.mockResolvedValue(mockResult as any);

    await useAuthStore.getState().login('admin', 'pass');

    expect(useAuthStore.getState().token).toBe('tok123');
    expect(useAuthStore.getState().user?.username).toBe('admin');
    expect(useAuthStore.getState().loading).toBe(false);
    expect(sessionStorage.setItem).toHaveBeenCalledWith('token', 'tok123');
  });

  it('login sets error on failure', async () => {
    mockedLogin.mockRejectedValue(new Error('bad creds'));

    await expect(useAuthStore.getState().login('x', 'y')).rejects.toThrow('bad creds');

    expect(useAuthStore.getState().error).toBe('bad creds');
    expect(useAuthStore.getState().loading).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('logout clears token and user', () => {
    useAuthStore.setState({ token: 'tok', user: { id: '1', username: 'a', role: 5, createdAt: '' } as any });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('token');
  });

  it('loadUser fetches and sets user', async () => {
    const user = { id: '1', username: 'admin', role: 5, createdAt: '' };
    mockedGetMe.mockResolvedValue(user as any);

    await useAuthStore.getState().loadUser();

    expect(useAuthStore.getState().user?.username).toBe('admin');
  });

  it('loadUser clears token on failure', async () => {
    useAuthStore.setState({ token: 'stale-tok' });
    mockedGetMe.mockRejectedValue(new Error('unauthorized'));

    await useAuthStore.getState().loadUser();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('token');
  });
});
