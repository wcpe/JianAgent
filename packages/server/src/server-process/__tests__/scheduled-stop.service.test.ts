import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScheduledStopService } from '../scheduled-stop.service.js';

function createMockEventBus() {
  return {
    emit: vi.fn(),
    on: vi.fn(),
  };
}

describe('ScheduledStopService', () => {
  let service: ScheduledStopService;
  let mockEventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEventBus = createMockEventBus();
    service = new ScheduledStopService(mockEventBus as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should schedule a stop and return scheduled info', () => {
    const future = new Date(Date.now() + 120_000);
    service.schedule('srv-1', future, 'graceful');

    const info = service.getScheduled('srv-1');
    expect(info).not.toBeNull();
    expect(info!.mode).toBe('graceful');
    expect(info!.stopAt).toBe(future.toISOString());
  });

  it('should cancel a scheduled stop', () => {
    const future = new Date(Date.now() + 120_000);
    service.schedule('srv-1', future, 'force');

    const cancelled = service.cancel('srv-1');
    expect(cancelled).toBe(true);
    expect(service.getScheduled('srv-1')).toBeNull();
  });

  it('should return false when cancelling non-existent schedule', () => {
    expect(service.cancel('srv-999')).toBe(false);
  });

  it('should emit warning at 60s before stop', () => {
    const future = new Date(Date.now() + 120_000);
    service.schedule('srv-1', future, 'graceful');

    // Advance to 60s mark (120_000 - 60_000 = 60_000ms)
    vi.advanceTimersByTime(60_000);
    expect(mockEventBus.emit).toHaveBeenCalledWith('scheduled-stop-warning', {
      serverId: 'srv-1',
      secondsLeft: 60,
      reason: 'manual',
    });
  });

  it('should replace existing schedule when scheduling again', () => {
    const future1 = new Date(Date.now() + 60_000);
    const future2 = new Date(Date.now() + 300_000);
    service.schedule('srv-1', future1, 'graceful');
    service.schedule('srv-1', future2, 'force');

    const info = service.getScheduled('srv-1');
    expect(info!.mode).toBe('force');
    expect(info!.stopAt).toBe(future2.toISOString());
  });

  it('should include idempotency key in stop execution id', () => {
    const future = new Date(Date.now() + 50);
    service.schedule('srv-1', future, 'graceful', 'manual', 'idem-1');

    vi.advanceTimersByTime(50);
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'graceful-stop-requested',
      expect.objectContaining({
        serverId: 'srv-1',
        executionId: expect.stringContaining('idem-1'),
      }),
    );
  });

  it('should emit scheduled-restart-stop event with idempotency key', () => {
    service.schedule('srv-1', new Date(Date.now()), 'force', 'scheduled-restart', 'idem-scheduled');

    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'scheduled-restart-stop',
      expect.objectContaining({
        serverId: 'srv-1',
        executionId: expect.stringContaining('idem-scheduled'),
      }),
    );
  });

  it('should emit force-stop-requested event with idempotency key', () => {
    service.schedule('srv-1', new Date(Date.now()), 'force', 'manual', 'idem-force');

    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'force-stop-requested',
      expect.objectContaining({
        serverId: 'srv-1',
        executionId: expect.stringContaining('idem-force'),
      }),
    );
  });
});
