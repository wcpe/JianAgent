import { Injectable } from '@nestjs/common';
import { OperationJobService } from '../orchestrator/operation-job.service.js';

export interface ValidationConclusion {
  jobId: string;
  tenantId: string;
  passed: boolean;
  score: number;
  anomalies: string[];
  timestamp: Date;
}

export interface ObservationAnomaly {
  tenantId: string;
  target: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'error' | 'critical';
  timestamp: Date;
}

export interface PolicyRule {
  cpuThreshold: number;
  fullGcThreshold: number;
  action: 'restart' | 'scale';
  validationScoreThreshold: number;
  anomalySeverityThreshold: 'warning' | 'error' | 'critical';
}

@Injectable()
export class PolicyEngineService {
  private cpuThreshold = 90;
  private fullGcThreshold = 3;
  private action: 'restart' | 'scale' = 'restart';
  private validationScoreThreshold = 0.7;
  private anomalySeverityThreshold: 'warning' | 'error' | 'critical' = 'error';

  private validationConclusions: ValidationConclusion[] = [];
  private observationAnomalies: ObservationAnomaly[] = [];

  constructor(private readonly operationJobService: OperationJobService) {}

  updateRule(input: {
    cpuThreshold?: number;
    fullGcThreshold?: number;
    action?: 'restart' | 'scale';
    validationScoreThreshold?: number;
    anomalySeverityThreshold?: 'warning' | 'error' | 'critical';
  }) {
    if (input.cpuThreshold !== undefined) this.cpuThreshold = input.cpuThreshold;
    if (input.fullGcThreshold !== undefined) this.fullGcThreshold = input.fullGcThreshold;
    if (input.action !== undefined) this.action = input.action;
    if (input.validationScoreThreshold !== undefined)
      this.validationScoreThreshold = input.validationScoreThreshold;
    if (input.anomalySeverityThreshold !== undefined)
      this.anomalySeverityThreshold = input.anomalySeverityThreshold;

    return this.getRule();
  }

  getRule(): PolicyRule {
    return {
      cpuThreshold: this.cpuThreshold,
      fullGcThreshold: this.fullGcThreshold,
      action: this.action,
      validationScoreThreshold: this.validationScoreThreshold,
      anomalySeverityThreshold: this.anomalySeverityThreshold,
    };
  }

  evaluateAndTrigger(input: {
    tenantId: string;
    target: string;
    cpu: number;
    fullGcCount: number;
  }) {
    const matched =
      input.cpu > this.cpuThreshold && input.fullGcCount >= this.fullGcThreshold;
    if (!matched) {
      return { triggered: false as const, rule: this.getRule() };
    }

    const job = this.operationJobService.create({
      tenantId: input.tenantId,
      operation: this.action,
      target: input.target,
      version: 'v1',
      batch: 'auto-1',
      danger: true,
    });

    return { triggered: true as const, jobId: job.id, action: this.action };
  }

  /**
   * Consume a validation conclusion and store it for policy evaluation.
   */
  consumeValidationConclusion(conclusion: ValidationConclusion): void {
    this.validationConclusions.push(conclusion);

    // Auto-trigger rollback if score is critically low
    if (!conclusion.passed && conclusion.score < 0.3) {
      this.operationJobService.setStatus(conclusion.jobId, 'ROLLING_BACK');
    }
  }

  /**
   * Consume observation anomalies and evaluate against policy thresholds.
   */
  consumeObservationAnomaly(anomaly: ObservationAnomaly): void {
    this.observationAnomalies.push(anomaly);

    // Check if anomaly severity meets threshold for triggering action
    const severityOrder = { warning: 0, error: 1, critical: 2 };
    if (
      severityOrder[anomaly.severity] >=
      severityOrder[this.anomalySeverityThreshold]
    ) {
      const job = this.operationJobService.create({
        tenantId: anomaly.tenantId,
        operation: this.action,
        target: anomaly.target,
        version: 'v1',
        batch: `anomaly-${Date.now()}`,
        danger: anomaly.severity === 'critical',
      });

      this.operationJobService.setStatus(job.id, 'PENDING_VERIFICATION');
    }
  }

  /**
   * Get recent validation conclusions for a tenant.
   */
  getValidationConclusions(tenantId: string, limit = 10): ValidationConclusion[] {
    return this.validationConclusions
      .filter((c) => c.tenantId === tenantId)
      .slice(-limit);
  }

  /**
   * Get recent observation anomalies for a tenant.
   */
  getObservationAnomalies(tenantId: string, limit = 10): ObservationAnomaly[] {
    return this.observationAnomalies
      .filter((a) => a.tenantId === tenantId)
      .slice(-limit);
  }
}
