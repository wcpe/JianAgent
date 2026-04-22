import { apiFetch } from './client.js';
import type { GovernanceActionDto } from '@jian-agent/shared-domain';

export interface GovernanceJobDto {
  readonly id: string;
  readonly type: string;
  readonly status: 'pending' | 'running' | 'completed' | 'failed';
  readonly triggerRunId?: string;
  readonly triggerPlanId?: string;
  readonly targetResourceIds: readonly string[];
  readonly actions: readonly GovernanceActionDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly summary?: string;
}

export const governanceApi = {
  // --- Jobs ---
  listJobs: (params?: { status?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiFetch<{ success: boolean; data: GovernanceJobDto[] }>(`/governance/jobs${qs ? `?${qs}` : ''}`);
  },

  getJob: (jobId: string) =>
    apiFetch<{ success: boolean; data: GovernanceJobDto }>(`/governance/jobs/${encodeURIComponent(jobId)}`),

  // --- Actions ---
  listActions: (params?: { status?: string; riskLevel?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.riskLevel) query.set('riskLevel', params.riskLevel);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiFetch<{ success: boolean; data: GovernanceActionDto[] }>(`/governance/actions${qs ? `?${qs}` : ''}`);
  },

  approveAction: (actionId: string) =>
    apiFetch<{ success: boolean; data: GovernanceActionDto }>(`/governance/actions/${encodeURIComponent(actionId)}/approve`, {
      method: 'POST',
    }),

  rejectAction: (actionId: string) =>
    apiFetch<{ success: boolean; data: GovernanceActionDto }>(`/governance/actions/${encodeURIComponent(actionId)}/reject`, {
      method: 'POST',
    }),

  executeAction: (actionId: string) =>
    apiFetch<{ success: boolean; data: GovernanceActionDto }>(`/governance/actions/${encodeURIComponent(actionId)}/execute`, {
      method: 'POST',
    }),
} as const;
