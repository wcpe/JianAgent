import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useServerStore } from '../server.store.js';

vi.mock('../../api/server.api.js', () => ({
  serverApi: {
    listServers: vi.fn(),
    createServer: vi.fn(),
    updateServer: vi.fn(),
    deleteServer: vi.fn(),
    startServer: vi.fn(),
    stopServer: vi.fn(),
    interruptServer: vi.fn(),
    restartServer: vi.fn(),
  },
}));

import { serverApi } from '../../api/server.api.js';

const mockedApi = vi.mocked(serverApi);

describe('useServerStore', () => {
  beforeEach(() => {
    useServerStore.setState({ servers: [], viewMode: 'card', filter: { search: '', status: null }, loading: false, error: null });
    vi.clearAllMocks();
  });

  it('fetchServers updates servers on success', async () => {
    const mockServers = [{ id: 's1', name: 'test', runtimeStatus: 'running' }];
    mockedApi.listServers.mockResolvedValue(mockServers as any);

    await useServerStore.getState().fetchServers();

    expect(useServerStore.getState().servers).toEqual(mockServers);
    expect(useServerStore.getState().loading).toBe(false);
  });

  it('fetchServers sets error on failure', async () => {
    mockedApi.listServers.mockRejectedValue(new Error('Network error'));

    await useServerStore.getState().fetchServers();

    expect(useServerStore.getState().error).toBe('Network error');
    expect(useServerStore.getState().loading).toBe(false);
  });

  it('patchServerStatus updates a specific server', () => {
    useServerStore.setState({
      servers: [{ id: 's1', name: 'test', runtimeStatus: 'stopped' } as any],
    });
    useServerStore.getState().patchServerStatus('s1', { runtimeStatus: 'running' } as any);
    expect(useServerStore.getState().servers[0].runtimeStatus).toBe('running');
  });

  it('deleteServer removes server from list', async () => {
    useServerStore.setState({
      servers: [
        { id: 's1', name: 'a' } as any,
        { id: 's2', name: 'b' } as any,
      ],
    });
    mockedApi.deleteServer.mockResolvedValue(undefined as any);

    await useServerStore.getState().deleteServer('s1');

    expect(useServerStore.getState().servers).toHaveLength(1);
    expect(useServerStore.getState().servers[0].id).toBe('s2');
  });
});
