import type { Behavior, BehaviorContext } from '../behavior.interface.js';
import { ensurePathfinder, goals } from '../pathfinder-loader.js';
import { safeExec } from '../../util/safe-exec.js';

interface Waypoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly waitMs?: number; // how long to pause at this point (default 0)
}

/**
 * Patrol through a list of waypoints in a loop.
 * Params:
 *   waypoints: Waypoint[]  — list of {x,y,z,waitMs?} coordinates
 *   loop?: boolean         — repeat when reaching the end (default true)
 */
export class PatrolBehavior implements Behavior {
  readonly name = 'patrol';
  private active = false;
  private waypointIndex = 0;
  private waitingUntil = 0;
  private goalSet = false;

  async start(ctx: BehaviorContext): Promise<void> {
    this.active = true;
    this.waypointIndex = 0;
    this.waitingUntil = 0;
    this.goalSet = false;
    try {
      if (ctx.navigator) {
        ctx.navigator.prepare(ctx.bot);
      } else {
        ensurePathfinder(ctx.bot);
      }
    } catch {
      this.active = false;
    }
  }

  async tick(ctx: BehaviorContext): Promise<void> {
    if (!this.active) return;

    const waypoints = ctx.params.waypoints as Waypoint[] | undefined;
    if (!waypoints || waypoints.length === 0) return;

    const now = Date.now();

    // If waiting at a waypoint, skip until wait is over
    if (this.waitingUntil > 0) {
      if (now < this.waitingUntil) return;
      this.waitingUntil = 0;
      // Move to next waypoint
      this.advanceWaypoint(waypoints, ctx.params.loop as boolean | undefined);
      this.goalSet = false;
      return;
    }

    const wp = waypoints[this.waypointIndex];
    if (!wp) return;

    try {
      // Set goal if not already set
      if (!this.goalSet) {
        if (ctx.navigator) {
          ctx.navigator.moveTo(ctx.bot, wp);
        } else {
          const goal = new goals.GoalNear(wp.x, wp.y, wp.z, 1.5);
          ctx.bot.pathfinder.setGoal(goal);
        }
        this.goalSet = true;
      }

      // Check arrival
      const dist = ctx.navigator
        ? (ctx.navigator.hasReached(ctx.bot, wp) ? 0 : Number.POSITIVE_INFINITY)
        : (() => {
            const pos = ctx.bot.entity.position;
            const dx = wp.x - pos.x;
            const dy = wp.y - pos.y;
            const dz = wp.z - pos.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
          })();

      if (dist < 2) {
        if (ctx.navigator) {
          ctx.navigator.stop(ctx.bot);
        } else {
          ctx.bot.pathfinder.setGoal(null);
        }

        if (wp.waitMs && wp.waitMs > 0) {
          this.waitingUntil = now + wp.waitMs;
        } else {
          this.advanceWaypoint(waypoints, ctx.params.loop as boolean | undefined);
          this.goalSet = false;
        }
      }
    } catch {
      // pathfinder or entity unavailable
    }
  }

  private advanceWaypoint(waypoints: Waypoint[], loop?: boolean): void {
    this.waypointIndex += 1;
    if (this.waypointIndex >= waypoints.length) {
      if (loop !== false) {
        this.waypointIndex = 0; // loop by default
      } else {
        this.active = false; // stop when done
      }
    }
  }

  async stop(ctx: BehaviorContext): Promise<void> {
    this.active = false;
    this.goalSet = false;
    safeExec(() => {
      if (ctx.navigator) {
        ctx.navigator.stop(ctx.bot);
      } else if (ctx.bot.pathfinder) {
        ctx.bot.pathfinder.setGoal(null);
      }
    }, undefined);
  }
}
