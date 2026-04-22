import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { JvmDiagnosticsService } from '../jvm-diagnostics.service.js';

function createService() {
  const jvmFacade = {
    getLatestJmx: vi.fn(),
    getStatus: vi.fn(),
    listJfrTasks: vi.fn(),
  };
  const jmxScheduler = {
    listSchedules: vi.fn(),
  };
  const monitoringOverview = {
    getOverview: vi.fn(),
  };
  const multiServer = {
    getServer: vi.fn(),
  };
  const contextMapper = {
    toContext: vi.fn(),
  };

  const service = new JvmDiagnosticsService(
    jvmFacade as any,
    jmxScheduler as any,
    monitoringOverview as any,
    multiServer as any,
    contextMapper as any,
  );

  return { service, jvmFacade, jmxScheduler, monitoringOverview, multiServer, contextMapper };
}

describe('JvmDiagnosticsService', () => {
  let ctx: ReturnType<typeof createService>;

  beforeEach(() => {
    ctx = createService();
    vi.clearAllMocks();
  });

  it('throws NotFoundException when server is not found', async () => {
    ctx.multiServer.getServer.mockResolvedValue(null);

    await expect(ctx.service.buildSummary('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('builds a healthy summary when all data is available', async () => {
    ctx.multiServer.getServer.mockResolvedValue({ id: 'host-1', name: 'TestServer' });
    ctx.monitoringOverview.getOverview.mockResolvedValue({
      state: 'healthy',
      signals: [],
      latestProbe: { timestamp: new Date().toISOString() },
      latestJmx: null,
    });
    ctx.jvmFacade.getLatestJmx.mockResolvedValue({
      heapUsedMb: 256,
      heapMaxMb: 1024,
      threadCount: 50,
    });
    ctx.jvmFacade.getStatus.mockResolvedValue({ state: 'ATTACHED', attachedPid: '1234' });
    ctx.jvmFacade.listJfrTasks.mockResolvedValue([]);

    const summary = await ctx.service.buildSummary('srv-1');

    expect(summary.target.serverId).toBe('srv-1');
    expect(summary.target.serverName).toBe('TestServer');
    expect(summary.healthState).toBe('healthy');
    expect(summary.helperAttached).toBe(true);
    expect(summary.jmxConnected).toBe(true);
    expect(summary.riskSignals).toHaveLength(0);
    expect(summary.activeJfrRecordings).toHaveLength(0);
    expect(summary.generatedAt).toBeDefined();
  });

  it('derives risk signals from monitoring overview signals', async () => {
    ctx.multiServer.getServer.mockResolvedValue({ id: 'host-1', name: 'TestServer' });
    ctx.monitoringOverview.getOverview.mockResolvedValue({
      state: 'degraded',
      signals: [
        { source: 'probe', metric: 'CPU_USAGE', level: 'WARNING', message: 'High CPU', value: 92, threshold: 80 },
        { source: 'jmx', metric: 'HEAP_USED_RATIO', level: 'CRITICAL', message: 'Heap full', value: 0.95, threshold: 0.85 },
        { source: 'jmx', metric: 'THREAD_COUNT', level: 'WARNING', message: 'Thread contention', value: 300, threshold: 200 },
      ],
      latestProbe: { timestamp: new Date().toISOString() },
      latestJmx: null,
    });
    ctx.jvmFacade.getLatestJmx.mockResolvedValue(null);
    ctx.jvmFacade.getStatus.mockResolvedValue({ state: 'IDLE' });
    ctx.jvmFacade.listJfrTasks.mockResolvedValue([]);

    const summary = await ctx.service.buildSummary('srv-1');

    expect(summary.riskSignals.length).toBeGreaterThanOrEqual(3);
    // Should be sorted by severity: CRITICAL first
    expect(summary.riskSignals[0].level).toBe('CRITICAL');
    expect(summary.healthState).toBe('degraded');
  });

  it('surfaces JFR recording failures as risk signals', async () => {
    ctx.multiServer.getServer.mockResolvedValue({ id: 'host-1', name: 'TestServer' });
    ctx.monitoringOverview.getOverview.mockResolvedValue({
      state: 'healthy',
      signals: [],
      latestProbe: { timestamp: new Date().toISOString() },
      latestJmx: null,
    });
    ctx.jvmFacade.getLatestJmx.mockResolvedValue(null);
    ctx.jvmFacade.getStatus.mockResolvedValue({ state: 'IDLE' });
    ctx.jvmFacade.listJfrTasks.mockResolvedValue([
      { id: 'jfr-1', status: 'running', startedAt: '2026-04-15T10:00:00Z' },
      { id: 'jfr-2', status: 'failed', error: 'timeout', startedAt: '2026-04-15T09:00:00Z', endedAt: '2026-04-15T09:01:00Z' },
    ]);

    const summary = await ctx.service.buildSummary('srv-1');

    const jfrFailSignal = summary.riskSignals.find((s) => s.type === 'jfr-recording-failed');
    expect(jfrFailSignal).toBeDefined();
    expect(jfrFailSignal!.level).toBe('WARNING');
    expect(jfrFailSignal!.message).toContain('timeout');
    expect(summary.activeJfrRecordings).toHaveLength(1);
    expect(summary.activeJfrRecordings[0].id).toBe('jfr-1');
  });

  it('resolves health state as critical when monitoring state is critical', async () => {
    ctx.multiServer.getServer.mockResolvedValue({ id: 'host-1', name: 'TestServer' });
    ctx.monitoringOverview.getOverview.mockResolvedValue({
      state: 'critical',
      signals: [],
      latestProbe: null,
      latestJmx: null,
    });
    ctx.jvmFacade.getLatestJmx.mockResolvedValue(null);
    ctx.jvmFacade.getStatus.mockResolvedValue({ state: 'IDLE' });
    ctx.jvmFacade.listJfrTasks.mockResolvedValue([]);

    const summary = await ctx.service.buildSummary('srv-1');

    expect(summary.healthState).toBe('critical');
  });

  it('handles null monitoring overview gracefully', async () => {
    ctx.multiServer.getServer.mockResolvedValue({ id: 'host-1', name: 'TestServer' });
    ctx.monitoringOverview.getOverview.mockRejectedValue(new Error('timeout'));
    ctx.jvmFacade.getLatestJmx.mockResolvedValue(null);
    ctx.jvmFacade.getStatus.mockResolvedValue({ state: 'IDLE' });
    ctx.jvmFacade.listJfrTasks.mockResolvedValue([]);

    const summary = await ctx.service.buildSummary('srv-1');

    expect(summary.healthState).toBe('unknown');
    expect(summary.riskSignals).toHaveLength(0);
    expect(summary.uptimeSeconds).toBeNull();
  });

  it('maps GC_PRESSURE metric to gc-pressure risk type', async () => {
    ctx.multiServer.getServer.mockResolvedValue({ id: 'host-1', name: 'TestServer' });
    ctx.monitoringOverview.getOverview.mockResolvedValue({
      state: 'degraded',
      signals: [
        { source: 'jmx', metric: 'GC_PRESSURE', level: 'WARNING', message: 'GC pressure high', value: 0.8, threshold: 0.6 },
      ],
      latestProbe: { timestamp: new Date().toISOString() },
      latestJmx: null,
    });
    ctx.jvmFacade.getLatestJmx.mockResolvedValue(null);
    ctx.jvmFacade.getStatus.mockResolvedValue({ state: 'IDLE' });
    ctx.jvmFacade.listJfrTasks.mockResolvedValue([]);

    const summary = await ctx.service.buildSummary('srv-1');

    expect(summary.riskSignals.some((s) => s.type === 'gc-pressure')).toBe(true);
  });

  it('detects helper attached via attachedPid even when state is not ATTACHED', async () => {
    ctx.multiServer.getServer.mockResolvedValue({ id: 'host-1', name: 'TestServer' });
    ctx.monitoringOverview.getOverview.mockResolvedValue({
      state: 'healthy',
      signals: [],
      latestProbe: { timestamp: new Date().toISOString() },
      latestJmx: null,
    });
    ctx.jvmFacade.getLatestJmx.mockResolvedValue(null);
    ctx.jvmFacade.getStatus.mockResolvedValue({ state: 'CONNECTING', attachedPid: '5678' });
    ctx.jvmFacade.listJfrTasks.mockResolvedValue([]);

    const summary = await ctx.service.buildSummary('srv-1');

    expect(summary.helperAttached).toBe(true);
  });
});
