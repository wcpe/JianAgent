import type { MetricSnapshotDto } from './metric-snapshot.dto.js';
import type { AlertDto } from './alert.dto.js';

export interface DiskInfoDto {
  readonly mount: string;
  readonly totalGb: number;
  readonly usedGb: number;
  readonly usedPercent: number;
}

export interface SystemMetricsDto {
  readonly timestamp: string;
  readonly cpuUsagePercent: number;
  readonly cpuCount: number;
  readonly loadAvg1m: number;
  readonly loadAvg5m: number;
  readonly loadAvg15m: number;
  readonly totalMemoryMb: number;
  readonly freeMemoryMb: number;
  readonly usedMemoryPercent: number;
  readonly uptimeSeconds: number;
  readonly disks: readonly DiskInfoDto[];
  readonly networkRxBytesPerSec: number;
  readonly networkTxBytesPerSec: number;
}

export interface CorrelatedTimelineDto {
  readonly timeRange: { readonly start: string; readonly end: string };
  readonly metrics: readonly MetricSnapshotDto[];
  readonly systemMetrics: readonly SystemMetricsDto[];
  readonly errorLogs: readonly { readonly timestamp: string; readonly level: string; readonly content: string; readonly hostName: string }[];
  readonly alerts: readonly AlertDto[];
}
