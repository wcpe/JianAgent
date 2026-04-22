export type RuntimeType = 'jar' | 'container';

export interface ApplicationSummaryDto {
  id: string;
  tenantId: string;
  environmentId: string;
  name: string;
  runtimeType: RuntimeType;
}

export interface AgentStateDto {
  id: string;
  hostId: string;
  status: 'online' | 'offline';
  capabilities: string[];
  lastHeartbeatAt: number;
}
