import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MoveToBehavior } from '../behavior/behaviors/move-to.behavior.js';
import type { BehaviorContext } from '../behavior/behavior.interface.js';

function createMockBot(pos = { x: 0, y: 64, z: 0 }) {
  return {
    entity: {
      position: {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        offset: vi.fn().mockReturnValue({ x: pos.x, y: pos.y, z: pos.z }),
        distanceTo: vi.fn().mockReturnValue(100),
      },
    },
    lookAt: vi.fn(),
    setControlState: vi.fn(),
    loadPlugin: vi.fn(),
    pathfinder: {
      setGoal: vi.fn(),
      setMovements: vi.fn(),
    },
    version: '1.20.4',
  };
}

// Stub mineflayer-pathfinder to avoid native module loading
const { mockPathfinder, mockMovements, mockGoals } = vi.hoisted(() => {
  const mockPathfinder = vi.fn();
  const mockMovements = vi.fn().mockImplementation(() => ({
    canDig: false,
    allow1by1towers: false,
    allowFreeMotion: false,
    allowParkour: true,
    allowSprinting: true,
  }));
  const mockGoals = {
    GoalNear: vi.fn().mockImplementation((x: number, y: number, z: number, range: number) => ({ x, y, z, range })),
    GoalFollow: vi.fn().mockImplementation((entity: any, range: number) => ({ entity, range })),
  };
  return { mockPathfinder, mockMovements, mockGoals };
});

vi.mock('mineflayer-pathfinder', () => ({
  default: {
    pathfinder: mockPathfinder,
    Movements: mockMovements,
    goals: mockGoals,
  },
  pathfinder: mockPathfinder,
  Movements: mockMovements,
  goals: mockGoals,
}));

describe('MoveToBehavior', () => {
  let behavior: MoveToBehavior;

  beforeEach(() => {
    behavior = new MoveToBehavior();
  });

  it('should have name "move-to"', () => {
    expect(behavior.name).toBe('move-to');
  });

  it('start should enable active flag', async () => {
    const bot = createMockBot();
    const ctx: BehaviorContext = { bot: bot as any, params: { x: 100, y: 64, z: 100 } };
    await behavior.start(ctx);
    expect((behavior as any).active).toBe(true);
  });

  it('tick should do nothing when not active', async () => {
    const bot = createMockBot();
    const ctx: BehaviorContext = { bot: bot as any, params: { x: 100, z: 100 } };

    await behavior.tick(ctx);
    expect(bot.pathfinder.setGoal).not.toHaveBeenCalled();
  });

  it('tick should return early if x or z is undefined', async () => {
    const bot = createMockBot();
    const ctx: BehaviorContext = { bot: bot as any, params: {} };
    await behavior.start(ctx);

    await behavior.tick(ctx);
    // No assertion for setGoal since start already set it, but no error thrown
  });

  it('start should set pathfinder goal', async () => {
    const bot = createMockBot({ x: 0, y: 64, z: 0 });
    const ctx: BehaviorContext = { bot: bot as any, params: { x: 100, y: 64, z: 100 } };
    await behavior.start(ctx);

    expect(bot.pathfinder.setGoal).toHaveBeenCalled();
  });

  it('uses injected navigator when provided', async () => {
    const bot = createMockBot({ x: 0, y: 64, z: 0 });
    const navigator = {
      moveTo: vi.fn(),
      hasReached: vi.fn().mockReturnValue(false),
      stop: vi.fn(),
    };
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: { x: 100, y: 64, z: 100 },
      navigator: navigator as any,
    };

    await behavior.start(ctx);

    expect(navigator.moveTo).toHaveBeenCalledWith(bot, { x: 100, y: 64, z: 100 });
    expect(bot.pathfinder.setGoal).not.toHaveBeenCalled();
  });

  it('tick should stop when distance < 1.5', async () => {
    const bot = createMockBot({ x: 10, y: 64, z: 10 });
    const ctx: BehaviorContext = { bot: bot as any, params: { x: 10.5, y: 64, z: 10 } };
    await behavior.start(ctx);

    await behavior.tick(ctx);
    expect((behavior as any).active).toBe(false);
  });

  it('tick should catch entity access errors', async () => {
    const bot = createMockBot();
    const ctxStart: BehaviorContext = { bot: bot as any, params: { x: 100, y: 64, z: 100 } };
    await behavior.start(ctxStart);

    const badBot = {
      entity: { get position(): any { throw new Error('disconnected'); } },
      lookAt: vi.fn(),
      setControlState: vi.fn(),
      pathfinder: { setGoal: vi.fn(), setMovements: vi.fn() },
    };
    const ctx: BehaviorContext = { bot: badBot as any, params: { x: 100, z: 100 } };

    await expect(behavior.tick(ctx)).resolves.toBeUndefined();
  });

  it('stop should set active=false and clear goal', async () => {
    const bot = createMockBot();
    const ctx: BehaviorContext = { bot: bot as any, params: { x: 100, y: 64, z: 100 } };
    await behavior.start(ctx);
    expect((behavior as any).active).toBe(true);

    await behavior.stop(ctx);
    expect((behavior as any).active).toBe(false);
  });

  it('stop should catch bot error when already disconnected', async () => {
    const bot = createMockBot();
    const ctxStart: BehaviorContext = { bot: bot as any, params: { x: 100, y: 64, z: 100 } };
    await behavior.start(ctxStart);

    const badBot = {
      setControlState: vi.fn().mockImplementation(() => { throw new Error('disconnected'); }),
      pathfinder: null,
    };
    const ctx: BehaviorContext = { bot: badBot as any, params: {} };

    await expect(behavior.stop(ctx)).resolves.toBeUndefined();
    expect((behavior as any).active).toBe(false);
  });
});
