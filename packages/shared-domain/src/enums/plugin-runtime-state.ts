export const PluginRuntimeState = {
  RUNNING: 'RUNNING',
  STOPPED: 'STOPPED',
  LOAD_ERROR: 'LOAD_ERROR',
} as const;

export type PluginRuntimeState = (typeof PluginRuntimeState)[keyof typeof PluginRuntimeState];
