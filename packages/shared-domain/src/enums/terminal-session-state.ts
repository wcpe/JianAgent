export const TerminalSessionState = {
  CONNECTING: 'CONNECTING',
  ACTIVE: 'ACTIVE',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR',
} as const;

export type TerminalSessionState = (typeof TerminalSessionState)[keyof typeof TerminalSessionState];
