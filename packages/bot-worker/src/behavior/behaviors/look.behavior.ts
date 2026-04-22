import type { Behavior, BehaviorContext } from '../behavior.interface.js';

export class LookBehavior implements Behavior {
  readonly name = 'look';

  async start(ctx: BehaviorContext): Promise<void> {
    const { yaw, pitch } = ctx.params as { yaw?: number; pitch?: number };
    await ctx.bot.look(yaw ?? 0, pitch ?? 0);
  }

  async tick(): Promise<void> {}
  async stop(): Promise<void> {}
}
