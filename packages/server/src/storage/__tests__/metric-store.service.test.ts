import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricStoreService } from '../metric-store.service.js';

function createMockDb() {
  const insertValues = vi.fn().mockReturnThis();
  const selectFrom = vi.fn().mockReturnThis();
  const whereChain = vi.fn().mockReturnThis();
  const orderByChain = vi.fn().mockReturnThis();
  const limitChain = vi.fn().mockResolvedValue([]);

  return {
    insert: vi.fn().mockReturnValue({ values: insertValues }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: limitChain,
          }),
        }),
      }),
    }),
    _insertValues: insertValues,
    _limitChain: limitChain,
  };
}

describe('MetricStoreService', () => {
  let service: MetricStoreService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new MetricStoreService(mockDb as any);
  });

  it('should insert a metric snapshot with generated id', async () => {
    const data = {
      timestamp: '2026-04-06T12:00:00Z',
      serverId: 'srv-1',
      tps: 20.0,
      mspt: 10.5,
      onlinePlayers: 5,
      onlineBots: 3,
      cpuUsage: 45.2,
      memoryUsageMb: 2048.0,
      entityCount: 100,
      loadedChunks: 200,
    };

    await service.insert(data);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockDb._insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        serverId: 'srv-1',
        tps: 20.0,
        mspt: 10.5,
        id: expect.any(String),
      }),
    );
  });

  it('should return empty array for queryRange when no data', async () => {
    const result = await service.queryRange('srv-1', '2026-04-06T00:00:00Z', '2026-04-06T23:59:59Z');
    expect(result).toEqual([]);
  });

  it('should return reversed rows for queryRange (oldest first)', async () => {
    const rows = [
      { id: '2', timestamp: '2026-04-06T12:01:00Z', serverId: 'srv-1', tps: 19, mspt: 11, onlinePlayers: 5, onlineBots: 3, cpuUsage: 40, memoryUsageMb: 2000, entityCount: 80, loadedChunks: 150 },
      { id: '1', timestamp: '2026-04-06T12:00:00Z', serverId: 'srv-1', tps: 20, mspt: 10, onlinePlayers: 4, onlineBots: 2, cpuUsage: 35, memoryUsageMb: 1900, entityCount: 70, loadedChunks: 140 },
    ];
    mockDb._limitChain.mockResolvedValueOnce(rows);

    const result = await service.queryRange('srv-1', '2026-04-06T00:00:00Z', '2026-04-06T23:59:59Z');
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('1');
    expect(result[1]!.id).toBe('2');
  });

  it('should return undefined for getLatest when no data', async () => {
    const result = await service.getLatest('srv-1');
    expect(result).toBeUndefined();
  });
});
