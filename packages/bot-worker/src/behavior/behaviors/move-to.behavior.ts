import type { Behavior, BehaviorContext } from '../behavior.interface.js';
import { ensurePathfinder, goals } from '../pathfinder-loader.js';

export class MoveToBehavior implements Behavior {
  readonly name = 'move-to';
  private active = false;

  async start(ctx: BehaviorContext): Promise<void> {
    this.active = true;
    try {
      const { x, y, z } = ctx.params as { x: number; y: number; z: number };
      if (x === undefined || z === undefined) return;
      if (ctx.navigator) {
        ctx.navigator.moveTo(ctx.bot, { x, y, z });
      } else {
        ensurePathfinder(ctx.bot);
        const goal = new goals.GoalNear(x, y ?? ctx.bot.entity.position.y, z, 1);
        (ctx.bot as any).pathfinder.setGoal(goal);
      }
    } catch {
      // pathfinder may fail to initialize on some server versions
      this.active = false;
    }
  }

  async tick(ctx: BehaviorContext): Promise<void> {
    if (!this.active) return;
    try {
      // Check if we've arrived
      const { x, y, z } = ctx.params as { x: number; y?: number; z: number };
      const arrived = ctx.navigator
        ? ctx.navigator.hasReached(ctx.bot, { x, y, z })
        : (() => {
            const pos = ctx.bot.entity.position;
            const dx = x - pos.x;
            const dz = z - pos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            return dist < 1.5;
          })();
      if (arrived) {
        this.active = false;
        if (ctx.navigator) {
          ctx.navigator.stop(ctx.bot);
        } else {
          (ctx.bot as any).pathfinder.setGoal(null);
        }
      }
    } catch {
      // bot entity may be unavailable
    }
  }

  async stop(ctx: BehaviorContext): Promise<void> {
    this.active = false;
    try {
      if (ctx.navigator) {
        ctx.navigator.stop(ctx.bot);
      } else if ((ctx.bot as any).pathfinder) {
        (ctx.bot as any).pathfinder.setGoal(null);
      }
      ctx.bot.setControlState('forward', false);
    } catch { /* bot may already be disconnected */ }
  }
}
