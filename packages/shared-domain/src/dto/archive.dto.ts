/** SP-16: Archive DTOs */

export interface ArchiveResultDto {
  readonly exportedSessions: number;
  readonly cutoffDate: string;
  readonly retentionDays: number;
}

export interface ArchiveStatsDto {
  readonly totalSessions: number;
  readonly oldestDataDate: string | null;
  readonly archiveDirSizeMb: number;
  readonly retentionDays: number;
}

export interface UpdateRetentionDto {
  readonly retentionDays: number;
}
