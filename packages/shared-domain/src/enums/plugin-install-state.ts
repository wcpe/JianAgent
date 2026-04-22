export const PluginInstallState = {
  INSTALLED: 'INSTALLED',
  DISABLED: 'DISABLED',
  CORRUPTED: 'CORRUPTED',
} as const;

export type PluginInstallState = (typeof PluginInstallState)[keyof typeof PluginInstallState];
