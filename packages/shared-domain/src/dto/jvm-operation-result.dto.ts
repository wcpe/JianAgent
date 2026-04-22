import type { JvmTargetDto } from './jvm-target.dto.js';

/** Supported JVM operation types. */
export type JvmOperationType =
  | 'attach-helper'
  | 'detach-helper'
  | 'thread-dump'
  | 'heap-dump'
  | 'gc-trigger'
  | 'jfr-start'
  | 'jfr-stop'
  | 'jfr-dump'
  | 'jmx-query'
  | 'probe-inject'
  | 'probe-remove'
  | 'console-command'
  | 'eval-script';

/**
 * Unified result for JVM diagnostic operations.
 * Returned by the JVM Facade for every JVM-targeted action.
 */
export interface JvmOperationResultDto {
  /** Whether the operation completed successfully. */
  readonly success: boolean;
  /** The type of operation performed. */
  readonly operation: JvmOperationType;
  /** The target JVM this operation was applied to. */
  readonly target: JvmTargetDto;
  /** Unique request identifier for traceability. */
  readonly requestId: string;
  /** ISO-8601 timestamp when the operation completed. */
  readonly completedAt: string;
  /** Human-readable result message (error detail on failure). */
  readonly message?: string;
  /** Operation-specific payload (e.g. thread dump text, heap dump path). */
  readonly data?: unknown;
  /** Error code for programmatic handling (e.g. 'JVM_NOT_FOUND'). */
  readonly errorCode?: string;
  /** Wall-clock duration in milliseconds. */
  readonly durationMs?: number;
}
