import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GatherBehavior } from '../behavior/behaviors/gather.behavior.js';
import type { BehaviorContext } from '../behavior/behavior.interface.js';

function createMockBot(pos = { x: 0, y: 64, z: 0 }, block?: { position: { x: number; y: number; z: number } }) {
  return {
    entity: {
      position: {
        x: pos.x,
        y: pos.y,
        z: pos.z,
      },
    },
    findBlock: vi.fn().mockReturnValue(block ?? null),
    dig: vi.fn().mockResolvedValue(undefined),
    loadPlugin: vi.fn(),
    pathfinder: {
      setGoal: vi.fn(),
      setMovements: vi.fn(),
    },
    version: '1.21.1',
  };
}

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

describe('GatherBehavior', () => {
  let behavior: GatherBehavior;

  beforeEach(() => {
    behavior = new GatherBehavior();
  });

  it('navigates toward a distant target block before digging', async () => {
    const block = { position: { x: 10, y: 64, z: 10 } };
    const bot = createMockBot({ x: 0, y: 64, z: 0 }, block);
    const ctx: BehaviorContext = { bot: bot as any, params: { blockType: 'dirt', radius: 16 } };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    expect(bot.findBlock).toHaveBeenCalled();
    expect(bot.pathfinder.setGoal).toHaveBeenCalledWith(expect.objectContaining({
      x: 10,
      y: 64,
      z: 10,
      range: 2,
    }));
    expect(bot.dig).not.toHaveBeenCalled();
  });

  it('digs a nearby target block once it is in range', async () => {
    const block = { position: { x: 1, y: 64, z: 1 } };
    const bot = createMockBot({ x: 0, y: 64, z: 0 }, block);
    const ctx: BehaviorContext = { bot: bot as any, params: { blockType: 'dirt', radius: 8 } };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    expect(bot.pathfinder.setGoal).toHaveBeenCalledWith(null);
    expect(bot.dig).toHaveBeenCalledWith(block);
  });

  it('accepts multiple natural surface block types when resolving gather targets', async () => {
    const block = { name: 'grass_block', position: { x: 1, y: 64, z: 1 } };
    const bot = createMockBot({ x: 0, y: 64, z: 0 }, block);
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: { blockTypes: ['grass_block', 'dirt'], radius: 8 },
    };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    const matcher = bot.findBlock.mock.calls[0]?.[0]?.matching;
    expect(typeof matcher).toBe('function');
    expect(matcher?.({ name: 'grass_block' })).toBe(true);
    expect(matcher?.({ name: 'dirt' })).toBe(true);
    expect(matcher?.({ name: 'stone' })).toBe(false);
    expect(bot.dig).toHaveBeenCalledWith(block);
  });

  it('uses injected navigator when approaching a distant gather target', async () => {
    const block = { position: { x: 10, y: 64, z: 10 } };
    const bot = createMockBot({ x: 0, y: 64, z: 0 }, block);
    const navigator = {
      moveTo: vi.fn(),
      hasReached: vi.fn().mockReturnValue(false),
      stop: vi.fn(),
    };
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: { blockType: 'dirt', radius: 16 },
      navigator: navigator as any,
    };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    expect(navigator.moveTo).toHaveBeenCalledWith(bot, { x: 10, y: 64, z: 10, radius: 2 });
    expect(bot.pathfinder.setGoal).not.toHaveBeenCalled();
    expect(bot.dig).not.toHaveBeenCalled();
  });
});
