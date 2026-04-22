import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BehaviorEngine } from '../behavior/behavior-engine.js';
import type { Behavior, BehaviorContext } from '../behavior/behavior.interface.js';

function createMockBehavior(name = 'mock'): Behavior {
  return {
    name,
    start: vi.fn(),
    tick: vi.fn(),
    stop: vi.fn(),
  };
}

describe('BehaviorEngine', () => {
  let engine: BehaviorEngine;
  const ctx: BehaviorContext = { bot: {} as any, params: {} };

  beforeEach(() => {
    engine = new BehaviorEngine();
  });

  it('should start a behavior via switchBehavior', async () => {
    const b = createMockBehavior();
    await engine.switchBehavior(b, ctx);
    expect(b.start).toHaveBeenCalledWith(ctx);
  });

  it('should stop previous behavior on switch', async () => {
    const b1 = createMockBehavior('b1');
    const b2 = createMockBehavior('b2');
    await engine.switchBehavior(b1, ctx);
    await engine.switchBehavior(b2, ctx);
    expect(b1.stop).toHaveBeenCalled();
    expect(b2.start).toHaveBeenCalledWith(ctx);
  });

  it('should tick current behavior', async () => {
    const b = createMockBehavior();
    await engine.switchBehavior(b, ctx);
    await engine.tick(ctx);
    expect(b.tick).toHaveBeenCalledWith(ctx);
  });

  it('should stop current via stopCurrent', async () => {
    const b = createMockBehavior();
    await engine.switchBehavior(b, ctx);
    await engine.stopCurrent(ctx);
    expect(b.stop).toHaveBeenCalled();
  });
});
