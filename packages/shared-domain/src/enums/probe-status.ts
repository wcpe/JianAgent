export const ProbeStatus = {
  UNAVAILABLE: 'UNAVAILABLE',
  CONNECTING: 'CONNECTING',
  HANDSHAKING: 'HANDSHAKING',
  READY: 'READY',
  DISCONNECTED: 'DISCONNECTED',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
} as const;

export type ProbeStatus = (typeof ProbeStatus)[keyof typeof ProbeStatus];
