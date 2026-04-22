export interface BackupDto {
  readonly id: string;
  readonly serverId: string;
  readonly serverName: string;
  readonly type: BackupType;
  readonly status: BackupStatus;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly includes: readonly string[];
  readonly note: string;
  readonly createdAt: string;
  readonly completedAt: string;
}

export type BackupType = 'full' | 'world' | 'config' | 'plugins';
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface CreateBackupRequest {
  readonly type: BackupType;
  readonly includes?: readonly string[];
  readonly note?: string;
}

export interface BackupScheduleDto {
  readonly serverId: string;
  readonly enabled: boolean;
  readonly cronExpression: string;
  readonly type: BackupType;
  readonly maxKeep: number;
}

export interface UpdateBackupScheduleRequest {
  readonly enabled: boolean;
  readonly cronExpression: string;
  readonly type: BackupType;
  readonly maxKeep: number;
}
