/** Governance action DTO — automated or manual governance response */

export interface GovernanceActionDto {
  readonly id: string;
  readonly type: GovernanceActionType;
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  readonly triggerRunId: string;
  readonly result?: GovernanceActionResult;
  readonly approvedBy?: string;
  readonly executedAt?: string;
  readonly createdAt: string;
}

export type GovernanceActionType =
  | 'rollback'
  | 'scale-down'
  | 'quarantine'
  | 'notify'
  | 'block'
  | 'custom';

export interface GovernanceActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}