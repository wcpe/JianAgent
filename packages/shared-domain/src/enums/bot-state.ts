export const BotState = {
  CREATED: 'CREATED',
  CONNECTING: 'CONNECTING',
  SPAWNED: 'SPAWNED',
  READY: 'READY',
  RUNNING_PHASE: 'RUNNING_PHASE',
  DEBUGGING: 'DEBUGGING',
  DEAD: 'DEAD',
  DISCONNECTED: 'DISCONNECTED',
  FAILED: 'FAILED',
  STOPPED: 'STOPPED',
} as const;

export type BotState = (typeof BotState)[keyof typeof BotState];
