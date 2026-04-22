import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HealthMonitorService } from '../health-monitor.service.js';

describe('HealthMonitorService', () => {
  let service: HealthMonitorService;
  let events: Array<{ type: string; serverId: string; detail: string }>;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new HealthMonitorService();
    events = [];
    service.setEventCallback((e) => events.push(e));
  });

  afterEach(() => {
    service.onModuleDestroy();
    vi.useRealTimers();
  });

  it('should track monitored servers', () => {
    service.startMonitoring('srv-1', 12345);
    expect(service.getMonitoredServers()).toContain('srv-1');
  });

  it('should stop monitoring a server', () => {
    service.startMonitoring('srv-1', 12345);
    service.stopMonitoring('srv-1');
    expect(service.getMonitoredServers()).not.toContain('srv-1');
  });

  it('should update lastSnapshotTime on snapshot received', () => {
    service.startMonitoring('srv-1', 12345);
    expect(service.isUnresponsive('srv-1')).toBe(false);

    // Confirming receipt does not flag unresponsive
    service.onSnapshotReceived('srv-1');
    expect(service.isUnresponsive('srv-1')).toBe(false);
  });

  it('should detect unresponsive after threshold', () => {
    // Mock process.kill to return true (PID alive)
    vi.spyOn(process, 'kill').mockImplementation(() => true);

    service.onModuleInit();
    service.startMonitoring('srv-1', 99999);

    // Advance past the 30s threshold + poll interval
    vi.advanceTimersByTime(35_000);

    expect(service.isUnresponsive('srv-1')).toBe(true);
    expect(events.some((e) => e.type === 'unresponsive' && e.serverId === 'srv-1')).toBe(true);
  });

  it('should emit recovered event when snapshot resumes', () => {
    vi.spyOn(process, 'kill').mockImplementation(() => true);

    service.onModuleInit();
    service.startMonitoring('srv-1', 99999);

    // Become unresponsive
    vi.advanceTimersByTime(35_000);
    expect(service.isUnresponsive('srv-1')).toBe(true);

    // Recover
    service.onSnapshotReceived('srv-1');
    expect(service.isUnresponsive('srv-1')).toBe(false);
    expect(events.some((e) => e.type === 'recovered')).toBe(true);
  });
});
