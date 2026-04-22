export const ResourceKind = {
  SERVER: 'SERVER',
  REMOTE_HOST: 'REMOTE_HOST',
  RUNTIME: 'RUNTIME',
  PROBE: 'PROBE',
  BOT: 'BOT',
  SESSION: 'SESSION',
} as const;

export type ResourceKind = (typeof ResourceKind)[keyof typeof ResourceKind];
