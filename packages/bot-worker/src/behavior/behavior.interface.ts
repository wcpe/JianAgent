import type { Bot } from 'mineflayer';
import type { BotEventType } from '@jian-agent/shared-protocol';
import type { Navigator } from '../navigation/navigator.interface.js';

export interface BehaviorContext {
  readonly bot: Bot;
  readonly params: Readonly<Record<string, unknown>>;
  readonly navigator?: Navigator;
  readonly reportEvent?: (
    event: BotEventType,
    message?: string,
    metadata?: Readonly<Record<string, unknown>>,
  ) => void;
}

export interface Behavior {
  readonly name: string;
  start(ctx: BehaviorContext): void | Promise<void>;
  tick(ctx: BehaviorContext): void | Promise<void>;
  stop(ctx: BehaviorContext): void | Promise<void>;
}
