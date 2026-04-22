import { apiFetch } from './client.js';
import type {
  JvmCapabilityDescriptorDto,
  JvmTargetDto,
  JvmOperationResultDto,
  JvmOperationType,
} from '@jian-agent/shared-domain';

export interface ExecuteJvmOperationRequest {
  readonly operation: JvmOperationType;
  readonly target: JvmTargetDto;
  readonly params?: Record<string, unknown>;
}

export interface DescribeTargetRequest {
  readonly target: JvmTargetDto;
}

export const jvmCapabilityApi = {
  /** List all available JVM capabilities for a given target */
  listCapabilities: (target: JvmTargetDto) =>
    apiFetch<JvmCapabilityDescriptorDto>('/jvm-capability/capabilities', {
      method: 'POST',
      body: JSON.stringify({ target }),
    }),

  /** Execute a JVM diagnostic operation on a target */
  executeOperation: (dto: ExecuteJvmOperationRequest) =>
    apiFetch<JvmOperationResultDto>('/jvm-capability/execute', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  /** Get detailed description of a JVM target */
  describeTarget: (dto: DescribeTargetRequest) =>
    apiFetch<JvmTargetDto & { readonly status?: string; readonly uptime?: number; readonly version?: string }>(
      '/jvm-capability/describe',
      {
        method: 'POST',
        body: JSON.stringify(dto),
      },
    ),
} as const;
