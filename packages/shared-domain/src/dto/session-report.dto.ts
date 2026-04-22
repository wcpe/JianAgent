/** SP-16: Session report DTOs */

export interface PhaseReportEntryDto {
  readonly phaseId: string;
  readonly phaseName: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly botCount: number;
  readonly avgTps: number;
  readonly avgMspt: number;
  readonly status: 'completed' | 'failed' | 'skipped';
  readonly failureReason?: string;
}

export interface BotStatsDto {
  readonly totalSpawned: number;
  readonly peakOnline: number;
  readonly avgOnline: number;
  readonly joinFailures: number;
  readonly disconnections: number;
}

export interface ServerPerfDto {
  readonly avgTps: number;
  readonly minTps: number;
  readonly avgMspt: number;
  readonly maxMspt: number;
  readonly avgCpuPercent: number;
  readonly peakCpuPercent: number;
  readonly avgMemoryMb: number;
  readonly peakMemoryMb: number;
}

export interface AlertSummaryReportDto {
  readonly total: number;
  readonly bySeverity: Readonly<Record<string, number>>;
  readonly topAlerts: readonly { readonly rule: string; readonly count: number }[];
}

export interface SessionReportDto {
  readonly sessionId: string;
  readonly serverId: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly durationMs: number;
  readonly botStats: BotStatsDto;
  readonly serverPerf: ServerPerfDto;
  readonly phases: readonly PhaseReportEntryDto[];
  readonly alerts: AlertSummaryReportDto;
  readonly conclusions: readonly string[];
  readonly validationRunId?: string;
}

export interface MetricTimeSeriesPoint {
  readonly timestamp: number;
  readonly value: number;
}
