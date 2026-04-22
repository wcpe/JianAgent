import type { FileTaskKind } from '../enums/file-task-kind.js';
import type { TaskStatusDto } from './task-status.dto.js';

export interface FileTaskDto extends TaskStatusDto {
  readonly serverId: string;
  readonly kind: FileTaskKind;
  readonly sourcePaths: readonly string[];
  readonly resultArtifact: string | null;
  readonly errorDetail: string | null;
}
