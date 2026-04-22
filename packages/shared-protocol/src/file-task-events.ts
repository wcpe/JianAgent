import type { FileTaskDto, FileTaskKind } from '@jian-agent/shared-domain';

/** Fired when a file task reports progress */
export interface FileTaskProgressPayload {
  readonly taskId: string;
  readonly serverId: string;
  readonly kind: FileTaskKind;
  readonly progress: number;
  readonly message: string;
  readonly timestamp: string;
}

/** Fired when a file task completes successfully */
export interface FileTaskCompletedPayload {
  readonly taskId: string;
  readonly serverId: string;
  readonly kind: FileTaskKind;
  readonly resultArtifact: string;
  readonly timestamp: string;
  readonly task: FileTaskDto;
}

/** Fired when a file task fails */
export interface FileTaskFailedPayload {
  readonly taskId: string;
  readonly serverId: string;
  readonly kind: FileTaskKind;
  readonly errorDetail: string;
  readonly timestamp: string;
  readonly task: FileTaskDto;
}
