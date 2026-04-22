export const AlertLevel = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;

export type AlertLevel = (typeof AlertLevel)[keyof typeof AlertLevel];
