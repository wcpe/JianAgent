import type { Behavior, BehaviorContext } from '../behavior.interface.js';
import { ensurePathfinder } from '../pathfinder-loader.js';
import {
  createWorldActionPlannerState,
  planBuildTick,
  stopBotMovement,
  type BuildPlannerAction,
  type WorldActionPlannerState,
} from '../../navigation/world-action-planner.js';

/**
 * Place or break blocks at specified coordinates.
 * Params:
 *   actions: BuildAction[]  — sequential list of {type, x, y, z, blockName?}
 *   loop?: boolean          — repeat when done (default false)
 */
export class BuildBehavior implements Behavior {
  readonly name = 'build';
  private active = false;
  private actionIndex = 0;
  private working = false;
  private plannerState: WorldActionPlannerState = createWorldActionPlannerState();

  async start(ctx: BehaviorContext): Promise<void> {
    this.active = true;
    this.actionIndex = 0;
    this.working = false;
    this.plannerState = createWorldActionPlannerState();
    try {
      ensurePathfinder(ctx.bot);
    } catch {
      // pathfinding optional — can still place/break nearby blocks
    }
  }

  async tick(ctx: BehaviorContext): Promise<void> {
    if (!this.active || this.working) return;

    const actions = ctx.params.actions as BuildPlannerAction[] | undefined;
    if (!actions || actions.length === 0) return;

    if (this.actionIndex >= actions.length) {
      if (ctx.params.loop) {
        this.actionIndex = 0;
      } else {
        this.active = false;
        return;
      }
    }

    const action = actions[this.actionIndex];
    if (!action) return;

    this.working = true;
    try {
      const result = await planBuildTick(ctx, this.plannerState, {
        action,
      });
      this.plannerState = result.state;
      if (result.shouldAdvance) {
        this.actionIndex += 1;
      }
    } catch {
      // block may not exist or be reachable — leave action in place for retry
    } finally {
      this.working = false;
    }
  }

  async stop(ctx: BehaviorContext): Promise<void> {
    this.active = false;
    this.working = false;
    this.plannerState = createWorldActionPlannerState();
    try {
      stopBotMovement(ctx);
    } catch { /* ignore */ }
  }
}
