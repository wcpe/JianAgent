import type { Behavior, BehaviorContext } from '../behavior.interface.js';
import { ensurePathfinder } from '../pathfinder-loader.js';
import { safeExec, safeExecAsync } from '../../util/safe-exec.js';
import {
  createWorldActionPlannerState,
  planAttackTick,
  stopBotMovement,
  type WorldActionPlannerState,
} from '../../navigation/world-action-planner.js';

/**
 * Enhanced combat behavior with pathfinding chase + auto-equip sword.
 * Params:
 *   target?: string        — username or entity name to attack
 *   chaseRange?: number    — max distance to chase (default 32)
 *   attackRange?: number   — range to start attacking (default 3.5)
 *   equipSword?: boolean   — auto-equip best sword (default true)
 */
export class AttackBehavior implements Behavior {
  readonly name = 'attack';
  private active = false;
  private equipped = false;
  private static readonly CHASE_UPDATE_MS = 400;
  private static readonly ATTACK_COOLDOWN_MS = 500;
  private plannerState: WorldActionPlannerState = createWorldActionPlannerState();

  async start(ctx: BehaviorContext): Promise<void> {
    this.active = true;
    this.equipped = false;
    this.plannerState = createWorldActionPlannerState();
    try {
      ensurePathfinder(ctx.bot);
    } catch {
      // fall back to direct attack without pathfinding
    }
  }

  async tick(ctx: BehaviorContext): Promise<void> {
    if (!this.active) return;
    try {
      const target = ctx.params.target as string | undefined;
      const chaseRange = (ctx.params.chaseRange as number) ?? 32;
      const attackRange = (ctx.params.attackRange as number) ?? 3.5;
      const equipSword = (ctx.params.equipSword as boolean) ?? true;

      // Find target entity
      const entity = target
        ? ctx.bot.nearestEntity((e) => e.username === target || e.name === target)
        : ctx.bot.nearestEntity((e) => (e.type === 'mob' || e.type === 'player') && e.username !== ctx.bot.username);

      if (!entity) {
        stopBotMovement(ctx);
        this.plannerState = createWorldActionPlannerState();
        return;
      }

      // Auto-equip best sword once
      if (equipSword && !this.equipped) {
        await this.equipBestSword(ctx);
        this.equipped = true;
      }

      const result = await planAttackTick(ctx, this.plannerState, {
        target,
        chaseRange,
        attackRange,
        cooldownMs: AttackBehavior.ATTACK_COOLDOWN_MS,
        chaseUpdateMs: AttackBehavior.CHASE_UPDATE_MS,
      });
      this.plannerState = result.state;
    } catch {
      // entity may have become invalid
    }
  }

  private async equipBestSword(ctx: BehaviorContext): Promise<void> {
    try {
      const swordNames = ['netherite_sword', 'diamond_sword', 'iron_sword', 'stone_sword', 'golden_sword', 'wooden_sword'];
      for (const swordName of swordNames) {
        const sword = ctx.bot.inventory.items().find((item) => item.name === swordName);
        if (sword) {
          await ctx.bot.equip(sword, 'hand');
          return;
        }
      }
    } catch {
      // inventory may be unavailable
    }
  }

  async stop(ctx: BehaviorContext): Promise<void> {
    this.active = false;
    this.plannerState = createWorldActionPlannerState();
    safeExec(() => stopBotMovement(ctx), undefined);
  }
}
