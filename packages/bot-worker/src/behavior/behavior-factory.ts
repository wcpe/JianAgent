import type { Behavior } from './behavior.interface.js';
import { IdleBehavior } from './behaviors/idle.behavior.js';
import { MoveRandomBehavior } from './behaviors/move-random.behavior.js';
import { ChatBehavior } from './behaviors/chat.behavior.js';
import { GatherBehavior } from './behaviors/gather.behavior.js';
import { MoveToBehavior } from './behaviors/move-to.behavior.js';
import { LookBehavior } from './behaviors/look.behavior.js';
import { JumpBehavior } from './behaviors/jump.behavior.js';
import { AttackBehavior } from './behaviors/attack.behavior.js';
import { InteractBehavior } from './behaviors/interact.behavior.js';
import { CustomBehavior } from './behaviors/custom.behavior.js';
import { FollowBehavior } from './behaviors/follow.behavior.js';
import { PatrolBehavior } from './behaviors/patrol.behavior.js';
import { BuildBehavior } from './behaviors/build.behavior.js';

const REGISTRY: Record<string, () => Behavior> = {
  idle: () => new IdleBehavior(),
  'move-random': () => new MoveRandomBehavior(),
  'walk_random': () => new MoveRandomBehavior(),
  chat: () => new ChatBehavior(),
  'chat_spam': () => new ChatBehavior(),
  gather: () => new GatherBehavior(),
  'move-to': () => new MoveToBehavior(),
  look: () => new LookBehavior(),
  jump: () => new JumpBehavior(),
  attack: () => new AttackBehavior(),
  'pvp_attack': () => new AttackBehavior(),
  interact: () => new InteractBehavior(),
  custom: () => new CustomBehavior(),
  follow: () => new FollowBehavior(),
  patrol: () => new PatrolBehavior(),
  build: () => new BuildBehavior(),
};

export class BehaviorFactory {
  static create(name: string): Behavior {
    const factory = REGISTRY[name];
    if (!factory) {
      throw new Error(`Unknown behavior: "${name}". Available: ${Object.keys(REGISTRY).join(', ')}`);
    }
    return factory();
  }

  static availableNames(): readonly string[] {
    return Object.keys(REGISTRY);
  }
}
