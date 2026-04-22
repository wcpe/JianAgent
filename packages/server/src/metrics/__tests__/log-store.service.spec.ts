import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogStoreService } from '../log-store.service.js';

function createMockDb() {
  const innerChain = {
    values: vi.fn().mockResolvedValue(undefined),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([]),
  };
  return {
    insert: vi.fn().mockReturnValue(innerChain),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(innerChain),
    }),
  };
}

describe('LogStoreService', () => {
  let service: LogStoreService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new LogStoreService(mockDb as any);
  });

  it('should insert a log entry and return id', async () => {
    const id = await service.insert({
      timestamp: '2026-01-01T00:00:00Z',
      level: 'INFO',
      source: 'SYSTEM',
      module: 'startup',
      message: 'Server started',
    });
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });
});
