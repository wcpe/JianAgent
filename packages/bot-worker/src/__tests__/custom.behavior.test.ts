import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomBehavior } from '../behavior/behaviors/custom.behavior.js';
import type { BehaviorContext } from '../behavior/behavior.interface.js';

function createMockBot() {
  return {
    chat: vi.fn(),
    setControlState: vi.fn(),
    look: vi.fn().mockResolvedValue(undefined),
  };
}

describe('CustomBehavior', () => {
  let behavior: CustomBehavior;

  beforeEach(() => {
    vi.useFakeTimers();
    behavior = new CustomBehavior();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have name "custom"', () => {
    expect(behavior.name).toBe('custom');
  });

  it('start should initialize actions from params', async () => {
    const bot = createMockBot();
    const actions = [{ type: 'chat' as const, params: { message: 'hello' } }];
    const ctx: BehaviorContext = { bot: bot as any, params: { actions } };

    await behavior.start(ctx);
    expect((behavior as any).currentIndex).toBe(0);
    expect((behavior as any).actions).toEqual(actions);
  });

  it('start should default to empty actions if not provided', async () => {
    const bot = createMockBot();
    const ctx: BehaviorContext = { bot: bot as any, params: {} };

    await behavior.start(ctx);
    expect((behavior as any).actions).toEqual([]);
  });

  it('tick should execute chat action', async () => {
    const bot = createMockBot();
    const actions = [{ type: 'chat' as const, params: { message: 'Hello World' } }];
    const ctx: BehaviorContext = { bot: bot as any, params: { actions } };

    await behavior.start(ctx);
    await behavior.tick(ctx);
    expect(bot.chat).toHaveBeenCalledWith('Hello World');
    expect((behavior as any).currentIndex).toBe(1);
  });

  it('tick should execute chat with default empty message', async () => {
    const bot = createMockBot();
    const actions = [{ type: 'chat' as const }];
    const ctx: BehaviorContext = { bot: bot as any, params: { actions } };

    await behavior.start(ctx);
    await behavior.tick(ctx);
    expect(bot.chat).toHaveBeenCalledWith('');
  });

  it('tick should execute jump action with timeout', async () => {
    const bot = createMockBot();
    const actions = [{ type: 'jump' as const }];
    const ctx: BehaviorContext = { bot: bot as any, params: { actions } };

    await behavior.start(ctx);
    await behavior.tick(ctx);
    expect(bot.setControlState).toHaveBeenCalledWith('jump', true);

    // Advance past the 500ms timeout
    vi.advanceTimersByTime(500);
    expect(bot.setControlState).toHaveBeenCalledWith('jump', false);
  });

  it('tick jump timeout should catch error if bot is gone', async () => {
    const bot = createMockBot();
    const actions = [{ type: 'jump' as const }];
    const ctx: BehaviorContext = { bot: bot as any, params: { actions } };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    // Make setControlState throw on second call (the timeout callback)
    bot.setControlState.mockImplementation(() => { throw new Error('disconnected'); });
    // Should not throw
    vi.advanceTimersByTime(500);
  });

  it('tick should execute look action', async () => {
    const bot = createMockBot();
    const actions = [{ type: 'look' as const, params: { yaw: 1.5, pitch: -0.5 } }];
    const ctx: BehaviorContext = { bot: bot as any, params: { actions } };

    await behavior.start(ctx);
    await behavior.tick(ctx);
    expect(bot.look).toHaveBeenCalledWith(1.5, -0.5);
  });

  it('tick should catch look error if bot disconnected', async () => {
    const bot = createMockBot();
    bot.look.mockRejectedValue(new Error('disconnected'));
    const actions = [{ type: 'look' as const, params: { yaw: 0, pitch: 0 } }];
    const ctx: BehaviorContext = { bot: bot as any, params: { actions } };

    await behavior.start(ctx);
    await expect(behavior.tick(ctx)).resolves.toBeUndefined();
  });

  it('tick should return early when all actions exhausted', async () => {
    const bot = createMockBot();
    const actions = [{ type: 'chat' as const, params: { message: 'hi' } }];
    const ctx: BehaviorContext = { bot: bot as any, params: { actions } };

    await behavior.start(ctx);
    await behavior.tick(ctx); // executes action 0
    expect(bot.chat).toHaveBeenCalledTimes(1);

    await behavior.tick(ctx); // currentIndex >= actions.length, returns early
    expect(bot.chat).toHaveBeenCalledTimes(1); // no additional call
  });

  it('stop should reset state', async () => {
    const bot = createMockBot();
    const actions = [{ type: 'chat' as const, params: { message: 'a' } }, { type: 'chat' as const, params: { message: 'b' } }];
    const ctx: BehaviorContext = { bot: bot as any, params: { actions } };

    await behavior.start(ctx);
    await behavior.tick(ctx); // execute first action

    await behavior.stop();
    expect((behavior as any).currentIndex).toBe(0);
    expect((behavior as any).actions).toEqual([]);
  });
});
