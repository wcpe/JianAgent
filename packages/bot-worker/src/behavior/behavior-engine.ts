import type { Behavior, BehaviorContext } from './behavior.interface.js';

export class BehaviorEngine {
  private _current: Behavior | null = null;

  get current(): Behavior | null {
    return this._current;
  }

  async switchBehavior(next: Behavior, ctx: BehaviorContext): Promise<void> {
    if (this._current) {
      await this._current.stop(ctx);
    }
    this._current = next;
    await next.start(ctx);
  }

  async tick(ctx: BehaviorContext): Promise<void> {
    if (!this._current) return;
    await this._current.tick(ctx);
  }

  async stopCurrent(ctx: BehaviorContext): Promise<void> {
    if (!this._current) return;
    await this._current.stop(ctx);
    this._current = null;
  }
}
