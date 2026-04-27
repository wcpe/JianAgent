export interface ResourceWorkspaceConfig {
  readonly id: string;
  readonly name: string;
  readonly basePath: string;
  readonly description?: string;
  readonly isDefault?: boolean;
  readonly createdAt: string;
}

export interface CreateResourceWorkspaceRequest {
  readonly name: string;
  readonly basePath: string;
  readonly description?: string;
  readonly isDefault?: boolean;
}

export interface UpdateResourceWorkspaceRequest {
  readonly name?: string;
  readonly basePath?: string;
  readonly description?: string;
  readonly isDefault?: boolean;
}

export interface QuickProvisionRequest {
  readonly workspaceId: string;
  readonly serverName: string;
  readonly minecraftVersion: string;
  readonly port?: number;
  readonly maxMemory?: string;
  readonly minMemory?: string;
  readonly runtimeId?: string;
  readonly serverGroup?: string;
  readonly tags?: readonly string[];
}
