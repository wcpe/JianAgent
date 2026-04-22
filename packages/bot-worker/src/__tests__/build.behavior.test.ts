import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildBehavior } from '../behavior/behaviors/build.behavior.js';
import type { BehaviorContext } from '../behavior/behavior.interface.js';
import { Vec3 } from 'vec3';

interface MockBlock {
  readonly name: string;
  readonly position: Vec3;
}

function key(position: { x: number; y: number; z: number }): string {
  return `${position.x}:${position.y}:${position.z}`;
}

function createMockBot(blocks: Record<string, MockBlock | null> = {}) {
  const blockMap = new Map(
    Object.entries(blocks).map(([blockKey, block]) => [blockKey, block]),
  );
  return {
    entity: {
      position: {
        x: 0,
        y: 64,
        z: 0,
      },
    },
    inventory: {
      items: vi.fn().mockReturnValue([{ name: 'dirt' }]),
    },
    equip: vi.fn().mockResolvedValue(undefined),
    placeBlock: vi.fn().mockResolvedValue(undefined),
    lookAt: vi.fn().mockResolvedValue(undefined),
    dig: vi.fn().mockResolvedValue(undefined),
    blockAt: vi.fn().mockImplementation((position: { x: number; y: number; z: number }) => (
      blockMap.get(key(position)) ?? null
    )),
    loadPlugin: vi.fn(),
    pathfinder: {
      setGoal: vi.fn(),
      setMovements: vi.fn(),
    },
    version: '1.21.1',
    __setBlock(position: { x: number; y: number; z: number }, block: MockBlock | null) {
      blockMap.set(key(position), block);
    },
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

describe('BuildBehavior', () => {
  let behavior: BuildBehavior;

  beforeEach(() => {
    behavior = new BuildBehavior();
  });

  it('retries a place action when the reference block is missing', async () => {
    const bot = createMockBot();
    const reportEvent = vi.fn();
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: {
        actions: [{ type: 'place', x: 1, y: 64, z: 0, blockName: 'dirt' }],
      },
      reportEvent,
    };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    expect(bot.placeBlock).not.toHaveBeenCalled();
    expect((behavior as any).actionIndex).toBe(0);
    expect(reportEvent).toHaveBeenCalledWith(
      'BUILD_FAILURE',
      expect.stringContaining('reference'),
      expect.objectContaining({
        reason: 'reference-face',
        target: { x: 1, y: 64, z: 0, blockName: 'dirt' },
      }),
    );
  });

  it('uses a side reference block when the target has no support underneath', async () => {
    const sideReference = { name: 'grass_block', position: new Vec3(0, 64, 0) };
    const bot = createMockBot({
      [key({ x: 1, y: 64, z: 0 })]: null,
      [key({ x: 1, y: 63, z: 0 })]: null,
      [key({ x: 0, y: 64, z: 0 })]: sideReference,
    });
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: {
        actions: [{ type: 'place', x: 1, y: 64, z: 0, blockName: 'dirt' }],
      },
    };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    expect(bot.lookAt).toHaveBeenCalledWith(expect.objectContaining({
      x: 1,
      y: 64.5,
      z: 0.5,
    }));
    expect(bot.placeBlock).toHaveBeenCalledWith(sideReference, new Vec3(1, 0, 0));
    expect((behavior as any).actionIndex).toBe(0);
  });

  it('steps out of the target column before trying to place into the hole it is occupying', async () => {
    const bot = createMockBot({
      [key({ x: 0, y: 63, z: 0 })]: { name: 'dirt', position: new Vec3(0, 63, 0) },
    });
    bot.entity.position = { x: 0.2, y: 64, z: 0.1 };
    const reportEvent = vi.fn();
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: {
        actions: [{ type: 'place', x: 0, y: 64, z: 0, blockName: 'dirt' }],
      },
      reportEvent,
    };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    expect(bot.pathfinder.setGoal).toHaveBeenCalledWith(expect.objectContaining({
      x: 2,
      y: 64,
      z: 0,
      range: 1,
    }));
    expect(bot.placeBlock).not.toHaveBeenCalled();
    expect(reportEvent).toHaveBeenCalledWith(
      'BUILD_FAILURE',
      expect.stringContaining('occupied'),
      expect.objectContaining({
        reason: 'occupied-target',
        target: { x: 0, y: 64, z: 0, blockName: 'dirt' },
        standingPosition: { x: 2, y: 64, z: 0 },
      }),
    );
  });

  it('advances the action index only after the target block is really placed', async () => {
    const baseBlock = { name: 'grass_block', position: new Vec3(1, 63, 0) };
    const bot = createMockBot({
      [key({ x: 1, y: 64, z: 0 })]: null,
      [key({ x: 1, y: 63, z: 0 })]: baseBlock,
    });
    bot.placeBlock.mockImplementation(async () => {
      bot.__setBlock(
        { x: 1, y: 64, z: 0 },
        { name: 'dirt', position: new Vec3(1, 64, 0) },
      );
    });
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: {
        actions: [{ type: 'place', x: 1, y: 64, z: 0, blockName: 'dirt' }],
      },
    };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    expect(bot.placeBlock).toHaveBeenCalledWith(baseBlock, new Vec3(0, 1, 0));
    expect((behavior as any).actionIndex).toBe(1);
  });

  it('emits a line-of-sight failure when the place attempt throws a line-of-sight error', async () => {
    const baseBlock = { name: 'grass_block', position: new Vec3(1, 63, 0) };
    const bot = createMockBot({
      [key({ x: 1, y: 64, z: 0 })]: null,
      [key({ x: 1, y: 63, z: 0 })]: baseBlock,
    });
    bot.placeBlock.mockRejectedValue(new Error('No line of sight to block'));
    const reportEvent = vi.fn();
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: {
        actions: [{ type: 'place', x: 1, y: 64, z: 0, blockName: 'dirt' }],
      },
      reportEvent,
    };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    expect((behavior as any).actionIndex).toBe(0);
    expect(reportEvent).toHaveBeenCalledWith(
      'BUILD_FAILURE',
      expect.stringContaining('line of sight'),
      expect.objectContaining({
        reason: 'line-of-sight',
        target: { x: 1, y: 64, z: 0, blockName: 'dirt' },
      }),
    );
  });

  it('uses injected navigator when a place action needs a closer stand position', async () => {
    const bot = createMockBot({
      [key({ x: 4, y: 63, z: 0 })]: { name: 'dirt', position: new Vec3(4, 63, 0) },
    });
    const navigator = {
      moveTo: vi.fn(),
      hasReached: vi.fn().mockReturnValue(false),
      stop: vi.fn(),
    };
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: {
        actions: [{ type: 'place', x: 4, y: 64, z: 0, blockName: 'dirt' }],
      },
      navigator: navigator as any,
    };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    expect(navigator.moveTo).toHaveBeenCalledWith(bot, { x: 4, y: 64, z: 0, radius: 1 });
    expect(bot.pathfinder.setGoal).not.toHaveBeenCalled();
  });

  it('uses injected navigator when it must step out of the occupied target column', async () => {
    const bot = createMockBot({
      [key({ x: 0, y: 63, z: 0 })]: { name: 'dirt', position: new Vec3(0, 63, 0) },
    });
    bot.entity.position = { x: 0.2, y: 64, z: 0.1 };
    const navigator = {
      moveTo: vi.fn(),
      hasReached: vi.fn().mockReturnValue(false),
      stop: vi.fn(),
    };
    const reportEvent = vi.fn();
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: {
        actions: [{ type: 'place', x: 0, y: 64, z: 0, blockName: 'dirt' }],
      },
      navigator: navigator as any,
      reportEvent,
    };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    expect(navigator.moveTo).toHaveBeenCalledWith(bot, { x: 2, y: 64, z: 0, radius: 1 });
    expect(bot.pathfinder.setGoal).not.toHaveBeenCalled();
    expect(reportEvent).toHaveBeenCalledWith(
      'BUILD_FAILURE',
      expect.stringContaining('occupied'),
      expect.objectContaining({
        reason: 'occupied-target',
      }),
    );
  });
});
