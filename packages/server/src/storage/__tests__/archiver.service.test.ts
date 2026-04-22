import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArchiverService } from '../archiver.service.js';

function createMockDb() {
  return {
    delete: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    run: vi.fn(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    all: vi.fn().mockReturnValue([]),
  };
}

describe('ArchiverService', () => {
  let service: ArchiverService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new ArchiverService(mockDb as any);
  });

  it('should return default retention days of 30', () => {
    expect(service.getRetentionDays()).toBe(30);
  });

  it('should update retention days within valid range', () => {
    service.setRetentionDays(7);
    expect(service.getRetentionDays()).toBe(7);
  });

  it('should reject invalid retention days', () => {
    expect(() => service.setRetentionDays(0)).toThrow('Retention days must be between 1 and 365');
    expect(() => service.setRetentionDays(400)).toThrow('Retention days must be between 1 and 365');
  });

  it('should archive old data and return result', async () => {
    const result = await service.archiveOldData();

    expect(result.retentionDays).toBe(30);
    expect(typeof result.cutoffDate).toBe('string');
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('should return stats with empty database', async () => {
    const stats = await service.getStats();

    expect(stats.totalSessions).toBe(0);
    expect(stats.oldestDataDate).toBeNull();
    expect(stats.retentionDays).toBe(30);
  });
});
