import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateReporter } from '../reporter/state-reporter.js';
import { BotRegistry } from '../registry/bot-registry.js';

describe('StateReporter', () => {
  let registry: BotRegistry;
  let sendFn: ReturnType<typeof vi.fn>;
  let reporter: StateReporter;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new BotRegistry();
    sendFn = vi.fn();
    reporter = new StateReporter(registry, sendFn, 1_000);
  });

  afterEach(() => {
    reporter.stop();
    vi.useRealTimers();
  });

  it('should send snapshot on interval', () => {
    registry.add({ name: 'bot_1', state: 'SPAWNED', bot: null, currentBehavior: null, connectedAt: null, lastError: null, lastDisconnectReason: null, deathCount: 0 });
    reporter.start();
    vi.advanceTimersByTime(1_100);
    expect(sendFn).toHaveBeenCalled();
    const payload = sendFn.mock.calls[0][0];
    expect(payload.bots).toHaveLength(1);
    expect(payload.bots[0].name).toBe('bot_1');
  });

  it('should stop sending after stop()', () => {
    reporter.start();
    reporter.stop();
    vi.advanceTimersByTime(3_000);
    expect(sendFn).not.toHaveBeenCalled();
  });
});
