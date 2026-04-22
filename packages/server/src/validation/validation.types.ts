export interface ValidationPlanDto {
  id: string;
  name: string;
  description: string;
  serverId: string;
  type: 'full' | 'quick' | 'custom';
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationRunDto {
  id: string;
  planId: string;
  serverId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  resultSummary: string | null;
  errorDetail: string | null;
  metrics?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateValidationPlanInput {
  name: string;
  description?: string;
  serverId: string;
  type?: 'full' | 'quick' | 'custom';
  config?: Record<string, unknown>;
}

export interface UpdateValidationPlanInput {
  name?: string;
  description?: string;
  type?: 'full' | 'quick' | 'custom';
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export interface CreateQuickValidationInput {
  serverId: string;
  name?: string;
  botCount?: number;
  durationSec?: number;
}