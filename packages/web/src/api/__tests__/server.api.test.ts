import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client.js', () => ({ apiFetch: vi.fn() }));

import { serverApi } from '../server.api.js';
import { apiFetch } from '../client.js';

const mockedFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('serverApi', () => {
  it('listServers calls GET /servers', async () => {
    mockedFetch.mockResolvedValue([]);
    await serverApi.listServers();
    expect(mockedFetch).toHaveBeenCalledWith('/servers');
  });

  it('getServer calls GET /servers/:id', async () => {
    mockedFetch.mockResolvedValue({});
    await serverApi.getServer('abc');
    expect(mockedFetch).toHaveBeenCalledWith('/servers/abc');
  });

  it('createServer sends POST /servers', async () => {
    const dto = { name: 'test', host: 'localhost', port: 25565, type: 'external' as const };
    mockedFetch.mockResolvedValue({});
    await serverApi.createServer(dto as any);
    expect(mockedFetch).toHaveBeenCalledWith('/servers', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  });

  it('deleteServer sends DELETE /servers/:id', async () => {
    mockedFetch.mockResolvedValue(undefined);
    await serverApi.deleteServer('abc');
    expect(mockedFetch).toHaveBeenCalledWith('/servers/abc', { method: 'DELETE' });
  });

  it('startServer sends POST /servers/:id/start', async () => {
    mockedFetch.mockResolvedValue({ success: true });
    await serverApi.startServer('s1');
    expect(mockedFetch).toHaveBeenCalledWith('/servers/s1/start', { method: 'POST' });
  });

  it('stopServer sends POST /servers/:id/stop', async () => {
    mockedFetch.mockResolvedValue({ success: true });
    await serverApi.stopServer('s1');
    expect(mockedFetch).toHaveBeenCalledWith('/servers/s1/stop', { method: 'POST' });
  });

  it('pingServer sends POST /servers/:id/ping', async () => {
    mockedFetch.mockResolvedValue({ success: true, data: { online: true } });
    await serverApi.pingServer('s1');
    expect(mockedFetch).toHaveBeenCalledWith('/servers/s1/ping', { method: 'POST' });
  });

  it('listJavaProcesses calls GET /servers/java-processes', async () => {
    mockedFetch.mockResolvedValue({ success: true, data: [] });
    await serverApi.listJavaProcesses();
    expect(mockedFetch).toHaveBeenCalledWith('/servers/java-processes');
  });

  it('sshStatus calls GET /servers/:id/ssh/status', async () => {
    mockedFetch.mockResolvedValue({ connected: true, observability: {} });
    await serverApi.sshStatus('srv-1');
    expect(mockedFetch).toHaveBeenCalledWith('/servers/srv-1/ssh/status');
  });

  it('sshSessions calls GET /servers/:id/ssh/sessions', async () => {
    mockedFetch.mockResolvedValue({ connected: true, sessions: [] });
    await serverApi.sshSessions('srv-1');
    expect(mockedFetch).toHaveBeenCalledWith('/servers/srv-1/ssh/sessions');
  });
});
