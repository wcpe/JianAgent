import { Injectable } from '@nestjs/common';
import { TaskState } from '@jian-agent/shared-domain';
import type { TaskStatusDto } from '@jian-agent/shared-domain';

const DEFAULT_ATTEMPT = 1;
const DEFAULT_MAX_ATTEMPTS = 1;

/** Raw file operation result from FileManager. */
export interface FileOperationSource {
  readonly taskId: string;
  readonly operation: 'upload' | 'download' | 'delete' | 'copy' | 'move' | 'mkdir';
  readonly success: boolean;
  readonly error?: string | null;
  readonly progress?: number;
}

/** Raw plugin operation result from PluginManager. */
export interface PluginOperationSource {
  readonly taskId: string;
  readonly operation: 'install' | 'uninstall' | 'enable' | 'disable' | 'reload';
  readonly success: boolean;
  readonly error?: string | null;
  readonly progress?: number;
}

/** Raw terminal operation result from PTY/Session. */
export interface TerminalOperationSource {
  readonly taskId: string;
  readonly operation: 'execute' | 'attach' | 'resize' | 'close';
  readonly success: boolean;
  readonly error?: string | null;
  readonly progress?: number;
}

@Injectable()
export class TaskMapper {
  /** Map a file operation to a unified task status. */
  fromFileOperation(op: FileOperationSource): TaskStatusDto {
    return this.mapOperation(op);
  }

  /** Map a plugin operation to a unified task status. */
  fromPluginOperation(op: PluginOperationSource): TaskStatusDto {
    return this.mapOperation(op);
  }

  /** Map a terminal operation to a unified task status. */
  fromTerminalOperation(op: TerminalOperationSource): TaskStatusDto {
    return this.mapOperation(op);
  }

  /** Create a task status from raw parts. */
  fromParts(
    taskId: string,
    state: TaskState,
    progress: number = 1,
    error: string | null = null,
  ): TaskStatusDto {
    return this.withDefaults({ taskId, state, progress, error });
  }

  private mapOperation(op: {
    taskId: string;
    success: boolean;
    error?: string | null;
    progress?: number;
  }): TaskStatusDto {
    const state: TaskState = op.success ? TaskState.COMPLETED : TaskState.FAILED;
    return this.withDefaults({
      taskId: op.taskId,
      state,
      progress: op.progress ?? (op.success ? 1 : 0),
      error: op.error ?? null,
    });
  }

  private withDefaults(status: Pick<TaskStatusDto, 'taskId' | 'state' | 'progress' | 'error'>): TaskStatusDto {
    return {
      ...status,
      attempt: DEFAULT_ATTEMPT,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      retryable: false,
      resumeToken: null,
      failureClass: null,
    };
  }
}
