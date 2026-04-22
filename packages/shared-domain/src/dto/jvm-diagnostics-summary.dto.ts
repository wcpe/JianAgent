import type { JvmTargetDto } from './jvm-target.dto.js';
import type { JmxMetricSnapshotDto } from './metric-snapshot.dto.js';
import type { JfrTaskDto } from './java-helper.dto.js';
import type { AlertLevel } from '../enums/alert-level.js';

/** JVM diagnostic health state. */
export type JvmHealthState = 'healthy' | 'degraded' | 'critical' | 'unknown';

/** Active risk signal types. */
export type JvmRiskSignalType =
  | 'high-cpu'
  | 'high-memory'
  | 'gc-pressure'
  | 'thread-contention'
  | 'deadlock-detected'
  | 'memory-leak-suspected'
  | 'jfr-recording-failed'
  | 'jmx-connection-lost';

/** Single active risk signal. */
export interface JvmRiskSignalDto {
  readonly type: JvmRiskSignalType;
  readonly level: AlertLevel;
  readonly message: string;
  readonly detectedAt: string;
  readonly value: number | null;
  readonly threshold: number | null;
}

/** Recent diagnostic action result. */
export interface JvmDiagnosticActionDto {
  readonly id: string;
  readonly operation: string;
  readonly target: JvmTargetDto;
  readonly success: boolean;
  readonly message: string;
  readonly completedAt: string;
  readonly durationMs: number;
}

/**
 * JVM Diagnostics Summary DTO.
 * Provides a consolidated view of JVM health, JMX/JFR status,
 * active risk signals, and recent diagnostic actions.
 */
export interface JvmDiagnosticsSummaryDto {
  /** The JVM target this summary refers to. */
  readonly target: JvmTargetDto;
  /** ISO-8601 timestamp when the summary was generated. */
  readonly generatedAt: string;
  /** Overall JVM health state. */
  readonly healthState: JvmHealthState;
  /** Latest JMX metric snapshot (null if unavailable). */
  readonly latestJmx: JmxMetricSnapshotDto | null;
  /** Active JFR recording tasks. */
  readonly activeJfrRecordings: readonly JfrTaskDto[];
  /** Active risk signals. */
  readonly riskSignals: readonly JvmRiskSignalDto[];
  /** Recent diagnostic actions (last 10). */
  readonly recentActions: readonly JvmDiagnosticActionDto[];
  /** Whether the JVM is attached via helper. */
  readonly helperAttached: boolean;
  /** Whether JMX connection is active. */
  readonly jmxConnected: boolean;
  /** JVM uptime in seconds. */
  readonly uptimeSeconds: number | null;
}