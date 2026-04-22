import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import { validationRun, validationVerdict, validationPlan } from '../storage/schema.js';
import { PlatformObservabilityService, type ObservabilitySummary } from '../platform-observability/platform-observability.service.js';
import { SessionReportService } from '../metrics/session-report.service.js';
import type {
  ValidationVerdictDto,
  EvidenceItemDto,
  SessionReportDto,
} from '@jian-agent/shared-domain';

export interface VerdictGenerationResult {
  readonly verdict: ValidationVerdictDto;
  readonly report: SessionReportDto;
  readonly observability: ObservabilitySummary;
}

export interface VerdictThresholds {
  readonly tpsMinThreshold: number;
  readonly msptMaxThreshold: number;
  readonly joinFailureRateMax: number; // percentage 0-100
  readonly maxCriticalAlerts: number;
  readonly maxExceptions: number;
}

const DEFAULT_THRESHOLDS: VerdictThresholds = {
  tpsMinThreshold: 15,
  msptMaxThreshold: 50,
  joinFailureRateMax: 10,
  maxCriticalAlerts: 0,
  maxExceptions: 5,
};

/**
 * ValidationReportService — generates ValidationVerdict by aggregating
 * validation thresholds, session reports, and observability data.
 */
@Injectable()
export class ValidationReportService {
  private readonly logger = new Logger(ValidationReportService.name);

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly observabilityService: PlatformObservabilityService,
    private readonly sessionReportService: SessionReportService,
  ) {}

  /**
   * Generate a ValidationVerdict for a completed validation run.
   * Evaluates all metrics against thresholds and produces a verdict with evidence.
   */
  async generateVerdict(
    validationRunId: string,
    thresholds: VerdictThresholds = DEFAULT_THRESHOLDS,
  ): Promise<VerdictGenerationResult> {
    // Fetch the validation run
    const [run] = this.db
      .select()
      .from(validationRun)
      .where(eq(validationRun.id, validationRunId))
      .all();

    if (!run) {
      throw new NotFoundException(`Validation run ${validationRunId} not found`);
    }

    if (run.status !== 'completed' && run.status !== 'failed') {
      this.logger.warn(`Validation run ${validationRunId} is not completed (status: ${run.status})`);
    }

    // Get the session report linked to this validation run
    const report = await this.sessionReportService.generateReportForValidationRun(validationRunId);

    // Get observability summary (alerts and exceptions)
    const observability = await this.observabilityService.getValidationObservabilitySummary(validationRunId);

    // Evaluate all criteria and collect evidence
    const evidence: EvidenceItemDto[] = [];
    let passCount = 0;
    let totalCriteria = 0;

    // 1. TPS minimum check
    totalCriteria++;
    const tpsPassed = report.serverPerf.minTps >= thresholds.tpsMinThreshold;
    if (tpsPassed) passCount++;
    evidence.push({
      type: 'metric',
      description: `最低 TPS ${report.serverPerf.minTps.toFixed(1)} ${tpsPassed ? '>= ' : '< '}${thresholds.tpsMinThreshold}`,
      value: report.serverPerf.minTps,
      reference: 'tps_min',
    });

    // 2. MSPT maximum check
    totalCriteria++;
    const msptPassed = report.serverPerf.maxMspt <= thresholds.msptMaxThreshold;
    if (msptPassed) passCount++;
    evidence.push({
      type: 'metric',
      description: `最高 MSPT ${report.serverPerf.maxMspt.toFixed(1)}ms ${msptPassed ? '<= ' : '> '}${thresholds.msptMaxThreshold}ms`,
      value: report.serverPerf.maxMspt,
      reference: 'mspt_max',
    });

    // 3. Join failure rate check
    totalCriteria++;
    const joinFailureRate = report.botStats.totalSpawned > 0
      ? (report.botStats.joinFailures / report.botStats.totalSpawned) * 100
      : 0;
    const joinPassed = joinFailureRate <= thresholds.joinFailureRateMax;
    if (joinPassed) passCount++;
    evidence.push({
      type: 'metric',
      description: `加入失败率 ${joinFailureRate.toFixed(1)}% ${joinPassed ? '<= ' : '> '}${thresholds.joinFailureRateMax}%`,
      value: joinFailureRate,
      reference: 'join_failure_rate',
    });

    // 4. Critical alerts check
    totalCriteria++;
    const criticalAlertsPassed = observability.alertCounts.critical <= thresholds.maxCriticalAlerts;
    if (criticalAlertsPassed) passCount++;
    evidence.push({
      type: 'log',
      description: `严重告警数 ${observability.alertCounts.critical} ${criticalAlertsPassed ? '<= ' : '> '}${thresholds.maxCriticalAlerts}`,
      value: observability.alertCounts.critical,
      reference: 'critical_alerts',
    });

    // 5. Exceptions check
    totalCriteria++;
    const exceptionsPassed = observability.exceptionCount <= thresholds.maxExceptions;
    if (exceptionsPassed) passCount++;
    evidence.push({
      type: 'log',
      description: `异常数 ${observability.exceptionCount} ${exceptionsPassed ? '<= ' : '> '}${thresholds.maxExceptions}`,
      value: observability.exceptionCount,
      reference: 'exceptions',
    });

    // Calculate pass rate
    const passRate = totalCriteria > 0 ? (passCount / totalCriteria) * 100 : 0;

    // Determine verdict result
    let result: ValidationVerdictDto['result'];
    if (passCount === totalCriteria) {
      result = 'passed';
    } else if (observability.alertCounts.critical > 0) {
      result = 'rollback-suggested';
    } else if (passRate >= 60) {
      result = 'manual-review';
    } else {
      result = 'failed';
    }

    // Generate summary text
    const summary = this.generateSummary(result, passCount, totalCriteria, passRate, report, observability);

    // Create the verdict
    const now = new Date().toISOString();
    const verdictId = `vv_${randomUUID().slice(0, 8)}`;

    const [verdictRow] = await this.db
      .insert(validationVerdict)
      .values({
        id: verdictId,
        runId: validationRunId,
        result,
        summary,
        evidenceJson: JSON.stringify(evidence),
        createdAt: now,
      })
      .returning();

    const verdict: ValidationVerdictDto = {
      id: verdictRow.id,
      runId: verdictRow.runId,
      result: verdictRow.result as ValidationVerdictDto['result'],
      summary: verdictRow.summary,
      evidence,
      decidedAt: verdictRow.createdAt,
      decidedBy: 'system',
    };

    this.logger.log(`Generated verdict ${verdictId} for run ${validationRunId}: ${result}`);

    return { verdict, report, observability };
  }

  /**
   * Get an existing verdict for a validation run.
   */
  async getVerdictByRunId(validationRunId: string): Promise<ValidationVerdictDto | null> {
    const [row] = this.db
      .select()
      .from(validationVerdict)
      .where(eq(validationVerdict.runId, validationRunId))
      .all();

    if (!row) return null;

    let evidence: EvidenceItemDto[] = [];
    try {
      evidence = row.evidenceJson ? JSON.parse(row.evidenceJson) : [];
    } catch {
      evidence = [];
    }

    return {
      id: row.id,
      runId: row.runId,
      result: row.result as ValidationVerdictDto['result'],
      summary: row.summary,
      evidence,
      decidedAt: row.createdAt,
    };
  }

  /**
   * Get all verdicts for a validation plan.
   */
  async getVerdictsByPlanId(planId: string): Promise<ValidationVerdictDto[]> {
    // Get all runs for this plan
    const runs = this.db
      .select()
      .from(validationRun)
      .where(eq(validationRun.planId, planId))
      .all();

    const verdicts: ValidationVerdictDto[] = [];
    for (const run of runs) {
      const verdict = await this.getVerdictByRunId(run.id);
      if (verdict) {
        verdicts.push(verdict);
      }
    }

    return verdicts;
  }

  private generateSummary(
    result: ValidationVerdictDto['result'],
    passCount: number,
    totalCriteria: number,
    passRate: number,
    report: SessionReportDto,
    observability: ObservabilitySummary,
  ): string {
    const lines: string[] = [];

    switch (result) {
      case 'passed':
        lines.push(`验证通过：所有 ${totalCriteria} 项检查均满足阈值要求。`);
        break;
      case 'failed':
        lines.push(`验证失败：仅 ${passCount}/${totalCriteria} 项检查通过（通过率 ${passRate.toFixed(0)}%）。`);
        break;
      case 'manual-review':
        lines.push(`需要人工复核：${passCount}/${totalCriteria} 项检查通过（通过率 ${passRate.toFixed(0)}%）。`);
        break;
      case 'rollback-suggested':
        lines.push(`建议回滚：存在 ${observability.alertCounts.critical} 条严重告警，需要立即处理。`);
        break;
    }

    lines.push(`会话时长：${(report.durationMs / 1000).toFixed(0)} 秒`);
    lines.push(`峰值在线：${report.botStats.peakOnline} 个机器人`);
    lines.push(`平均 TPS：${report.serverPerf.avgTps.toFixed(1)}, 最低 TPS：${report.serverPerf.minTps.toFixed(1)}`);
    lines.push(`告警总数：${observability.alertCounts.total} (严重: ${observability.alertCounts.critical})`);
    lines.push(`异常数：${observability.exceptionCount}`);

    return lines.join('\n');
  }
}
