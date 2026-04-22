import type { SessionSummary, PhaseRecord } from '@jian-agent/shared-domain';

export interface SessionStatePush {
  readonly session: SessionSummary;
}

export interface SessionPhasePush {
  readonly sessionId: string;
  readonly phaseIndex: number;
  readonly phaseRecord: PhaseRecord;
}
