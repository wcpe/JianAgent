/** SP-17: Worker DTOs */

export type WorkerStatus = 'online' | 'unhealthy' | 'offline';

export interface WorkerInfoDto {
  readonly workerId: string;
  readonly hostname: string;
  readonly port: number;
  readonly maxCapacity: number;
  readonly currentLoad: number;
  readonly status: WorkerStatus;
  readonly lastHeartbeat: number;
  readonly registeredAt: number;
  readonly tags: readonly string[];
}

export interface RegisterWorkerDto {
  readonly workerId: string;
  readonly hostname: string;
  readonly port: number;
  readonly maxCapacity: number;
  readonly currentLoad: number;
  readonly tags: readonly string[];
}

export interface HeartbeatDto {
  readonly currentLoad: number;
}

export type SchedulingStrategy = 'round_robin' | 'least_loaded' | 'capacity_aware';

export interface DistributionPlanEntry {
  readonly workerId: string;
  readonly botCount: number;
}

export interface DistributionPlanDto {
  readonly totalBots: number;
  readonly assignments: readonly DistributionPlanEntry[];
}

export interface MigrateBotRequestDto {
  readonly sourceWorkerId: string;
  readonly targetWorkerId: string;
  readonly botIds: readonly string[];
}

export interface MigrationResultDto {
  readonly migrated: number;
  readonly sourceWorkerId: string;
  readonly targetWorkerId: string;
  readonly errors: readonly string[];
}
