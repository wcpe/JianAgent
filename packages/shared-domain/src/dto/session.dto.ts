import type { SessionState } from '../enums/session-state.js';
import type { PhaseType } from '../enums/phase-type.js';

export interface PhaseConfig {
  readonly type: PhaseType;
  readonly durationMs?: number;
  readonly conditionExpr?: string;
  readonly behaviorTemplate?: string;
  readonly navigationProfile?: string;
  readonly scenarioProfile?: string;
  readonly determinismLevel?: 'strict' | 'balanced' | 'organic';
}

export interface CreateSessionRequest {
  readonly name: string;
  readonly serverConfigId: string;
  readonly botGroupId: string;
  readonly phases: readonly PhaseConfig[];
}

export interface SessionConfig {
  readonly id: string;
  readonly name: string;
  readonly serverConfigId: string;
  readonly botGroupId: string;
  readonly phases: readonly PhaseConfig[];
  readonly createdAt: string;
}

export interface SessionSummary {
  readonly id: string;
  readonly name: string;
  readonly state: SessionState;
  readonly currentPhaseIndex: number;
  readonly currentPhaseType: PhaseType | null;
  readonly botCount: number;
  readonly activeBotCount: number;
  readonly startedAt: string | null;
  readonly createdAt: string;
}

export interface SessionDetail extends SessionSummary {
  readonly serverConfigId: string;
  readonly botGroupId: string;
  readonly phases: readonly PhaseConfig[];
  readonly phaseRecords: readonly PhaseRecord[];
  readonly endedAt: string | null;
  readonly createdBy: string;
  readonly configSnapshot: string;
}

export interface PhaseRecord {
  readonly index: number;
  readonly type: PhaseType;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly durationMs: number | null;
  readonly botCountEnter: number;
  readonly botCountExit: number | null;
  readonly errorCount: number;
  readonly metricsSummary: string | null;
}

export interface SessionQueryParams {
  readonly state?: SessionState;
  readonly page?: number;
  readonly limit?: number;
}
