export interface PhaseSummaryDto {
  readonly id: string;
  readonly sessionId: string;
  readonly phaseIndex: number;
  readonly phaseName: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly botsAtEntry: number;
  readonly botsAtExit: number;
  readonly disconnectCount: number;
  readonly errorCount: number;
  readonly avgTps: number | null;
  readonly minTps: number | null;
  readonly avgMspt: number | null;
  readonly maxMspt: number | null;
  readonly completionStatus: 'completed' | 'failed' | 'skipped';
}
