import type { Behavior, BehaviorContext } from '../behavior.interface.js';
import { safeExec } from '../../util/safe-exec.js';

export class JumpBehavior implements Behavior {
  readonly name = 'jump';
  private active = false;
  private jumpTimeout: ReturnType<typeof setTimeout> | null = null;

  async start(ctx: BehaviorContext): Promise<void> {
    this.active = true;
    this.scheduleJump(ctx);
  }

  private scheduleJump(ctx: BehaviorContext): void {
    if (!this.active) return;
    // Jump when on ground, then wait 600-1200ms before next jump
    if (ctx.bot.entity.onGround) {
      ctx.bot.setControlState('jump', true);
      setTimeout(() => {
        safeExec(() => ctx.bot.setControlState('jump', false), undefined);
      }, 150);
    }
    const delay = 600 + Math.random() * 600;
    this.jumpTimeout = setTimeout(() => this.scheduleJump(ctx), delay);
  }

  async tick(): Promise<void> { /* handled by scheduled callbacks */ }

  async stop(ctx: BehaviorContext): Promise<void> {
    this.active = false;
    if (this.jumpTimeout) {
      clearTimeout(this.jumpTimeout);
      this.jumpTimeout = null;
    }
    safeExec(() => ctx.bot.setControlState('jump', false), undefined);
  }
}
