import type { LogBackendMode, ProbeRuntimeKind } from './platform-runtime-capability.dto.js';
import type { AlertLevel } from '../enums/alert-level.js';
import type { AlertSummaryDto } from './alert.dto.js';
import type { MetricSnapshotDto, JmxMetricSnapshotDto } from './metric-snapshot.dto.js';

export type MonitoringHealthState = 'healthy' | 'degraded' | 'critical';

export interface MonitoringSignalDto {
  readonly id: string;
  readonly source: 'probe' | 'jmx' | 'alert';
  readonly metric: string;
  readonly level: AlertLevel;
  readonly message: string;
  readonly value: number | null;
  readonly threshold: number | null;
}

export interface MonitoringOverviewDto {
  readonly serverId: string;
  readonly generatedAt: string;
  readonly state: MonitoringHealthState;
  readonly backend?: LogBackendMode;
  readonly degradedMode?: boolean;
  readonly logBackendState?: 'healthy' | 'degraded' | 'unavailable';
  readonly probeRuntimeKind?: ProbeRuntimeKind | null;
  readonly latestProbe: MetricSnapshotDto | null;
  readonly latestJmx: JmxMetricSnapshotDto | null;
  readonly alertSummary: AlertSummaryDto;
  readonly activeRuleCount: number;
  readonly activeJmxScheduleCount: number;
  readonly signals: readonly MonitoringSignalDto[];
}
