export type LocalValidationRunStatus =
  | 'CREATED'
  | 'PRECHECKING'
  | 'PROVISIONING'
  | 'STARTING'
  | 'READY'
  | 'RUNNING_SCENARIO'
  | 'PASSED'
  | 'FAILED_PRECHECK'
  | 'FAILED_PROVISION'
  | 'FAILED_STARTUP'
  | 'FAILED_SCENARIO'
  | 'FAILED_RUNTIME'
  | 'CANCELLED'
  | 'CLEANING'
  | 'FINISHED';

export type LocalValidationStageStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type LocalValidationAssertionStatus = 'pending' | 'passed' | 'failed' | 'skipped';
export type LocalValidationEvidenceKind =
  | 'server-log'
  | 'bot-event'
  | 'probe-snapshot'
  | 'runtime-health'
  | 'operation'
  | 'chat-log';

export interface LocalValidationRunDto {
  readonly id: string;
  readonly name: string;
  readonly mode: 'import-existing' | 'init-paper';
  readonly serverId?: string;
  readonly status: LocalValidationRunStatus;
  readonly paperVersion?: string;
  readonly scenarioPackId: string;
  readonly requestedBotCount: number;
  readonly effectiveBotCount: number;
  readonly requestedBy: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly keepServerRunning: boolean;
  readonly keepWorkspace: boolean;
  readonly workspacePath: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
}

export interface LocalValidationStageDto {
  readonly id: string;
  readonly runId: string;
  readonly stageKey: string;
  readonly title: string;
  readonly status: LocalValidationStageStatus;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly timeoutMs: number;
  readonly botGroupSnapshot: readonly { readonly name: string; readonly botNames: readonly string[] }[];
  readonly assertionSummary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
  };
}

export interface LocalValidationAssertionDto {
  readonly id: string;
  readonly runId: string;
  readonly stageId: string;
  readonly key: string;
  readonly title: string;
  readonly required: boolean;
  readonly status: LocalValidationAssertionStatus;
  readonly threshold: number;
  readonly actual: number;
  readonly message: string;
  readonly evidenceRefs: readonly string[];
}

export interface LocalValidationEvidenceDto {
  readonly id: string;
  readonly runId: string;
  readonly kind: LocalValidationEvidenceKind;
  readonly timestamp: string;
  readonly summary: string;
  readonly payload: Record<string, unknown>;
}

export interface LocalValidationScenarioPackDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly stages: readonly {
    readonly key: string;
    readonly behaviorTemplate: string;
    readonly durationSec: number;
    readonly threshold: number;
  }[];
}
