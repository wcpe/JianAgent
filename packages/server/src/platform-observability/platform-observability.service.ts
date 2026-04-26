import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import { alerts, legacyLogEntries as logEntries, validationRun } from '../storage/schema.js';

export interface ObservabilityAlert {
  readonly id: string;
  readonly timestamp: string;
  readonly level: string;
  readonly ruleName: string;
  readonly message: string;
  readonly value?: number;
  readonly threshold?: number;
}

export interface ObservabilityException {
  readonly timestamp: string;
  readonly level: string;
  readonly message: string;
  readonly source: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ObservabilitySummary {
  readonly validationRunId: string;
  readonly sessionId?: string;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly alerts: readonly ObservabilityAlert[];
  readonly exceptions: readonly ObservabilityException[];
  readonly alertCounts: {
    readonly critical: number;
    readonly warning: number;
    readonly info: number;
    readonly total: number;
  };
  readonly exceptionCount: number;
}

/**
 * PlatformObservabilityService — aggregates alerts and exceptions
 * that occurred during a validation run, providing a consolidated
 * observability summary for verdict generation and reporting.
 */
@Injectable()
export class PlatformObservabilityService {
  private readonly logger = new Logger(PlatformObservabilityService.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  /**
   * Get the full observability summary for a validation run.
   * Aggregates alerts and exceptions that occurred during the run's time window.
   */
  async getValidationObservabilitySummary(validationRunId: string): Promise<ObservabilitySummary> {
    // Fetch the validation run to determine the time window
    const [run] = this.db
      .select()
      .from(validationRun)
      .where(eq(validationRun.id, validationRunId))
      .all();

    if (!run) {
      this.logger.warn(`Validation run ${validationRunId} not found`);
      return this.buildEmptySummary(validationRunId);
    }

    const startTime = run.startedAt;
    const endTime = run.completedAt;
    const sessionId = run.sessionId ?? undefined;

    // Fetch alerts in the time window
    const alertRows = await this.fetchAlertsInWindow(startTime, endTime, sessionId);

    // Fetch error/exception log entries in the time window
    const exceptionRows = await this.fetchExceptionsInWindow(startTime, endTime, sessionId);

    const observabilityAlerts: ObservabilityAlert[] = alertRows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      level: row.level,
      ruleName: row.ruleName,
      message: row.message,
      value: row.value ?? undefined,
      threshold: row.threshold ?? undefined,
    }));

    const exceptions: ObservabilityException[] = exceptionRows.map((row) => {
      let metadata: Record<string, unknown> | undefined;
      try {
        metadata = row.metadata ? JSON.parse(row.metadata) : undefined;
      } catch (_err) {
        metadata = undefined;
      }
      return {
        timestamp: row.timestamp,
        level: row.level,
        message: row.message,
        source: row.source,
        metadata,
      };
    });

    // Count alerts by severity
    let criticalCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    for (const alert of observabilityAlerts) {
      switch (alert.level.toUpperCase()) {
        case 'CRITICAL':
          criticalCount++;
          break;
        case 'WARNING':
          warningCount++;
          break;
        case 'INFO':
          infoCount++;
          break;
      }
    }

    return {
      validationRunId,
      sessionId,
      startTime: startTime ?? undefined,
      endTime: endTime ?? undefined,
      alerts: observabilityAlerts,
      exceptions,
      alertCounts: {
        critical: criticalCount,
        warning: warningCount,
        info: infoCount,
        total: observabilityAlerts.length,
      },
      exceptionCount: exceptions.length,
    };
  }

  /**
   * Get only alerts that occurred during a validation run.
   */
  async getValidationAlerts(validationRunId: string): Promise<readonly ObservabilityAlert[]> {
    const summary = await this.getValidationObservabilitySummary(validationRunId);
    return summary.alerts;
  }

  /**
   * Get only exceptions that occurred during a validation run.
   */
  async getValidationExceptions(validationRunId: string): Promise<readonly ObservabilityException[]> {
    const summary = await this.getValidationObservabilitySummary(validationRunId);
    return summary.exceptions;
  }

  /**
   * Check if there were any critical alerts during the validation run.
   */
  async hasCriticalAlerts(validationRunId: string): Promise<boolean> {
    const summary = await this.getValidationObservabilitySummary(validationRunId);
    return summary.alertCounts.critical > 0;
  }

  private async fetchAlertsInWindow(
    startTime: string | null,
    endTime: string | null,
    serverId?: string,
  ): Promise<any[]> {
    const conditions = [];

    if (startTime) {
      conditions.push(gte(alerts.timestamp, startTime));
    }
    if (endTime) {
      conditions.push(lte(alerts.timestamp, endTime));
    }
    if (serverId) {
      conditions.push(eq(alerts.serverId, serverId));
    }

    if (conditions.length === 0) {
      return this.db
        .select()
        .from(alerts)
        .orderBy(desc(alerts.timestamp))
        .limit(100)
        .all();
    }

    return this.db
      .select()
      .from(alerts)
      .where(and(...conditions))
      .orderBy(desc(alerts.timestamp))
      .all();
  }

  private async fetchExceptionsInWindow(
    startTime: string | null,
    endTime: string | null,
    serverId?: string,
  ): Promise<any[]> {
    const conditions = [
      eq(logEntries.source, 'platform'),
      eq(logEntries.level, 'ERROR'),
    ];

    if (startTime) {
      conditions.push(gte(logEntries.timestamp, startTime));
    }
    if (endTime) {
      conditions.push(lte(logEntries.timestamp, endTime));
    }
    if (serverId) {
      conditions.push(eq(logEntries.module, serverId));
    }

    return this.db
      .select()
      .from(logEntries)
      .where(and(...conditions))
      .orderBy(desc(logEntries.timestamp))
      .limit(100)
      .all();
  }

  private buildEmptySummary(validationRunId: string): ObservabilitySummary {
    return {
      validationRunId,
      sessionId: undefined,
      startTime: undefined,
      endTime: undefined,
      alerts: [],
      exceptions: [],
      alertCounts: {
        critical: 0,
        warning: 0,
        info: 0,
        total: 0,
      },
      exceptionCount: 0,
    };
  }
}
