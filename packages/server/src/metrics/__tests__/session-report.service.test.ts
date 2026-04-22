import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionReportService } from '../session-report.service.js';

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    all: vi.fn().mockReturnValue([]),
  };
}

describe('SessionReportService', () => {
  let service: SessionReportService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new SessionReportService(mockDb as any);
  });

  it('should generate a report with empty metrics', async () => {
    const report = await service.generateReport('session-001');

    expect(report.sessionId).toBe('session-001');
    expect(report.botStats.totalSpawned).toBe(0);
    expect(report.serverPerf.avgTps).toBe(0);
    expect(report.conclusions).toContain('测试会话整体表现良好，未发现明显性能问题');
  });

  it('should detect TPS performance issues in conclusions', async () => {
    mockDb.all.mockReturnValueOnce([
      {
        timestamp: '2026-01-01T00:00:00Z',
        source: 'metrics',
        module: 'session-002',
        message: '',
        metadata: JSON.stringify({ tps: 10, mspt: 60, botCount: 50, cpuPercent: 80, memoryMb: 4096, serverId: 'srv-1' }),
      },
    ]).mockReturnValueOnce([]); // alerts query

    const report = await service.generateReport('session-002');

    expect(report.serverPerf.minTps).toBeLessThan(15);
    const hasTpsWarning = report.conclusions.some((c) => c.includes('TPS'));
    expect(hasTpsWarning).toBe(true);
  });

  it('should compute bot stats from metric rows', async () => {
    const rows = [
      { timestamp: '2026-01-01T00:00:00Z', source: 'metrics', module: 'session-003', message: '', metadata: JSON.stringify({ botCount: 10, totalSpawned: 20, joinFailures: 0, disconnections: 0, tps: 20, mspt: 10, cpuPercent: 30, memoryMb: 2048, serverId: 'srv-1' }) },
      { timestamp: '2026-01-01T00:01:00Z', source: 'metrics', module: 'session-003', message: '', metadata: JSON.stringify({ botCount: 40, totalSpawned: 50, joinFailures: 1, disconnections: 2, tps: 18, mspt: 20, cpuPercent: 50, memoryMb: 3000, serverId: 'srv-1' }) },
    ];
    mockDb.all.mockReturnValueOnce(rows).mockReturnValueOnce([]); // alerts

    const report = await service.generateReport('session-003');

    expect(report.botStats.peakOnline).toBe(40);
    expect(report.botStats.totalSpawned).toBe(50);
    expect(report.botStats.joinFailures).toBe(1);
    expect(report.serverPerf.avgTps).toBeCloseTo(19, 0);
  });

  it('should return metric time series for a given metric', async () => {
    const rows = [
      { timestamp: '2026-01-01T00:00:00Z', source: 'metrics', module: 'session-004', message: '', metadata: JSON.stringify({ tps: 20 }) },
      { timestamp: '2026-01-01T00:01:00Z', source: 'metrics', module: 'session-004', message: '', metadata: JSON.stringify({ tps: 18 }) },
    ];
    mockDb.all.mockReturnValue(rows);

    const series = await service.getMetricTimeSeries('session-004', 'tps');

    expect(series).toHaveLength(2);
    expect(series[0]!.value).toBe(20);
    expect(series[1]!.value).toBe(18);
  });
});
