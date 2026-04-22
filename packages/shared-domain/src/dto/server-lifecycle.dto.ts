import type { ServerLifecyclePhase } from '../enums/server-lifecycle-phase.js';

export interface LifecyclePhaseEvent {
  readonly serverId: string;
  readonly phase: ServerLifecyclePhase;
  readonly previousPhase: ServerLifecyclePhase;
  readonly message: string;
  readonly timestamp: number;
}

export interface ServerValidationResult {
  readonly serverId: string;
  readonly valid: boolean;
  readonly errors: ReadonlyArray<{
    readonly field: string;
    readonly message: string;
    readonly severity: 'error' | 'warning';
  }>;
}

export interface HookResult {
  readonly command: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
}

export interface LifecycleConfig {
  readonly validateTimeoutMs: number;
  readonly preStartTimeoutMs: number;
  readonly startTimeoutMs: number;
  readonly postStartTimeoutMs: number;
  readonly preStopTimeoutMs: number;
  readonly stopTimeoutMs: number;
  readonly postStopTimeoutMs: number;
  readonly scriptTimeoutMs: number;
  readonly readyPattern?: string;
  readonly readyTimeoutMs: number;
}

export const DEFAULT_LIFECYCLE_CONFIG: LifecycleConfig = {
  validateTimeoutMs: 10_000,
  preStartTimeoutMs: 30_000,
  startTimeoutMs: 120_000,
  postStartTimeoutMs: 30_000,
  preStopTimeoutMs: 30_000,
  stopTimeoutMs: 30_000,
  postStopTimeoutMs: 30_000,
  scriptTimeoutMs: 30_000,
  readyPattern: undefined,
  readyTimeoutMs: 120_000,
};
