import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BotGroupService } from '../bot-group.service.js';

function createMockDb() {
  return {
    run: vi.fn().mockReturnValue(undefined),
    all: vi.fn().mockReturnValue([]),
  };
}

describe('BotGroupService', () => {
  let service: BotGroupService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new BotGroupService(mockDb as any);
  });

  it('should create a group and return DTO', async () => {
    const result = await service.createGroup('sess-1', 'alpha', ['bot_001', 'bot_002']);
    expect(result.sessionId).toBe('sess-1');
    expect(result.name).toBe('alpha');
    expect(result.botNames).toEqual(['bot_001', 'bot_002']);
    expect(result.id).toBeDefined();
    expect(mockDb.run).toHaveBeenCalledTimes(1);
  });

  it('should delete a group', async () => {
    await service.deleteGroup('g1');
    expect(mockDb.run).toHaveBeenCalledTimes(1);
  });

  it('should list groups for a session', async () => {
    mockDb.all.mockReturnValueOnce([
      { id: 'g1', session_id: 'sess-1', name: 'alpha', bot_names: '["b1","b2"]', created_at: '2026-01-01T00:00:00Z' },
    ]);

    const groups = await service.listGroups('sess-1');
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('alpha');
    expect(groups[0].botNames).toEqual(['b1', 'b2']);
  });

  it('should return empty array when no groups exist', async () => {
    const groups = await service.listGroups('sess-none');
    expect(groups).toEqual([]);
  });
});
