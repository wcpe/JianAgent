import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MonitoringOverviewService } from '../monitoring-overview.service.js';
import { LogFileService } from '../../log-file/log-file.service.js';

function createMonitoringOverviewCtx() {
  const metricStore = {
    getLatest: vi.fn().mockResolvedValue({
      id: 'probe-smoke',
      timestamp: '2026-04-14T10:00:00.000Z',
      serverId: 'srv-load',
      tps: 19.8,
      mspt: 34,
      onlinePlayers: 15,
      onlineBots: null,
      cpuUsage: 22,
      memoryUsageMb: 512,
      maxMemoryMb: 2048,
      entityCount: 300,
      loadedChunks: 128,
      worldCount: 2,
      maxPlayers: 100,
      pluginCount: 16,
      playerDetails: null,
      pluginDetails: null,
    }),
  };
  const jmxMetrics = {
    getLatest: vi.fn().mockResolvedValue({
      id: 'jmx-smoke',
      timestamp: '2026-04-14T10:00:00.000Z',
      serverId: 'srv-load',
      pid: '9527',
      heapUsedMb: 460,
      heapCommittedMb: 768,
      heapMaxMb: 1024,
      threadCount: 140,
      daemonThreadCount: 36,
      gcYoungCount: 2,
      gcFullCount: 0,
      gcYoungTimeMs: 15,
      gcFullTimeMs: 0,
    }),
  };
  const alertEngine = {
    getSummary: vi.fn().mockResolvedValue({ totalActive: 0, criticalCount: 0, warningCount: 0, infoCount: 0 }),
  };
  const alertStore = {
    getEnabledRules: vi.fn().mockResolvedValue([]),
  };
  const jmxScheduler = {
    listSchedules: vi.fn().mockReturnValue([]),
  };
  const platformRuntime = {
    getCapabilities: vi.fn().mockReturnValue({
      storageDialect: 'sqlite',
      logBackendMode: 'local-file',
      probeRuntimeKind: 'paper-1.20.4',
      realtimeCapacityMode: 'high-scale',
    }),
  };

  return {
    service: new MonitoringOverviewService(
      metricStore as any,
      jmxMetrics as any,
      alertEngine as any,
      alertStore as any,
      jmxScheduler as any,
      platformRuntime as any,
    ),
    metricStore,
    jmxMetrics,
    alertEngine,
    alertStore,
    jmxScheduler,
    platformRuntime,
  };
}

describe('Platform load smoke', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps MonitoringOverviewService.getOverview stable under high request counts', async () => {
    const ctx = createMonitoringOverviewCtx();

    const rounds = 400;
    const tasks = Array.from({ length: rounds }, () => ctx.service.getOverview('srv-load'));

    await expect(Promise.all(tasks)).resolves.toHaveLength(rounds);

    expect(ctx.metricStore.getLatest).toHaveBeenCalledTimes(rounds);
    expect(ctx.jmxMetrics.getLatest).toHaveBeenCalledTimes(rounds);
    expect(ctx.alertEngine.getSummary).toHaveBeenCalledTimes(rounds);
    expect(ctx.alertStore.getEnabledRules).toHaveBeenCalledTimes(rounds);
    expect(ctx.jmxScheduler.listSchedules).toHaveBeenCalledTimes(rounds);
  });

  it('keeps LogFileService.aggregateSearch stable under high request counts', async () => {
    const configService = {
      getAll: vi.fn().mockResolvedValue([{ id: 'srv-a' }, { id: 'srv-b' }]),
    };
    const service = new LogFileService(configService as any);

    vi.spyOn(service, 'listLogFiles').mockResolvedValue([
      { name: 'latest.log', size: 1024, modifiedAt: '2026-04-14T10:00:00.000Z', isGzipped: false },
    ]);
    vi.spyOn(service, 'searchLogFiles').mockResolvedValue([
      { file: 'latest.log', line: 1, content: 'ERROR request failed' },
    ]);

    const rounds = 300;
    const tasks = Array.from({ length: rounds }, () => service.aggregateSearch({ query: 'ERROR', maxPerServer: 5, maxTotal: 10 }));

    const results = await Promise.all(tasks);

    expect(results).toHaveLength(rounds);
    for (const item of results) {
      expect(item.length).toBeGreaterThan(0);
    }

    expect(configService.getAll).toHaveBeenCalledTimes(rounds);
  });
});
