import type { Behavior, BehaviorContext } from '../behavior.interface.js';

export class InteractBehavior implements Behavior {
  readonly name = 'interact';

  async start(ctx: BehaviorContext): Promise<void> {
    try {
      const { entityName } = ctx.params as { blockPos?: [number, number, number]; entityName?: string };
      if (entityName) {
        const entity = ctx.bot.nearestEntity((e) => e.username === entityName || e.name === entityName);
        if (entity) await ctx.bot.useOn(entity);
      }
    } catch {
      // entity may have become invalid
    }
  }

  async tick(): Promise<void> {}
  async stop(): Promise<void> {}
}
