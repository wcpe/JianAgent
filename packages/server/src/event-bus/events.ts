import type {
  LocalValidationAssertionStatus,
  LocalValidationEvidenceKind,
  LocalValidationRunStatus,
  LocalValidationStageStatus,
} from '@jian-agent/shared-domain';

export interface ServerOutputEvent {
  readonly serverId: string;
  readonly stream: 'stdout' | 'stderr';
  readonly chunk: string;
  readonly timestamp: number;
}

export interface ServerStateChangedEvent {
  readonly serverId: string;
  readonly oldState: string;
  readonly newState: string;
  readonly pid?: number;
  readonly timestamp: number;
}

export interface ServerCrashedEvent {
  readonly serverId: string;
  readonly exitCode?: number;
  readonly signal?: string;
  readonly timestamp: number;
}

export interface ServerHealthEvent {
  readonly serverId: string;
  readonly status: 'ok' | 'unresponsive' | 'recovered';
  readonly pid?: number;
  readonly timestamp: number;
}

export interface TerminalCommandEvent {
  readonly serverId: string;
  readonly userId: string;
  readonly username: string;
  readonly command: string;
  readonly isDanger: boolean;
  readonly timestamp: number;
}

export interface ControlPlaneAgentRegisteredEvent {
  readonly agentId: string;
  readonly hostId: string;
  readonly capabilities: string[];
  readonly timestamp: number;
}

export interface ControlPlaneAgentHeartbeatEvent {
  readonly agentId: string;
  readonly hostId: string;
  readonly timestamp: number;
}

export interface FileTaskCreatedEvent {
  readonly taskId: string;
  readonly serverId: string;
  readonly kind: string;
  readonly sourcePaths: readonly string[];
  readonly timestamp: number;
}

export interface FileTaskStateChangedEvent {
  readonly taskId: string;
  readonly serverId: string;
  readonly kind: string;
  readonly oldState: string;
  readonly newState: string;
  readonly progress?: number;
  readonly error?: string;
  readonly errorDetail?: string;
  readonly resultArtifact?: string;
  readonly timestamp: number;
}

export interface LocalValidationRunEvent {
  readonly runId: string;
  readonly status: LocalValidationRunStatus | string;
  readonly serverId?: string;
  readonly paperVersion?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly timestamp: number;
}

export interface LocalValidationStageEvent {
  readonly runId: string;
  readonly stageId: string;
  readonly stageKey: string;
  readonly title: string;
  readonly status: LocalValidationStageStatus | string;
  readonly timestamp: number;
}

export interface LocalValidationAssertionEvent {
  readonly runId: string;
  readonly stageId: string;
  readonly key: string;
  readonly status: LocalValidationAssertionStatus | string;
  readonly message: string;
  readonly timestamp: number;
}

export interface LocalValidationEvidenceEvent {
  readonly runId: string;
  readonly evidenceId: string;
  readonly kind: LocalValidationEvidenceKind | string;
  readonly summary: string;
  readonly payload: Record<string, unknown>;
  readonly timestamp: number;
}

export interface ServerProvisionProgressEvent {
  readonly serverId: string;
  readonly phase: string;
  readonly progress: number;
  readonly message: string;
  readonly error?: string;
  readonly timestamp: number;
}
