import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonitoringOverviewService } from '../monitoring-overview.service.js';

function createService() {
  const metricStore = {
    getLatest: vi.fn(),
  };
  const jmxMetrics = {
    getLatest: vi.fn(),
  };
  const alertEngine = {
    getSummary: vi.fn(),
  };
  const alertStore = {
    getEnabledRules: vi.fn(),
  };
  const jmxScheduler = {
    listSchedules: vi.fn(),
  };
  const platformRuntime = {
    getCapabilities: vi.fn().mockReturnValue({
      storageDialect: 'sqlite',
      logBackendMode: 'hybrid',
      probeRuntimeKind: 'paper-1.21+',
      realtimeCapacityMode: 'standard',
    }),
  };

  return {
    service: new MonitoringOverviewService(metricStore as any, jmxMetrics as any, alertEngine as any, alertStore as any, jmxScheduler as any, platformRuntime as any),
    metricStore,
    jmxMetrics,
    alertEngine,
    alertStore,
    jmxScheduler,
    platformRuntime,
  };
}

describe('MonitoringOverviewService', () => {
  let ctx: ReturnType<typeof createService>;

  beforeEach(() => {
    ctx = createService();
  });

  it('builds a healthy overview when metrics are within thresholds', async () => {
    ctx.metricStore.getLatest.mockResolvedValue({
      id: 'probe-1',
      timestamp: '2026-04-14T10:00:00.000Z',
      serverId: 'srv-1',
      tps: 19.5,
      mspt: 35,
      onlinePlayers: 3,
      onlineBots: null,
      cpuUsage: 20,
      memoryUsageMb: 512,
      maxMemoryMb: 2048,
      entityCount: 100,
      loadedChunks: 24,
      worldCount: 1,
      maxPlayers: 20,
      pluginCount: 4,
      playerDetails: null,
      pluginDetails: null,
    });
    ctx.jmxMetrics.getLatest.mockResolvedValue({
      id: 'jmx-1',
      timestamp: '2026-04-14T10:00:00.000Z',
      serverId: 'srv-1',
      pid: '1234',
      heapUsedMb: 256,
      heapCommittedMb: 512,
      heapMaxMb: 1024,
      threadCount: 90,
      daemonThreadCount: 20,
      gcYoungCount: 1,
      gcFullCount: 0,
      gcYoungTimeMs: 12,
      gcFullTimeMs: 0,
    });
    ctx.alertEngine.getSummary.mockResolvedValue({ totalActive: 0, criticalCount: 0, warningCount: 0, infoCount: 0 });
    ctx.alertStore.getEnabledRules.mockResolvedValue([]);
    ctx.jmxScheduler.listSchedules.mockReturnValue([]);

    const overview = await ctx.service.getOverview('srv-1');

    expect(overview.state).toBe('healthy');
    expect(overview.backend).toBe('hybrid');
    expect(overview.logBackendState).toBe('degraded');
    expect(overview.degradedMode).toBe(true);
    expect(overview.probeRuntimeKind).toBe('paper-1.21+');
    expect(overview.signals).toHaveLength(0);
    expect(overview.latestProbe?.serverId).toBe('srv-1');
    expect(overview.latestJmx?.serverId).toBe('srv-1');
  });

  it('surfaces degraded signals for low TPS and high JVM heap usage', async () => {
    ctx.metricStore.getLatest.mockResolvedValue({
      id: 'probe-2',
      timestamp: '2026-04-14T10:00:00.000Z',
      serverId: 'srv-1',
      tps: 12.1,
      mspt: 71,
      onlinePlayers: 18,
      onlineBots: null,
      cpuUsage: 88,
      memoryUsageMb: 1700,
      maxMemoryMb: 2048,
      entityCount: 1000,
      loadedChunks: 250,
      worldCount: 3,
      maxPlayers: 30,
      pluginCount: 12,
      playerDetails: null,
      pluginDetails: null,
    });
    ctx.jmxMetrics.getLatest.mockResolvedValue({
      id: 'jmx-2',
      timestamp: '2026-04-14T10:00:00.000Z',
      serverId: 'srv-1',
      pid: '1234',
      heapUsedMb: 900,
      heapCommittedMb: 1024,
      heapMaxMb: 1000,
      threadCount: 240,
      daemonThreadCount: 50,
      gcYoungCount: 3,
      gcFullCount: 1,
      gcYoungTimeMs: 18,
      gcFullTimeMs: 9,
    });
    ctx.alertEngine.getSummary.mockResolvedValue({ totalActive: 2, criticalCount: 1, warningCount: 1, infoCount: 0 });
    ctx.alertStore.getEnabledRules.mockResolvedValue([{ id: 'rule-1' } as any]);
    ctx.jmxScheduler.listSchedules.mockReturnValue([{ serverId: 'srv-1', heapUsedThresholdMb: 800, threadThreshold: 200 } as any]);

    const overview = await ctx.service.getOverview('srv-1');

    expect(overview.state).toBe('critical');
    expect(overview.signals.some((item) => item.metric === 'TPS')).toBe(true);
    expect(overview.signals.some((item) => item.metric === 'HEAP_USED_MB' || item.metric === 'HEAP_USED_RATIO')).toBe(true);
    expect(overview.signals.some((item) => item.metric === 'THREAD_COUNT')).toBe(true);
    expect(overview.activeRuleCount).toBe(1);
    expect(overview.activeJmxScheduleCount).toBe(1);
  });
});
