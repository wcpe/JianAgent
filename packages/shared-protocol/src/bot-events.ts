import type { BotSummary, BotDetail } from '@jian-agent/shared-domain';

export interface BotStatePush {
  readonly groupId: string;
  readonly bots: readonly BotSummary[];
}

export interface BotEventPush {
  readonly botName: string;
  readonly groupId: string;
  readonly event: BotEventType;
  readonly message: string;
  readonly timestamp: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export const BotEventType = {
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR',
  PHASE_CHANGED: 'PHASE_CHANGED',
  BEHAVIOR_CHANGED: 'BEHAVIOR_CHANGED',
  KICKED: 'KICKED',
  DIED: 'DIED',
  SPAWNED: 'SPAWNED',
  RESPAWNED: 'RESPAWNED',
  BUILD_ATTEMPT: 'BUILD_ATTEMPT',
  BUILD_SUCCESS: 'BUILD_SUCCESS',
  BUILD_FAILURE: 'BUILD_FAILURE',
} as const;
export type BotEventType = (typeof BotEventType)[keyof typeof BotEventType];

export interface BotDebugOutput {
  readonly botName: string;
  readonly data: string;
  readonly timestamp: number;
}

export interface BotDebugInput {
  readonly botName: string;
  readonly command: string;
}
