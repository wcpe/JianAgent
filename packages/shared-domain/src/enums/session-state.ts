export const SessionState = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  STARTING: 'starting',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPING: 'stopping',
  FINISHED: 'finished',
  ABORTED: 'aborted',
  FAILED: 'failed',
} as const;

export type SessionState = (typeof SessionState)[keyof typeof SessionState];
