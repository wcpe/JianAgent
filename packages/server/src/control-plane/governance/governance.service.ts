import { Injectable } from '@nestjs/common';
import { OperationJobService } from '../orchestrator/operation-job.service.js';
import { PolicyEngineService } from '../policy/policy-engine.service.js';

export type GovernanceAction =
  | 'approve'
  | 'reject'
  | 'rollback'
  | 'escalate'
  | 'retry';

export interface ValidationVerdict {
  jobId: string;
  tenantId: string;
  passed: boolean;
  score: number;
  anomalies: string[];
  recommendations: string[];
}

export interface GovernanceDecision {
  jobId: string;
  action: GovernanceAction;
  reason: string;
  timestamp: Date;
}

@Injectable()
export class GovernanceService {
  private readonly decisions: GovernanceDecision[] = [];

  constructor(
    private readonly operationJobService: OperationJobService,
    private readonly policyEngineService: PolicyEngineService,
  ) {}

  /**
   * Evaluate a validation verdict and determine the governance action.
   */
  evaluateVerdict(verdict: ValidationVerdict): GovernanceDecision {
    const action = this.resolveAction(verdict);
    const reason = this.buildReason(verdict, action);

    const decision: GovernanceDecision = {
      jobId: verdict.jobId,
      action,
      reason,
      timestamp: new Date(),
    };

    this.decisions.push(decision);
    this.executeDecision(verdict, decision);

    return decision;
  }

  /**
   * Resolve governance action based on validation verdict.
   */
  private resolveAction(verdict: ValidationVerdict): GovernanceAction {
    if (verdict.passed && verdict.score >= 0.9) {
      return 'approve';
    }

    if (verdict.passed && verdict.score >= 0.7) {
      return verdict.anomalies.length > 0 ? 'escalate' : 'approve';
    }

    if (!verdict.passed && verdict.score < 0.3) {
      return 'rollback';
    }

    if (!verdict.passed && verdict.anomalies.length > 2) {
      return 'reject';
    }

    return 'retry';
  }

  /**
   * Build human-readable reason for the governance decision.
   */
  private buildReason(
    verdict: ValidationVerdict,
    action: GovernanceAction,
  ): string {
    const parts: string[] = [];

    parts.push(
      `Validation score: ${(verdict.score * 100).toFixed(1)}% (passed: ${verdict.passed})`,
    );

    if (verdict.anomalies.length > 0) {
      parts.push(`Anomalies detected: ${verdict.anomalies.join(', ')}`);
    }

    if (verdict.recommendations.length > 0) {
      parts.push(`Recommendations: ${verdict.recommendations.join(', ')}`);
    }

    parts.push(`Governance action: ${action}`);

    return parts.join(' | ');
  }

  /**
   * Execute the governance decision by updating job status.
   */
  private executeDecision(
    verdict: ValidationVerdict,
    decision: GovernanceDecision,
  ): void {
    switch (decision.action) {
      case 'approve':
        this.operationJobService.setStatus(verdict.jobId, 'SUCCEEDED');
        break;
      case 'reject':
        this.operationJobService.setStatus(verdict.jobId, 'FAILED');
        break;
      case 'rollback':
        this.operationJobService.setStatus(verdict.jobId, 'ROLLING_BACK');
        break;
      case 'escalate':
        this.operationJobService.setStatus(verdict.jobId, 'PENDING_VERDICT');
        break;
      case 'retry':
        this.operationJobService.setStatus(verdict.jobId, 'PENDING');
        break;
    }
  }

  /**
   * Get all governance decisions for a job.
   */
  getDecisionsForJob(jobId: string): GovernanceDecision[] {
    return this.decisions.filter((d) => d.jobId === jobId);
  }

  /**
   * Get all governance decisions for a tenant.
   */
  getDecisionsForTenant(tenantId: string, jobIdPrefix?: string): GovernanceDecision[] {
    return this.decisions.filter((d) =>
      jobIdPrefix ? d.jobId.startsWith(jobIdPrefix) : true,
    );
  }
}
