import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MonitoringOverviewService } from '../../monitoring-overview.service.js';

function buildOverviewService() {
  const metricStore = {
    getLatest: vi.fn().mockResolvedValue({
      id: 'metric',
      timestamp: '2026-04-14T10:00:00.000Z',
      serverId: 'srv-0',
      tps: 19.9,
      mspt: 32,
      onlinePlayers: 28,
      onlineBots: 0,
      cpuUsage: 44,
      memoryUsageMb: 1536,
      maxMemoryMb: 4096,
      entityCount: 600,
      loadedChunks: 220,
      worldCount: 3,
      maxPlayers: 200,
      pluginCount: 35,
      playerDetails: null,
      pluginDetails: null,
    }),
  };
  const jmxMetrics = {
    getLatest: vi.fn().mockResolvedValue({
      id: 'jmx',
      timestamp: '2026-04-14T10:00:00.000Z',
      serverId: 'srv-0',
      pid: '9527',
      heapUsedMb: 1100,
      heapCommittedMb: 2048,
      heapMaxMb: 4096,
      threadCount: 180,
      daemonThreadCount: 60,
      gcYoungCount: 6,
      gcFullCount: 0,
      gcYoungTimeMs: 32,
      gcFullTimeMs: 0,
    }),
  };
  const alertEngine = {
    getSummary: vi.fn().mockResolvedValue({ totalActive: 1, criticalCount: 0, warningCount: 1, infoCount: 0 }),
  };
  const alertStore = {
    getEnabledRules: vi.fn().mockResolvedValue([{ id: 'rule-1' }, { id: 'rule-2' }]),
  };
  const jmxScheduler = {
    listSchedules: vi.fn().mockReturnValue([{ id: 'schedule-1' }]),
  };
  const platformRuntime = {
    getCapabilities: vi.fn().mockReturnValue({
      storageDialect: 'sqlite',
      logBackendMode: 'local-file',
      probeRuntimeKind: 'paper-1.20.4',
      realtimeCapacityMode: 'high-scale',
    }),
  };

  const service = new MonitoringOverviewService(
    metricStore as any,
    jmxMetrics as any,
    alertEngine as any,
    alertStore as any,
    jmxScheduler as any,
    platformRuntime as any,
  );

  return { service, metricStore, jmxMetrics, alertEngine, alertStore, jmxScheduler, platformRuntime };
}

describe('Platform scale load', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('supports 100 servers and 1000 overview reads in parallel', async () => {
    const ctx = buildOverviewService();
    const servers = Array.from({ length: 100 }, (_, index) => `srv-${index + 1}`);
    const requests = servers.flatMap((serverId) =>
      Array.from({ length: 10 }, () => ctx.service.getOverview(serverId)),
    );

    const rows = await Promise.all(requests);

    expect(rows).toHaveLength(1000);
    for (const row of rows) {
      expect(row.alertSummary.totalActive).toBeGreaterThanOrEqual(0);
      expect(row.state).toBeTypeOf('string');
    }

    expect(ctx.metricStore.getLatest).toHaveBeenCalledTimes(1000);
    expect(ctx.jmxMetrics.getLatest).toHaveBeenCalledTimes(1000);
    expect(ctx.alertEngine.getSummary).toHaveBeenCalledTimes(1000);
    expect(ctx.alertStore.getEnabledRules).toHaveBeenCalledTimes(1000);
    expect(ctx.jmxScheduler.listSchedules).toHaveBeenCalledTimes(1000);
  });
});
