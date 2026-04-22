import type { Behavior, BehaviorContext } from '../behavior.interface.js';
import { ensurePathfinder, goals } from '../pathfinder-loader.js';

/**
 * Follow a specific player or nearest entity.
 * Params:
 *   target?: string   — player username or entity name to follow
 *   distance?: number — how close to get (default 2)
 */
export class FollowBehavior implements Behavior {
  readonly name = 'follow';
  private active = false;
  private lastTargetUpdate = 0;
  private static readonly UPDATE_INTERVAL_MS = 500;

  async start(ctx: BehaviorContext): Promise<void> {
    this.active = true;
    try {
      ensurePathfinder(ctx.bot);
    } catch {
      this.active = false;
    }
  }

  async tick(ctx: BehaviorContext): Promise<void> {
    if (!this.active) return;
    const now = Date.now();
    if (now - this.lastTargetUpdate < FollowBehavior.UPDATE_INTERVAL_MS) return;
    this.lastTargetUpdate = now;

    try {
      const target = ctx.params.target as string | undefined;
      const followDist = (ctx.params.distance as number) ?? 2;

      const entity = target
        ? ctx.bot.nearestEntity((e) => e.username === target || e.name === target)
        : ctx.bot.nearestEntity((e) => e.type === 'player' && e.username !== ctx.bot.username);

      if (!entity) {
        (ctx.bot as any).pathfinder.setGoal(null);
        return;
      }

      const goal = new goals.GoalFollow(entity, followDist);
      (ctx.bot as any).pathfinder.setGoal(goal, true); // dynamic = true
    } catch {
      // entity or pathfinder unavailable
    }
  }

  async stop(ctx: BehaviorContext): Promise<void> {
    this.active = false;
    try {
      if ((ctx.bot as any).pathfinder) {
        (ctx.bot as any).pathfinder.setGoal(null);
      }
    } catch { /* ignore */ }
  }
}
