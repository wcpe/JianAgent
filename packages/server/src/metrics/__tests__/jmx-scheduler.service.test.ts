import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JmxSchedulerService } from '../jmx-scheduler.service.js';

describe('JmxSchedulerService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('collects jmx snapshots on interval and can remove schedule', async () => {
    const jmxMetricsService = {
      collectSnapshot: vi.fn(async () => ({ heapUsedMb: 800, threadCount: 30 })),
    };
    const alertEngine = {
      fireJmxThresholdAlert: vi.fn(async () => undefined),
    };

    const service = new JmxSchedulerService(jmxMetricsService as any, alertEngine as any);
    const schedule = await service.createSchedule({
      serverId: 'srv-1',
      pid: '1234',
      intervalSec: 5,
      heapUsedThresholdMb: 700,
    });

    await vi.advanceTimersByTimeAsync(5000);

    expect(jmxMetricsService.collectSnapshot).toHaveBeenCalledTimes(1);
    expect(alertEngine.fireJmxThresholdAlert).toHaveBeenCalledTimes(1);
    expect(service.listSchedules()).toHaveLength(1);
    expect(service.removeSchedule(schedule.id)).toBe(true);
  });
});
