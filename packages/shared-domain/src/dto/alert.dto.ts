import type { AlertLevel } from '../enums/alert-level.js';

export interface AlertDto {
  readonly id: string;
  readonly timestamp: string;
  readonly level: AlertLevel;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly message: string;
  readonly serverId?: string;
  readonly value?: number;
  readonly threshold?: number;
  readonly acknowledged: boolean;
}

export interface AlertSummaryDto {
  readonly totalActive: number;
  readonly criticalCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
}
