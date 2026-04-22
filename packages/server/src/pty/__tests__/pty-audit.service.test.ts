import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PtyAuditService } from '../pty-audit.service.js';

function createMockDb() {
  return {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnValue([]),
  } as any;
}

describe('PtyAuditService', () => {
  let service: PtyAuditService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockDb = createMockDb();
    service = new PtyAuditService(mockDb);
  });

  afterEach(() => {
    service.onModuleDestroy();
    vi.useRealTimers();
  });

  describe('recordCommand', () => {
    it('should buffer audit entries', async () => {
      await service.recordCommand({
        userId: 'user-1',
        username: 'admin',
        serverId: 'server-1',
        command: 'say hello',
        allowed: true,
      });
      // No immediate DB call since buffer hasn't reached 50
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should record denied commands with reason', async () => {
      await service.recordCommand({
        userId: 'user-2',
        username: 'viewer',
        serverId: 'server-1',
        command: 'stop',
        allowed: false,
        reason: 'VIEWER cannot send commands',
      });
      // Entry is buffered
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should not throw when recording fails', async () => {
      // Fill buffer to trigger flush with a failing DB
      mockDb.insert = vi.fn().mockImplementation(() => {
        throw new Error('DB error');
      });

      for (let i = 0; i < 51; i++) {
        await service.recordCommand({
          userId: 'user-1',
          username: 'admin',
          serverId: 'server-1',
          command: `cmd-${i}`,
          allowed: true,
        });
      }
      // Should not have thrown
    });
  });

  describe('onModuleDestroy', () => {
    it('should clear the flush timer', () => {
      service.onModuleDestroy();
      // No error thrown, timer cleared
    });
  });
});
