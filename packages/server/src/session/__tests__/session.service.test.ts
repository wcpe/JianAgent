import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '../session.service';

describe('SessionService', () => {
  let service: SessionService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'sess_1' }]) })) })),
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => [{ id: 'sess_1', name: 'Test', state: 'CREATED' }]) })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => []) })) })),
    };
    service = new SessionService(mockDb);
  });

  it('should create a session', async () => {
    const result = await service.create({
      name: 'Stress Test 1',
      serverId: 'srv_1',
      botConfigId: 'cfg_1',
      phases: [{ phase: 'ramp-up', botCount: 10, behavior: 'idle', durationSec: 60 }],
    });
    expect(result.id).toBe('sess_1');
  });

  it('should find session by id', async () => {
    const result = await service.findById('sess_1');
    expect(result?.name).toBe('Test');
  });

  it('should update session state', async () => {
    await service.updateState('sess_1', 'RUNNING');
    expect(mockDb.update).toHaveBeenCalled();
  });
});
