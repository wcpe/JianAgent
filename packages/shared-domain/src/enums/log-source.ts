export const LogSource = {
  SERVER_PROCESS: 'SERVER_PROCESS',
  BOT_WORKER: 'BOT_WORKER',
  PLUGIN_PROBE: 'PLUGIN_PROBE',
  SYSTEM: 'SYSTEM',
  NODE_LOG: 'NODE_LOG',
} as const;

export type LogSource = (typeof LogSource)[keyof typeof LogSource];
