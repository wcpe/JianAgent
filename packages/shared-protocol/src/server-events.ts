import type { ServerState, ResourceSummaryDto } from '@jian-agent/shared-domain';

export interface ServerStatusPayload {
  /** Unified resource summary for the server */
  readonly resourceSummary: ResourceSummaryDto;
  readonly state: ServerState;
  readonly pid?: number;
  readonly uptime?: number;
  readonly cpuPercent?: number;
  readonly memoryMb?: number;
  readonly lastExitCode?: number;
  readonly lastExitTime?: string;
  readonly restartCount: number;
}
