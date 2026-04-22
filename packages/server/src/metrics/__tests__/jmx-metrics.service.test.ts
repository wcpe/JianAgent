import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JmxMetricsService } from '../jmx-metrics.service.js';

describe('JmxMetricsService', () => {
  let javaHelper: any;
  let metricStore: any;
  let service: JmxMetricsService;

  beforeEach(() => {
    javaHelper = {
      attach: vi.fn(async () => ({})),
      detach: vi.fn(async () => ({})),
      sendCommand: vi.fn(async () => ({ data: { heapUsedMb: 512, threadCount: 88 } })),
      sampleHeap: vi.fn(async () => ({ data: { usedMb: 520, committedMb: 768, maxMb: 1024 } })),
      sampleThreads: vi.fn(async () => ({ data: { threadCount: 90, daemonThreadCount: 40 } })),
      collectJmxSnapshot: vi.fn(async ({ serverId, pid }: { serverId: string; pid: string }) => ({
        id: 'jmx-1',
        timestamp: new Date().toISOString(),
        serverId,
        pid,
        heapUsedMb: 512,
        heapCommittedMb: 768,
        heapMaxMb: 1024,
        threadCount: 88,
        daemonThreadCount: 40,
        gcYoungCount: 1,
        gcFullCount: 0,
        gcYoungTimeMs: 10,
        gcFullTimeMs: 0,
      })),
      getLatestJmx: vi.fn(async () => ({ id: 'jmx-1' })),
      getJmxHistory: vi.fn(async () => []),
      getAggregatedJmxHistory: vi.fn(async (input: any) => {
        // Simple bucket aggregation for test
        const snapshots = [
          {
            timestamp: '2026-04-14T10:00:05.000Z', serverId: 'srv-1', pid: 'p-1',
            heapUsedMb: 100, heapCommittedMb: 200, heapMaxMb: 300,
            threadCount: 20, daemonThreadCount: 10,
            gcYoungCount: 1, gcFullCount: 0, gcYoungTimeMs: 12, gcFullTimeMs: 0,
          },
          {
            timestamp: '2026-04-14T10:00:25.000Z', serverId: 'srv-1', pid: 'p-1',
            heapUsedMb: 200, heapCommittedMb: 260, heapMaxMb: 300,
            threadCount: 24, daemonThreadCount: 12,
            gcYoungCount: 2, gcFullCount: 0, gcYoungTimeMs: 20, gcFullTimeMs: 0,
          },
          {
            timestamp: '2026-04-14T10:01:10.000Z', serverId: 'srv-1', pid: 'p-2',
            heapUsedMb: 300, heapCommittedMb: 320, heapMaxMb: 400,
            threadCount: 30, daemonThreadCount: 15,
            gcYoungCount: 3, gcFullCount: 1, gcYoungTimeMs: 30, gcFullTimeMs: 8,
          },
        ];
        // Bucket by minute
        const buckets = new Map<string, any[]>();
        for (const s of snapshots) {
          const minute = s.timestamp.slice(0, 16);
          if (!buckets.has(minute)) buckets.set(minute, []);
          buckets.get(minute)!.push(s);
        }
        return [...buckets.values()].map((samples) => ({
          startTime: samples[0].timestamp,
          endTime: samples[samples.length - 1].timestamp,
          sampleCount: samples.length,
          heapUsedMb: Math.round(samples.reduce((a: number, s: any) => a + s.heapUsedMb, 0) / samples.length),
          heapCommittedMb: Math.round(samples.reduce((a: number, s: any) => a + s.heapCommittedMb, 0) / samples.length),
          heapMaxMb: Math.max(...samples.map((s: any) => s.heapMaxMb)),
          threadCount: Math.round(samples.reduce((a: number, s: any) => a + s.threadCount, 0) / samples.length),
          daemonThreadCount: Math.round(samples.reduce((a: number, s: any) => a + s.daemonThreadCount, 0) / samples.length),
          gcYoungCount: samples.reduce((a: number, s: any) => a + s.gcYoungCount, 0),
          gcFullCount: samples.reduce((a: number, s: any) => a + s.gcFullCount, 0),
          gcYoungTimeMs: samples.reduce((a: number, s: any) => a + s.gcYoungTimeMs, 0),
          gcFullTimeMs: samples.reduce((a: number, s: any) => a + s.gcFullTimeMs, 0),
        }));
      }),
    };
    metricStore = {
      insertJmx: vi.fn(async () => 'jmx-1'),
      getLatestJmx: vi.fn(async () => ({ id: 'jmx-1' })),
      queryJmxRange: vi.fn(async () => []),
    };
    service = new JmxMetricsService(javaHelper);
  });

  it('collects jmx snapshot and stores it', async () => {
    const snapshot = await service.collectSnapshot({ serverId: 'srv-1', pid: '1234' });
    expect(javaHelper.collectJmxSnapshot).toHaveBeenCalledWith({ serverId: 'srv-1', pid: '1234' });
    expect(snapshot.id).toBe('jmx-1');
    expect(snapshot.serverId).toBe('srv-1');
    expect(snapshot.pid).toBe('1234');
    expect(snapshot.heapUsedMb).toBe(512);
  });

  it('aggregates jmx history into time buckets', async () => {
    javaHelper.getAggregatedJmxHistory.mockResolvedValue([
      {
        startTime: '2026-04-14T10:00:00.000Z',
        endTime: '2026-04-14T10:00:59.000Z',
        sampleCount: 2,
        heapUsedMb: 150,
        heapCommittedMb: 230,
        heapMaxMb: 300,
        threadCount: 22,
        daemonThreadCount: 11,
        gcYoungCount: 3,
        gcFullCount: 0,
        gcYoungTimeMs: 32,
        gcFullTimeMs: 0,
      },
      {
        startTime: '2026-04-14T10:01:00.000Z',
        endTime: '2026-04-14T10:01:59.000Z',
        sampleCount: 1,
        heapUsedMb: 300,
        heapCommittedMb: 320,
        heapMaxMb: 400,
        threadCount: 30,
        daemonThreadCount: 15,
        gcYoungCount: 3,
        gcFullCount: 1,
        gcYoungTimeMs: 30,
        gcFullTimeMs: 8,
      },
    ]);

    const aggregated = await service.getAggregatedHistory({
      serverId: 'srv-1',
      startTime: '2026-04-14T10:00:00.000Z',
      endTime: '2026-04-14T10:05:00.000Z',
      intervalSec: 60,
      limit: 10,
    });

    expect(aggregated).toHaveLength(2);
    expect(aggregated[0].sampleCount).toBe(2);
    expect(aggregated[0].heapUsedMb).toBe(150);
    expect(aggregated[1].sampleCount).toBe(1);
    expect(aggregated[1].heapUsedMb).toBe(300);
  });
});
