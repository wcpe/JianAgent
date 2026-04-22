import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessResourceMonitor } from '../monitor/process-resource-monitor.service.js';

describe('ProcessResourceMonitor', () => {
  let monitor: ProcessResourceMonitor;
  let mockStore: any;
  let mockEventBus: any;

  beforeEach(() => {
    mockStore = {
      save: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };
    mockEventBus = {
      emit: vi.fn(),
    };
    monitor = new ProcessResourceMonitor(mockStore, mockEventBus);
  });

  it('should start monitoring a server', () => {
    monitor.startMonitoring('srv-1', process.pid);
    expect(monitor.isMonitoring('srv-1')).toBe(true);
  });

  it('should stop monitoring a server', () => {
    monitor.startMonitoring('srv-1', process.pid);
    monitor.stopMonitoring('srv-1');
    expect(monitor.isMonitoring('srv-1')).toBe(false);
  });

  it('should collect metrics for a running process', async () => {
    monitor.startMonitoring('srv-1', process.pid);
    const metrics = await monitor.collectOnce('srv-1');
    expect(metrics).not.toBeNull();
    expect(metrics!.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(metrics!.rssBytes).toBeGreaterThan(0);
    monitor.stopMonitoring('srv-1');
  });

  it('should return null for unmonitored server', async () => {
    const metrics = await monitor.collectOnce('nonexistent');
    expect(metrics).toBeNull();
  });
});