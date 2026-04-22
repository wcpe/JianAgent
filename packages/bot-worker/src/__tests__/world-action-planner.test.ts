import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Vec3 } from 'vec3';
import type { BehaviorContext } from '../behavior/behavior.interface.js';
import {
  createWorldActionPlannerState,
  planAttackTick,
  planBuildTick,
  planGatherTick,
} from '../navigation/world-action-planner.js';

interface MockBlock {
  readonly name: string;
  readonly position: Vec3;
}

function key(position: { x: number; y: number; z: number }): string {
  return `${position.x}:${position.y}:${position.z}`;
}

function createBotWithBlocks(blocks: Record<string, MockBlock | null> = {}) {
  const blockMap = new Map(
    Object.entries(blocks).map(([blockKey, block]) => [blockKey, block]),
  );
  return {
    username: 'bot-1',
    entity: {
      position: new Vec3(0, 64, 0),
    },
    inventory: {
      items: vi.fn().mockReturnValue([{ name: 'dirt' }, { name: 'iron_sword' }]),
    },
    findBlock: vi.fn(),
    dig: vi.fn().mockResolvedValue(undefined),
    equip: vi.fn().mockResolvedValue(undefined),
    placeBlock: vi.fn().mockResolvedValue(undefined),
    lookAt: vi.fn().mockResolvedValue(undefined),
    attack: vi.fn().mockResolvedValue(undefined),
    nearestEntity: vi.fn().mockReturnValue(null),
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

describe('WorldActionPlanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'));
  });

  it('planGatherTick returns approaching state for a distant target and avoids duplicate moves', async () => {
    const block = { name: 'dirt', position: new Vec3(10, 64, 10) };
    const bot = createBotWithBlocks();
    bot.findBlock.mockReturnValue(block);
    const navigator = {
      moveTo: vi.fn(),
      hasReached: vi.fn().mockReturnValue(false),
      stop: vi.fn(),
    };
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: {},
      navigator: navigator as any,
    };

    let state = createWorldActionPlannerState();
    const first = await planGatherTick(ctx, state, {
      blockTypes: ['dirt'],
      radius: 16,
    });
    state = first.state;
    const second = await planGatherTick(ctx, state, {
      blockTypes: ['dirt'],
      radius: 16,
    });

    expect(first.status).toBe('approaching');
    expect(first.state.phase).toBe('approaching');
    expect(first.state.currentTargetKey).toBe('10:64:10');
    expect(navigator.moveTo).toHaveBeenCalledTimes(1);
    expect(second.status).toBe('approaching');
    expect(navigator.moveTo).toHaveBeenCalledTimes(1);
  });

  it('planBuildTick returns shouldAdvance only after place confirmation', async () => {
    const baseBlock = { name: 'grass_block', position: new Vec3(1, 63, 0) };
    const bot = createBotWithBlocks({
      [key({ x: 1, y: 64, z: 0 })]: null,
      [key({ x: 1, y: 63, z: 0 })]: baseBlock,
    });
    bot.placeBlock.mockImplementation(async () => {
      bot.__setBlock(
        { x: 1, y: 64, z: 0 },
        { name: 'dirt', position: new Vec3(1, 64, 0) },
      );
    });
    const reportEvent = vi.fn();
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: {},
      reportEvent,
    };

    const result = await planBuildTick(ctx, createWorldActionPlannerState(), {
      action: { type: 'place', x: 1, y: 64, z: 0, blockName: 'dirt' },
    });

    expect(result.status).toBe('completed');
    expect(result.shouldAdvance).toBe(true);
    expect(result.state.phase).toBe('idle');
    expect(bot.placeBlock).toHaveBeenCalledWith(baseBlock, new Vec3(0, 1, 0));
    expect(reportEvent).toHaveBeenCalledWith(
      'BUILD_SUCCESS',
      expect.stringContaining('confirmed'),
      expect.objectContaining({
        target: { x: 1, y: 64, z: 0, blockName: 'dirt' },
      }),
    );
  });

  it('planAttackTick enforces cooldown after an in-range attack', async () => {
    const targetEntity = {
      type: 'mob',
      username: 'enemy-1',
      name: 'zombie',
      position: new Vec3(2, 64, 0),
      height: 1.8,
    };
    const bot = createBotWithBlocks();
    bot.nearestEntity.mockReturnValue(targetEntity);
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: {},
    };

    let state = createWorldActionPlannerState();
    const first = await planAttackTick(ctx, state, {
      target: 'enemy-1',
      attackRange: 3.5,
      chaseRange: 32,
      cooldownMs: 500,
    });
    state = first.state;
    const second = await planAttackTick(ctx, state, {
      target: 'enemy-1',
      attackRange: 3.5,
      chaseRange: 32,
      cooldownMs: 500,
    });

    expect(first.status).toBe('completed');
    expect(first.state.phase).toBe('cooldown');
    expect(bot.attack).toHaveBeenCalledTimes(1);
    expect(second.status).toBe('cooldown');
    expect(bot.attack).toHaveBeenCalledTimes(1);
  });
});
