import type { Behavior, BehaviorContext } from '../behavior.interface.js';
import { ensurePathfinder } from '../pathfinder-loader.js';
import {
  createWorldActionPlannerState,
  planGatherTick,
  stopBotMovement,
  type WorldActionPlannerState,
} from '../../navigation/world-action-planner.js';

export class GatherBehavior implements Behavior {
  readonly name = 'gather';
  private active = false;
  private working = false;
  private plannerState: WorldActionPlannerState = createWorldActionPlannerState();

  start(ctx: BehaviorContext): void {
    this.active = true;
    this.working = false;
    this.plannerState = createWorldActionPlannerState();

    try {
      ensurePathfinder(ctx.bot);
    } catch {
      // pathfinding is optional — nearby digging can still work
    }
  }

  async tick(ctx: BehaviorContext): Promise<void> {
    if (!this.active || this.working) {
      return;
    }

    try {
      const blockTypes = this.resolveBlockTypes(ctx);
      const radius = (ctx.params['radius'] as number) ?? 32;
      const result = await planGatherTick(ctx, this.plannerState, {
        blockTypes,
        radius,
      });
      this.plannerState = result.state;
    } catch {
      // bot may be disconnected, pathfinder unavailable, or block unreachable
    } finally {
      this.working = false;
    }
  }

  private resolveBlockTypes(ctx: BehaviorContext): readonly string[] {
    const configured = ctx.params['blockTypes'];
    if (Array.isArray(configured)) {
      const blockTypes = configured.filter((item): item is string => typeof item === 'string' && item.length > 0);
      if (blockTypes.length > 0) {
        return blockTypes;
      }
    }

    const blockType = (ctx.params['blockType'] as string | undefined) ?? 'dirt';
    return [blockType];
  }

  async stop(ctx: BehaviorContext): Promise<void> {
    this.active = false;
    this.working = false;
    this.plannerState = createWorldActionPlannerState();
    try {
      stopBotMovement(ctx);
    } catch {
      // ignore disconnect races during shutdown
    }
  }
}
