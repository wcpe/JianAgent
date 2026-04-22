import type { Behavior, BehaviorContext } from '../behavior.interface.js';

export class ChatBehavior implements Behavior {
  readonly name = 'chat';
  private chatInterval: ReturnType<typeof setInterval> | null = null;

  start(ctx: BehaviorContext): void {
    const messages = (ctx.params['messages'] as string[]) ?? ['Hello!', 'Hi there!', 'Testing...'];
    const intervalMs = (ctx.params['intervalMs'] as number) ?? 10000;

    this.chatInterval = setInterval(() => {
      try {
        const msg = messages[Math.floor(Math.random() * messages.length)];
        ctx.bot.chat(msg);
      } catch {
        // bot may be disconnected
      }
    }, intervalMs);
  }

  tick(): void { /* chat handled by interval */ }

  stop(): void {
    if (this.chatInterval) {
      clearInterval(this.chatInterval);
      this.chatInterval = null;
    }
  }
}
