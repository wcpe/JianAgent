import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PhaseConditionService } from '../phase-condition.service.js';

describe('PhaseConditionService', () => {
  let service: PhaseConditionService;

  beforeEach(() => {
    service = new PhaseConditionService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should trigger when time_elapsed condition is met', () => {
    const callback = vi.fn();

    service.startEvaluating('sess-1', 0, {
      conditions: [{ type: 'time_elapsed', params: { seconds: 4 } }],
      combinator: 'AND',
    }, callback);

    expect(service.isEvaluating('sess-1')).toBe(true);

    // Advance 3 seconds — should not trigger
    vi.advanceTimersByTime(3_000);
    expect(callback).not.toHaveBeenCalled();

    // Advance to 5 seconds total — should trigger
    vi.advanceTimersByTime(2_000);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(service.isEvaluating('sess-1')).toBe(false);
  });

  it('should trigger on custom_event injection', () => {
    const callback = vi.fn();

    service.startEvaluating('sess-2', 1, {
      conditions: [{ type: 'custom_event', params: { eventName: 'game_over' } }],
      combinator: 'OR',
    }, callback);

    vi.advanceTimersByTime(2_000);
    expect(callback).not.toHaveBeenCalled();

    service.injectCustomEvent('sess-2', 'game_over');
    vi.advanceTimersByTime(2_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should evaluate AND combinator correctly (all must be true)', () => {
    const callback = vi.fn();

    service.setMetricsProvider(() => ({
      botCount: 10,
      readyBotCount: 10,
      tps: 20,
    }));

    service.startEvaluating('sess-3', 0, {
      conditions: [
        { type: 'all_bots_ready', params: {} },
        { type: 'time_elapsed', params: { seconds: 2 } },
      ],
      combinator: 'AND',
    }, callback);

    // At 2s: time met, bots ready → should trigger
    vi.advanceTimersByTime(2_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should evaluate OR combinator correctly (any triggers)', () => {
    const callback = vi.fn();

    service.setMetricsProvider(() => ({
      botCount: 10,
      readyBotCount: 5,
      tps: 15,
    }));

    service.startEvaluating('sess-4', 0, {
      conditions: [
        { type: 'all_bots_ready', params: {} },      // false
        { type: 'tps_below', params: { threshold: 18 } }, // true (15 < 18)
      ],
      combinator: 'OR',
    }, callback);

    vi.advanceTimersByTime(2_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should stop evaluating and not trigger after stopEvaluating', () => {
    const callback = vi.fn();

    service.startEvaluating('sess-5', 0, {
      conditions: [{ type: 'time_elapsed', params: { seconds: 2 } }],
      combinator: 'AND',
    }, callback);

    service.stopEvaluating('sess-5');
    vi.advanceTimersByTime(5_000);
    expect(callback).not.toHaveBeenCalled();
    expect(service.isEvaluating('sess-5')).toBe(false);
  });
});
