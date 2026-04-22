export const ServerState = {
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  RUNNING: 'RUNNING',
  STOPPING: 'STOPPING',
  CRASHED: 'CRASHED',
  ATTACHED_EXTERNAL: 'ATTACHED_EXTERNAL',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ServerState = (typeof ServerState)[keyof typeof ServerState];
