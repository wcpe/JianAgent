export const ServerLifecyclePhase = {
  IDLE: 'IDLE',
  VALIDATING: 'VALIDATING',
  PRE_START: 'PRE_START',
  STARTING: 'STARTING',
  POST_START: 'POST_START',
  RUNNING: 'RUNNING',
  PRE_STOPPING: 'PRE_STOPPING',
  STOPPING: 'STOPPING',
  POST_STOPPING: 'POST_STOPPING',
  STOPPED: 'STOPPED',
  FAILED: 'FAILED',
} as const;

export type ServerLifecyclePhase = (typeof ServerLifecyclePhase)[keyof typeof ServerLifecyclePhase];
