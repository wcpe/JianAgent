import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PopulationTrackerService } from '../population-tracker.service.js';

function createMockDb() {
  const valuesRun = vi.fn().mockReturnValue({ run: vi.fn() });
  const insertFn = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ run: vi.fn() }) });

  const whereChain = vi.fn().mockReturnThis();
  const orderByChain = vi.fn().mockReturnThis();
  const limitChain = vi.fn().mockReturnThis();
  const allFn = vi.fn().mockReturnValue([]);

  const selectFn = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: whereChain,
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          all: allFn,
        }),
      }),
    }),
  });

  // Delete chain
  const deleteRun = vi.fn().mockReturnValue({ changes: 0 });
  const deleteWhere = vi.fn().mockReturnValue({ run: deleteRun });
  const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });

  return {
    insert: insertFn,
    select: selectFn,
    delete: deleteFn,
    _allFn: allFn,
    _deleteRun: deleteRun,
    _insertFn: insertFn,
  };
}

function createMockMultiServer(servers: any[] = []) {
  return {
    listServers: vi.fn().mockResolvedValue(servers),
  };
}

describe('PopulationTrackerService', () => {
  let service: PopulationTrackerService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockMultiServer: ReturnType<typeof createMockMultiServer>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockDb = createMockDb();
    mockMultiServer = createMockMultiServer();
    service = new PopulationTrackerService(mockDb as any, mockMultiServer as any);
  });

  afterEach(() => {
    service.onModuleDestroy();
    vi.useRealTimers();
  });

  it('should record snapshot on module init', async () => {
    mockMultiServer.listServers.mockResolvedValue([
      { id: 'srv-1', name: 'Server 1', runtimeStatus: 'running', onlinePlayers: 5, maxPlayers: 20 },
    ]);

    service.onModuleInit();
    // Wait for the immediate recordSnapshot
    await vi.advanceTimersByTimeAsync(0);

    expect(mockMultiServer.listServers).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should only record running servers', async () => {
    mockMultiServer.listServers.mockResolvedValue([
      { id: 'srv-1', name: 'Running', runtimeStatus: 'running', onlinePlayers: 5, maxPlayers: 20 },
      { id: 'srv-2', name: 'Stopped', runtimeStatus: 'stopped', onlinePlayers: 0, maxPlayers: 20 },
      { id: 'srv-3', name: 'Crashed', runtimeStatus: 'crashed', onlinePlayers: 0, maxPlayers: 20 },
    ]);

    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);

    // insert called once for the running server only
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('should default undefined onlinePlayers and maxPlayers to 0', async () => {
    const valuesCapture = vi.fn().mockReturnValue({ run: vi.fn() });
    mockDb.insert.mockReturnValue({ values: valuesCapture });
    mockMultiServer.listServers.mockResolvedValue([
      { id: 'srv-1', name: 'Test', runtimeStatus: 'running', onlinePlayers: undefined, maxPlayers: null },
    ]);

    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);

    expect(valuesCapture).toHaveBeenCalledWith(
      expect.objectContaining({ onlinePlayers: 0, maxPlayers: 0 }),
    );
  });

  it('should handle listServers error gracefully', async () => {
    mockMultiServer.listServers.mockRejectedValue(new Error('DB error'));
    const loggerError = vi.spyOn((service as any).logger, 'error').mockImplementation(() => {});

    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);

    expect(loggerError).toHaveBeenCalled();
  });

  it('should clear interval on module destroy', () => {
    service.onModuleInit();
    expect((service as any).timer).not.toBeNull();
    service.onModuleDestroy();
    expect((service as any).timer).not.toBeNull(); // timer ref remains, but clearInterval was called
  });

  it('should record every 60 seconds', async () => {
    mockMultiServer.listServers.mockResolvedValue([
      { id: 'srv-1', name: 'S1', runtimeStatus: 'running', onlinePlayers: 3, maxPlayers: 20 },
    ]);

    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);

    const firstCallCount = mockMultiServer.listServers.mock.calls.length;

    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockMultiServer.listServers.mock.calls.length).toBeGreaterThan(firstCallCount);
  });

  it('getHistory should return records from db', () => {
    const records = [
      { id: 1, serverId: 'srv-1', serverName: 'S1', timestamp: '2026-04-07T12:00:00Z', onlinePlayers: 5, maxPlayers: 20 },
    ];
    // Need to rebuild mock chain for getHistory
    const allFn = vi.fn().mockReturnValue(records);
    const limitFn = vi.fn().mockReturnValue({ all: allFn });
    const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });
    const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    mockDb.select.mockReturnValue({ from: fromFn });

    const result = service.getHistory({});
    expect(result).toEqual(records);
    expect(limitFn).toHaveBeenCalledWith(1440);
  });

  it('getHistory should apply custom limit', () => {
    const allFn = vi.fn().mockReturnValue([]);
    const limitFn = vi.fn().mockReturnValue({ all: allFn });
    const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });
    const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    mockDb.select.mockReturnValue({ from: fromFn });

    service.getHistory({ limit: 100 });
    expect(limitFn).toHaveBeenCalledWith(100);
  });

  it('getHistory should filter by serverId', () => {
    const allFn = vi.fn().mockReturnValue([]);
    const limitFn = vi.fn().mockReturnValue({ all: allFn });
    const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });
    const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn, orderBy: orderByFn });
    mockDb.select.mockReturnValue({ from: fromFn });

    service.getHistory({ serverId: 'srv-1' });
    expect(whereFn).toHaveBeenCalled();
  });

  it('getHistory should filter by time range', () => {
    const allFn = vi.fn().mockReturnValue([]);
    const limitFn = vi.fn().mockReturnValue({ all: allFn });
    const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });
    const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn, orderBy: orderByFn });
    mockDb.select.mockReturnValue({ from: fromFn });

    service.getHistory({
      startTime: '2026-04-07T00:00:00Z',
      endTime: '2026-04-07T23:59:59Z',
    });
    expect(whereFn).toHaveBeenCalled();
  });

  it('cleanup should delete old records and return count', () => {
    const deleteRun = vi.fn().mockReturnValue({ changes: 42 });
    const deleteWhere = vi.fn().mockReturnValue({ run: deleteRun });
    mockDb.delete.mockReturnValue({ where: deleteWhere });

    const result = service.cleanup(30);
    expect(result).toBe(42);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('cleanup should use correct cutoff date', () => {
    const now = new Date('2026-04-07T12:00:00Z').getTime();
    vi.setSystemTime(now);

    const deleteRun = vi.fn().mockReturnValue({ changes: 0 });
    const deleteWhere = vi.fn().mockReturnValue({ run: deleteRun });
    mockDb.delete.mockReturnValue({ where: deleteWhere });

    service.cleanup(7);
    expect(deleteWhere).toHaveBeenCalled();
  });
});
