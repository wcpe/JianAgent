import type { LocalValidationRunStatus } from './local-validation.dto.js';

export type ResourceValidationVerdict =
  | 'passed'
  | 'failed'
  | 'running'
  | 'cancelled'
  | 'unknown';

export interface ResourceValidationSummaryDto {
  readonly state: LocalValidationRunStatus;
  readonly verdict: ResourceValidationVerdict;
  readonly finishedAt: string | null;
  readonly runId: string;
  readonly failureReason?: string | null;
}
