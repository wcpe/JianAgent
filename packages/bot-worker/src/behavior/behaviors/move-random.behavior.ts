import type { Behavior, BehaviorContext } from '../behavior.interface.js';
import {
  buildDeterministicOffset,
  resolveExecutionProfile,
} from '../../navigation/navigation-profile.js';
import { safeExec } from '../../util/safe-exec.js';

export class MoveRandomBehavior implements Behavior {
  readonly name = 'move-random';
  private active = false;
  private nextMoveAt = 0;
  private step = 0;
  private currentTarget: { x: number; y: number; z: number } | null = null;

  start(ctx: BehaviorContext): void {
    this.active = true;
    this.nextMoveAt = Date.now();
    this.step = 0;
    this.currentTarget = null;
  }

  tick(ctx: BehaviorContext): void {
    if (!this.active) {
      return;
    }

    const now = Date.now();
    if (this.currentTarget) {
      try {
        const arrived = ctx.navigator
          ? ctx.navigator.hasReached(ctx.bot, this.currentTarget)
          : false;
        if (arrived) {
          ctx.navigator?.stop(ctx.bot);
          this.currentTarget = null;
          this.nextMoveAt = now + this.resolvePauseMs(ctx);
        }
      } catch {
        this.currentTarget = null;
      }
      return;
    }

    if (now < this.nextMoveAt) {
      return;
    }

    try {
      const position = ctx.bot.entity.position;
      const profile = resolveExecutionProfile(ctx.params);
      const wanderRadius = profile.scenarioProfile === 'smoke' ? 4 : 7;
      const offset = buildDeterministicOffset(
        `${ctx.bot.username ?? 'bot'}:${profile.scenarioProfile}`,
        this.step,
        wanderRadius,
        profile.determinismLevel,
      );
      this.step += 1;
      this.currentTarget = {
        x: position.x + offset.x,
        y: position.y,
        z: position.z + offset.z,
      };

      if (ctx.navigator) {
        ctx.navigator.moveTo(ctx.bot, this.currentTarget);
      } else {
        const yaw = Math.atan2(-offset.x, offset.z);
        ctx.bot.look(yaw, 0, false);
        ctx.bot.setControlState('forward', true);
      }
    } catch {
      this.currentTarget = null;
      this.nextMoveAt = now + this.resolvePauseMs(ctx);
    }
  }

  stop(ctx: BehaviorContext): void {
    this.active = false;
    this.currentTarget = null;
    safeExec(() => {
      ctx.navigator?.stop(ctx.bot);
      ctx.bot.setControlState('forward', false);
      ctx.bot.setControlState('sprint', false);
      ctx.bot.setControlState('jump', false);
    }, undefined);
  }

  private resolvePauseMs(ctx: BehaviorContext): number {
    const profile = resolveExecutionProfile(ctx.params);
    if (profile.determinismLevel === 'strict') {
      return 1_200;
    }
    if (profile.determinismLevel === 'organic') {
      return 2_400;
    }
    return 1_800;
  }
}
