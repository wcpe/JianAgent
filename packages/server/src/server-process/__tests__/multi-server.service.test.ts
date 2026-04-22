import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiServerService } from '../multi-server.service.js';
import { ServerState } from '@jian-agent/shared-domain';

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    all: vi.fn().mockReturnValue([]),
  };
}

function createMockProcessManager() {
  return {
    getStatus: vi.fn().mockReturnValue({ state: ServerState.STOPPED, pid: null, uptime: 0, restartCount: 0 }),
  };
}

describe('MultiServerService', () => {
  let service: MultiServerService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockPM: ReturnType<typeof createMockProcessManager>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockPM = createMockProcessManager();
    service = new MultiServerService(mockDb as any, mockPM as any);
  });

  it('should return empty list when no servers', async () => {
    mockDb.all.mockReturnValue([]);
    const result = await service.listServers();
    expect(result).toHaveLength(0);
  });

  it('should return server with running runtime status', async () => {
    mockPM.getStatus.mockReturnValue({ state: ServerState.RUNNING, pid: 101, uptime: 5000, restartCount: 0 });
    mockDb.all.mockReturnValue([
      { id: 'srv-1', name: 'Test Server', host: 'localhost', port: 25565, jarPath: '/srv/server.jar', workDir: '/srv', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]);

    const result = await service.listServers();
    expect(result[0].id).toBe('srv-1');
    expect(result[0].runtimeStatus).toBe('running');
  });

  it('should list all servers with runtime statuses', async () => {
    mockDb.all.mockReturnValue([
      { id: 'srv-1', name: 'Server 1', host: 'localhost', port: 25565, jarPath: '/srv/s1.jar', workDir: '/srv', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { id: 'srv-2', name: 'Server 2', host: 'localhost', port: 25566, jarPath: '/srv/s2.jar', workDir: '/srv', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]);

    const result = await service.listServers();
    expect(result).toHaveLength(2);
    expect(result[0].runtimeStatus).toBe('stopped');
  });

  it('should return null for non-existent server by id', async () => {
    mockDb.all.mockReturnValue([]);
    const result = await service.getServer('nonexistent');
    expect(result).toBeNull();
  });

  it('should return server by id with status', async () => {
    mockPM.getStatus.mockReturnValue({ state: ServerState.RUNNING, pid: 101, uptime: 5000, restartCount: 0 });
    mockDb.all.mockReturnValue([
      { id: 'srv-1', name: 'Test Server', host: 'localhost', port: 25565, jarPath: '/srv/server.jar', workDir: '/srv', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]);

    const result = await service.getServer('srv-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('srv-1');
    expect(result!.runtimeStatus).toBe('running');
  });
});
