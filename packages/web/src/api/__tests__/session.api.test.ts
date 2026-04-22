import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client.js', () => ({ apiFetch: vi.fn() }));

import { sessionApi } from '../session.api.js';
import { apiFetch } from '../client.js';

const mockedFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sessionApi', () => {
  it('list calls GET /sessions', async () => {
    mockedFetch.mockResolvedValue({ success: true, data: [] });
    await sessionApi.list();
    expect(mockedFetch).toHaveBeenCalledWith('/sessions');
  });

  it('getOne calls GET /sessions/:id', async () => {
    mockedFetch.mockResolvedValue({ success: true, data: {} });
    await sessionApi.getOne('sess-1');
    expect(mockedFetch).toHaveBeenCalledWith('/sessions/sess-1');
  });

  it('create sends POST /sessions with body', async () => {
    const dto = { name: 'test', serverId: 's1', botConfigId: 'c1', phases: [] };
    mockedFetch.mockResolvedValue({ success: true, data: {} });
    await sessionApi.create(dto);
    expect(mockedFetch).toHaveBeenCalledWith('/sessions', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  });

  it('start sends POST /sessions/:id/start', async () => {
    mockedFetch.mockResolvedValue({ success: true });
    await sessionApi.start('sess-1');
    expect(mockedFetch).toHaveBeenCalledWith('/sessions/sess-1/start', { method: 'POST' });
  });

  it('stop sends POST /sessions/:id/stop', async () => {
    mockedFetch.mockResolvedValue({ success: true });
    await sessionApi.stop('sess-1');
    expect(mockedFetch).toHaveBeenCalledWith('/sessions/sess-1/stop', { method: 'POST' });
  });
});
