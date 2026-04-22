/** SP-17: Metric summary DTO pushed via WebSocket */

export interface MetricSummaryDto {
  readonly serverId: string;
  readonly tps: number;
  readonly mspt: number;
  readonly botCount: number;
  readonly cpuPercent: number;
  readonly memoryMb: number;
  readonly timestamp: number;
}

export interface WorkerEventDto {
  readonly type: 'worker_registered' | 'worker_offline' | 'worker_unhealthy' | 'worker_deregistered';
  readonly workerId: string;
  readonly message: string;
  readonly timestamp: number;
}

export interface DetailEventDto {
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: number;
}
