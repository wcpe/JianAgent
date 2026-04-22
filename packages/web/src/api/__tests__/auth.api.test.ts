import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client.js', () => ({ apiFetch: vi.fn() }));

import { login, getMe } from '../auth.api.js';
import { apiFetch } from '../client.js';

const mockedFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth.api', () => {
  it('login calls POST /auth/login with credentials', async () => {
    mockedFetch.mockResolvedValue({ token: 't', user: { username: 'admin' } });

    const result = await login({ username: 'admin', password: 'pw' });

    expect(mockedFetch).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'pw' }),
    });
    expect(result).toEqual({ token: 't', user: { username: 'admin' } });
  });

  it('getMe calls GET /auth/me', async () => {
    mockedFetch.mockResolvedValue({ username: 'admin', role: 'admin' });

    const result = await getMe();

    expect(mockedFetch).toHaveBeenCalledWith('/auth/me');
    expect(result).toEqual({ username: 'admin', role: 'admin' });
  });
});
