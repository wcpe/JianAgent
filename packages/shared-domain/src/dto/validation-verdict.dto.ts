/** Validation verdict DTO — final outcome of a validation run */

export interface ValidationVerdictDto {
  readonly id: string;
  readonly runId: string;
  readonly result: 'passed' | 'failed' | 'manual-review' | 'rollback-suggested';
  readonly summary: string;
  readonly evidence: readonly EvidenceItemDto[];
  readonly decidedAt: string;
  readonly decidedBy?: string; // user id or 'system'
}

export interface EvidenceItemDto {
  readonly type: 'metric' | 'log' | 'screenshot' | 'file' | 'custom';
  readonly description: string;
  readonly value?: string | number | boolean;
  readonly reference?: string; // url, file path, or metric key
}