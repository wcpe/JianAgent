import { Injectable } from '@nestjs/common';
import type { FileTaskDto, FileTaskKind, TaskFailureClass } from '@jian-agent/shared-domain';
import { TaskState } from '@jian-agent/shared-domain';
import type { fileTasks } from '../storage/schema.js';

type FileTaskRow = typeof fileTasks.$inferSelect;

const DEFAULT_ATTEMPT = 1;
const DEFAULT_MAX_ATTEMPTS = 3;

@Injectable()
export class FileTaskMapper {
  toDto(row: FileTaskRow): FileTaskDto {
    return {
      taskId: row.id,
      state: row.state as FileTaskDto['state'],
      progress: row.progress,
      error: row.errorDetail ?? null,
      serverId: row.serverId,
      kind: row.kind as FileTaskKind,
      sourcePaths: JSON.parse(row.sourcePaths) as readonly string[],
      resultArtifact: row.resultArtifact ?? null,
      errorDetail: row.errorDetail ?? null,
      attempt: row.attempt ?? DEFAULT_ATTEMPT,
      maxAttempts: row.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      retryable: row.retryable ?? this.isRetryable(row.kind as FileTaskKind),
      resumeToken: row.resumeToken ?? null,
      failureClass: (row.failureClass as FileTaskDto['failureClass']) ?? null,
    };
  }

  toRunningDto(row: FileTaskRow): FileTaskDto {
    return {
      ...this.toDto(row),
      state: TaskState.RUNNING,
    };
  }

  toCompletedDto(row: FileTaskRow, artifact: string): FileTaskDto {
    return {
      ...this.toDto(row),
      state: TaskState.COMPLETED,
      progress: 1,
      resultArtifact: artifact,
    };
  }

  toFailedDto(row: FileTaskRow, error: string, errorDetail?: string): FileTaskDto {
    const details = errorDetail ?? error;
    const failureClass = this.classifyFailure(error, details);
    const retryable = this.isRetryable(row.kind as FileTaskKind) && this.isFailureRetryable(failureClass);

    return {
      ...this.toDto(row),
      state: TaskState.FAILED,
      error,
      errorDetail: errorDetail ?? null,
      retryable: row.retryable ?? retryable,
      failureClass: (row.failureClass as FileTaskDto['failureClass']) ?? failureClass,
      resumeToken:
        row.resumeToken ?? (retryable ? this.buildResumeToken(row.id, row.attempt ?? DEFAULT_ATTEMPT) : null),
    };
  }

  toCancelledDto(row: FileTaskRow): FileTaskDto {
    return {
      ...this.toDto(row),
      state: TaskState.CANCELLED,
    };
  }

  private isRetryable(kind: FileTaskKind): boolean {
    return (
      kind === 'UPLOAD' ||
      kind === 'PACK_DOWNLOAD' ||
      kind === 'REMOTE_DOWNLOAD' ||
      kind === 'DIR_COPY' ||
      kind === 'DIR_MOVE'
    );
  }

  private classifyFailure(error: string | null | undefined, errorDetail: string | null | undefined): TaskFailureClass {
    const haystack = `${error ?? ''} ${errorDetail ?? ''}`.toLowerCase();
    if (haystack.includes('timeout') || haystack.includes('timed out')) {
      return 'network-timeout';
    }
    if (haystack.includes('permission denied') || haystack.includes('authentication')) {
      return 'authentication';
    }
    if (
      haystack.includes('connection reset') ||
      haystack.includes('remote closed') ||
      haystack.includes('broken pipe') ||
      haystack.includes('econnreset')
    ) {
      return 'remote-closed';
    }
    if (haystack.includes('protocol')) {
      return 'protocol';
    }
    return haystack.trim() ? 'non-recoverable' : 'unknown';
  }

  private isFailureRetryable(failureClass: TaskFailureClass): boolean {
    return failureClass === 'network-timeout' || failureClass === 'remote-closed';
  }

  private buildResumeToken(taskId: string, attempt: number): string {
    return `${taskId}:attempt:${attempt}`;
  }
}
