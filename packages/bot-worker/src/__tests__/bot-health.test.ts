import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BotHealthChecker } from '../lifecycle/bot-health.js';

describe('BotHealthChecker', () => {
  let checker: BotHealthChecker;

  beforeEach(() => {
    vi.useFakeTimers();
    checker = new BotHealthChecker(5_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should consider a bot healthy after heartbeat', () => {
    checker.recordHeartbeat('bot_1');
    expect(checker.isHealthy('bot_1')).toBe(true);
  });

  it('should consider a bot unhealthy after timeout', () => {
    checker.recordHeartbeat('bot_1');
    vi.advanceTimersByTime(6_000);
    expect(checker.isHealthy('bot_1')).toBe(false);
  });

  it('should return false for unknown bot', () => {
    expect(checker.isHealthy('unknown')).toBe(false);
  });

  it('should remove and clear', () => {
    checker.recordHeartbeat('bot_1');
    checker.remove('bot_1');
    expect(checker.isHealthy('bot_1')).toBe(false);
    checker.recordHeartbeat('bot_2');
    checker.clear();
    expect(checker.isHealthy('bot_2')).toBe(false);
  });
});
