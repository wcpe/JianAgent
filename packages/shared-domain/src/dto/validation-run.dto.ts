/** Validation run DTO — tracks execution of a validation plan */

export interface ValidationRunDto {
  readonly id: string;
  readonly planId: string;
  readonly sessionId?: string;
  readonly operationJobId?: string;
  readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly metrics: readonly ValidationMetricDto[];
  readonly error?: string;
}

export interface ValidationMetricDto {
  readonly phaseId: string;
  readonly criterionIndex: number;
  readonly metric: string;
  readonly actualValue: number;
  readonly threshold: number;
  readonly passed: boolean;
  readonly timestamp: string;
}