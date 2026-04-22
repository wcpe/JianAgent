import type { TaskState } from '../enums/task-state.js';

export type TaskFailureClass =
  | 'network-timeout'
  | 'authentication'
  | 'remote-closed'
  | 'protocol'
  | 'non-recoverable'
  | 'unknown';

export interface TaskStatusDto {
  readonly taskId: string;
  readonly state: TaskState;
  readonly progress: number;
  readonly error: string | null;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly retryable: boolean;
  readonly resumeToken: string | null;
  readonly failureClass: TaskFailureClass | null;
}
