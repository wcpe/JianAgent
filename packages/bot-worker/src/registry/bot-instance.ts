import type { Bot } from 'mineflayer';
import type { BotState } from '@jian-agent/shared-domain';
import type { Behavior } from '../behavior/behavior.interface.js';

export interface BotInstanceInfo {
  readonly name: string;
  state: BotState;
  bot: Bot | null;
  currentBehavior: Behavior | null;
  connectedAt: string | null;
  lastError: string | null;
  lastDisconnectReason: string | null;
  deathCount: number;
}
