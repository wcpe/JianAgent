import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Vec3 } from 'vec3';
import { AttackBehavior } from '../behavior/behaviors/attack.behavior.js';
import type { BehaviorContext } from '../behavior/behavior.interface.js';

function createMockBot(entityOverrides?: Partial<{ username: string; name: string; position: Vec3; height: number }>) {
  const targetEntity = entityOverrides
    ? {
        type: 'mob',
        username: entityOverrides.username,
        name: entityOverrides.name ?? 'zombie',
        position: entityOverrides.position ?? new Vec3(6, 64, 0),
        height: entityOverrides.height ?? 1.8,
      }
    : null;
  return {
    username: 'bot-1',
    entity: {
      position: new Vec3(0, 64, 0),
    },
    inventory: {
      items: vi.fn().mockReturnValue([{ name: 'iron_sword' }]),
    },
    equip: vi.fn().mockResolvedValue(undefined),
    lookAt: vi.fn().mockResolvedValue(undefined),
    attack: vi.fn().mockResolvedValue(undefined),
    nearestEntity: vi.fn().mockReturnValue(targetEntity),
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

describe('AttackBehavior', () => {
  let behavior: AttackBehavior;

  beforeEach(() => {
    behavior = new AttackBehavior();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));
  });

  it('uses injected navigator to chase a distant entity target', async () => {
    const bot = createMockBot({
      username: 'enemy-1',
      position: new Vec3(6, 64, 0),
    });
    const navigator = {
      moveTo: vi.fn(),
      hasReached: vi.fn().mockReturnValue(false),
      stop: vi.fn(),
    };
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: { target: 'enemy-1', attackRange: 3.5, chaseRange: 32 },
      navigator: navigator as any,
    };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    expect(navigator.moveTo).toHaveBeenCalledWith(bot, { x: 6, y: 64, z: 0, radius: 3 });
    expect(bot.pathfinder.setGoal).not.toHaveBeenCalled();
    expect(bot.attack).not.toHaveBeenCalled();
  });

  it('attacks in-range entities without navigating', async () => {
    const bot = createMockBot({
      username: 'enemy-1',
      position: new Vec3(2, 64, 0),
    });
    const navigator = {
      moveTo: vi.fn(),
      hasReached: vi.fn().mockReturnValue(false),
      stop: vi.fn(),
    };
    const ctx: BehaviorContext = {
      bot: bot as any,
      params: { target: 'enemy-1', attackRange: 3.5, chaseRange: 32 },
      navigator: navigator as any,
    };

    await behavior.start(ctx);
    await behavior.tick(ctx);

    expect(navigator.moveTo).not.toHaveBeenCalled();
    expect(bot.attack).toHaveBeenCalled();
  });
});
