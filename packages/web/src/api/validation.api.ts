import { apiFetch } from './client.js';
import type {
  ValidationPlanDto,
  ValidationRunDto,
  ValidationVerdictDto,
  SessionReportDto,
} from '@jian-agent/shared-domain';

export interface ObservabilitySummaryDto {
  readonly validationRunId: string;
  readonly sessionId?: string;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly alerts: readonly {
    readonly id: string;
    readonly timestamp: string;
    readonly level: string;
    readonly ruleName: string;
    readonly message: string;
    readonly value?: number;
    readonly threshold?: number;
  }[];
  readonly exceptions: readonly {
    readonly timestamp: string;
    readonly level: string;
    readonly message: string;
    readonly source: string;
  }[];
  readonly alertCounts: {
    readonly critical: number;
    readonly warning: number;
    readonly info: number;
    readonly total: number;
  };
  readonly exceptionCount: number;
}

export interface VerdictGenerationResultDto {
  readonly verdict: ValidationVerdictDto;
  readonly report: SessionReportDto;
  readonly observability: ObservabilitySummaryDto;
}

export const validationApi = {
  // --- Validation Plans ---
  listPlans: () =>
    apiFetch<{ success: boolean; data: ValidationPlanDto[] }>('/validation/plans'),

  getPlan: (planId: string) =>
    apiFetch<{ success: boolean; data: ValidationPlanDto }>(`/validation/plans/${encodeURIComponent(planId)}`),

  createPlan: (dto: {
    name: string;
    targetType: 'server' | 'bot-group' | 'session' | 'plugin';
    targetId: string;
    phases: readonly {
      name: string;
      order: number;
      durationMs: number;
      criteria: readonly {
        metric: string;
        operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
        threshold: number;
        weight: number;
      }[];
    }[];
    successThreshold?: number;
    triggerType?: 'manual' | 'scheduled' | 'event-based';
  }) =>
    apiFetch<{ success: boolean; data: ValidationPlanDto }>('/validation/plans', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  updatePlan: (planId: string, dto: Partial<ValidationPlanDto>) =>
    apiFetch<{ success: boolean; data: ValidationPlanDto }>(`/validation/plans/${encodeURIComponent(planId)}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  deletePlan: (planId: string) =>
    apiFetch<{ success: boolean }>(`/validation/plans/${encodeURIComponent(planId)}`, {
      method: 'DELETE',
    }),

  // --- Validation Runs ---
  listRuns: (planId?: string) => {
    const query = planId ? `?planId=${encodeURIComponent(planId)}` : '';
    return apiFetch<{ success: boolean; data: ValidationRunDto[] }>(`/validation/runs${query}`);
  },

  getRun: (runId: string) =>
    apiFetch<{ success: boolean; data: ValidationRunDto }>(`/validation/runs/${encodeURIComponent(runId)}`),

  startRun: (planId: string) =>
    apiFetch<{ success: boolean; data: ValidationRunDto }>(`/validation/plans/${encodeURIComponent(planId)}/run`, {
      method: 'POST',
    }),

  cancelRun: (runId: string) =>
    apiFetch<{ success: boolean }>(`/validation/runs/${encodeURIComponent(runId)}/cancel`, {
      method: 'POST',
    }),

  // --- Quick Validation ---
  quickValidate: (dto: {
    serverId: string;
    name?: string;
    botCount?: number;
    durationSec?: number;
  }) =>
    apiFetch<{ success: boolean; data: ValidationRunDto }>('/validation/quick', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  // --- Validation Verdicts ---
  getVerdictByRunId: (runId: string) =>
    apiFetch<{ success: boolean; data: ValidationVerdictDto | null }>(`/validation/runs/${encodeURIComponent(runId)}/verdict`),

  getVerdictsByPlanId: (planId: string) =>
    apiFetch<{ success: boolean; data: ValidationVerdictDto[] }>(`/validation/plans/${encodeURIComponent(planId)}/verdicts`),

  generateVerdict: (runId: string, thresholds?: {
    tpsMinThreshold?: number;
    msptMaxThreshold?: number;
    joinFailureRateMax?: number;
    maxCriticalAlerts?: number;
    maxExceptions?: number;
  }) =>
    apiFetch<{ success: boolean; data: VerdictGenerationResultDto }>(`/validation/runs/${encodeURIComponent(runId)}/verdict/generate`, {
      method: 'POST',
      body: thresholds ? JSON.stringify({ thresholds }) : undefined,
    }),

  // --- Observability Summary ---
  getObservabilitySummary: (runId: string) =>
    apiFetch<{ success: boolean; data: ObservabilitySummaryDto }>(`/validation/runs/${encodeURIComponent(runId)}/observability`),

  // --- Session Report for Validation ---
  getValidationReport: (runId: string) =>
    apiFetch<{ success: boolean; data: SessionReportDto }>(`/validation/runs/${encodeURIComponent(runId)}/report`),
} as const;
