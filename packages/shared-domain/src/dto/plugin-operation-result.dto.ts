export type PluginOperationType =
  | 'enable'
  | 'disable'
  | 'hot-load'
  | 'hot-unload'
  | 'hot-reload'
  | 'replace-version';

export interface PluginOperationResultDto {
  readonly success: boolean;
  readonly operation: PluginOperationType;
  readonly pluginName: string;
  readonly serverId: string;
  readonly hasConnection: boolean;
  readonly message?: string;
  readonly requestId: string;
}
