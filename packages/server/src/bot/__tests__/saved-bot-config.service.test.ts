import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SavedBotConfigService } from '../saved-bot-config.service';

function createMockDb() {
  const rows: any[] = [];
  return {
    rows,
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => rows.filter(() => true)),
        then: (fn: any) => Promise.resolve(fn(rows)),
        // Allow chaining without where (list all)
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ changes: 1 }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ changes: 1 }),
    }),
  };
}

describe('SavedBotConfigService', () => {
  let service: SavedBotConfigService;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    service = new SavedBotConfigService(db as any);
  });

  it('should create a saved config with defaults', async () => {
    const result = await service.create({
      serverId: 'srv-1',
      namePrefix: 'bot',
      count: 5,
    });

    expect(result.id).toBeDefined();
    expect(result.serverId).toBe('srv-1');
    expect(result.namePrefix).toBe('bot');
    expect(result.count).toBe(5);
    expect(result.behavior).toBe('idle');
    expect(result.autoCreate).toBe(true);
    expect(result.rejoinStrategy).toBe('always');
    expect(result.maxRetries).toBe(5);
    expect(result.createdAt).toBeDefined();
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it('should create a saved config with custom values', async () => {
    const result = await service.create({
      serverId: 'srv-2',
      namePrefix: 'stress',
      count: 100,
      behavior: 'pvp_attack',
      autoCreate: false,
      rejoinStrategy: 'retry',
      maxRetries: 3,
    });

    expect(result.behavior).toBe('pvp_attack');
    expect(result.autoCreate).toBe(false);
    expect(result.rejoinStrategy).toBe('retry');
    expect(result.maxRetries).toBe(3);
  });

  it('should call delete on the db', async () => {
    const result = await service.remove('config-id-1');
    expect(result).toBe(true);
    expect(db.delete).toHaveBeenCalledOnce();
  });

  it('should call update with partial patch', async () => {
    const result = await service.update('config-id-1', { behavior: 'walk_random', count: 20 });
    expect(result).toBe(true);
    expect(db.update).toHaveBeenCalledOnce();
  });
});
