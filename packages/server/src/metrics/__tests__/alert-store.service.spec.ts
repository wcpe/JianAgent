import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertStoreService } from '../alert-store.service.js';

function createMockDb() {
  const innerChain = {
    values: vi.fn().mockResolvedValue(undefined),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  };
  return {
    insert: vi.fn().mockReturnValue(innerChain),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(innerChain),
    }),
    update: vi.fn().mockReturnValue(innerChain),
    delete: vi.fn().mockReturnValue(innerChain),
  };
}

describe('AlertStoreService', () => {
  let service: AlertStoreService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new AlertStoreService(mockDb as any);
  });

  it('should create a rule', async () => {
    const rule = await service.createRule({
      name: 'Low TPS',
      metric: 'TPS',
      operator: 'LESS_THAN',
      threshold: 15,
      level: 'CRITICAL',
    });
    expect(rule.name).toBe('Low TPS');
    expect(rule.metric).toBe('TPS');
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it('should insert an alert', async () => {
    const id = await service.insertAlert({
      timestamp: '2026-01-01T00:00:00Z',
      level: 'CRITICAL',
      ruleId: 'r-1',
      ruleName: 'Low TPS',
      message: 'TPS below 15',
      acknowledged: false,
    });
    expect(typeof id).toBe('string');
  });

  it('should get summary from unacknowledged alerts', async () => {
    // Mock the select to return some alerts
    const fromMock = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([
        { level: 'CRITICAL' },
        { level: 'WARNING' },
        { level: 'WARNING' },
      ]),
    });
    mockDb.select.mockReturnValue({ from: fromMock } as any);

    const summary = await service.getSummary();
    expect(summary.totalActive).toBe(3);
    expect(summary.criticalCount).toBe(1);
    expect(summary.warningCount).toBe(2);
  });
});
