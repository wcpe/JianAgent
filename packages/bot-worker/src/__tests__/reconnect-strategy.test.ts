import { describe, it, expect, beforeEach } from 'vitest';
import { ReconnectStrategy } from '../lifecycle/reconnect-strategy.js';

describe('ReconnectStrategy', () => {
  let strategy: ReconnectStrategy;

  beforeEach(() => {
    strategy = new ReconnectStrategy(5, 1000, 30_000, 2);
  });

  it('should allow reconnect when under max retries', () => {
    expect(strategy.shouldReconnect()).toBe(true);
  });

  it('should disallow after max retries', () => {
    for (let i = 0; i < 5; i++) strategy.recordFailure();
    expect(strategy.shouldReconnect()).toBe(false);
  });

  it('should compute exponential delay', () => {
    const d0 = strategy.nextDelayMs();
    strategy.recordFailure();
    const d1 = strategy.nextDelayMs();
    expect(d1).toBeGreaterThan(d0);
  });

  it('should cap delay at maxDelayMs', () => {
    for (let i = 0; i < 20; i++) strategy.recordFailure();
    expect(strategy.nextDelayMs()).toBeLessThanOrEqual(30_000);
  });

  it('should reset state', () => {
    for (let i = 0; i < 5; i++) strategy.recordFailure();
    strategy.reset();
    expect(strategy.shouldReconnect()).toBe(true);
  });
});
