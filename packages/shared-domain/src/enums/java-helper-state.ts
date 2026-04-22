export const JavaHelperState = {
  IDLE: 'IDLE',
  RESOLVING: 'RESOLVING',
  ATTACHING: 'ATTACHING',
  ATTACHED: 'ATTACHED',
  SAMPLING: 'SAMPLING',
  DETACHING: 'DETACHING',
  FAILED: 'FAILED',
} as const;

export type JavaHelperState = (typeof JavaHelperState)[keyof typeof JavaHelperState];
