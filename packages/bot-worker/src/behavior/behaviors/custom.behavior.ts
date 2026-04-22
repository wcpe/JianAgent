import type { Behavior, BehaviorContext } from '../behavior.interface.js';

interface CustomAction {
  readonly type: 'chat' | 'move' | 'look' | 'jump' | 'wait';
  readonly params?: Readonly<Record<string, unknown>>;
}

export class CustomBehavior implements Behavior {
  readonly name = 'custom';
  private actions: readonly CustomAction[] = [];
  private currentIndex = 0;

  async start(ctx: BehaviorContext): Promise<void> {
    this.actions = (ctx.params.actions as CustomAction[]) ?? [];
    this.currentIndex = 0;
  }

  async tick(ctx: BehaviorContext): Promise<void> {
    if (this.currentIndex >= this.actions.length) return;
    const action = this.actions[this.currentIndex];
    switch (action.type) {
      case 'chat':
        ctx.bot.chat(String(action.params?.message ?? ''));
        break;
      case 'jump':
        ctx.bot.setControlState('jump', true);
        setTimeout(() => {
          try { ctx.bot.setControlState('jump', false); } catch { /* bot may be gone */ }
        }, 500);
        break;
      case 'look':
        try {
          await ctx.bot.look(
            Number(action.params?.yaw ?? 0),
            Number(action.params?.pitch ?? 0),
          );
        } catch { /* bot may be disconnected */ }
        break;
    }
    this.currentIndex++;
  }

  async stop(): Promise<void> {
    this.currentIndex = 0;
    this.actions = [];
  }
}
