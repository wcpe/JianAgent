import type { Bot } from 'mineflayer';

export interface NavigationTarget {
  readonly x: number;
  readonly y?: number;
  readonly z: number;
  readonly radius?: number;
}

export interface Navigator {
  readonly profile: string;
  prepare(bot: Bot): void;
  moveTo(bot: Bot, target: NavigationTarget): void;
  hasReached(bot: Bot, target: NavigationTarget): boolean;
  stop(bot: Bot): void;
}
