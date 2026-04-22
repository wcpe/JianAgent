import type { Behavior, BehaviorContext } from '../behavior.interface.js';

export class IdleBehavior implements Behavior {
  readonly name = 'idle';
  start(): void { /* no-op */ }
  tick(): void { /* no-op */ }
  stop(): void { /* no-op */ }
}
