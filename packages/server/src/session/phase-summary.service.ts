import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
import { randomUUID } from 'crypto';
import type { PhaseSummaryDto } from '@jian-agent/shared-domain';

/** In-memory representation of the phaseSummaries table row. */
interface PhaseSummaryRow {
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

export interface PhaseMetricsSnapshot {
  readonly botCount: number;
  readonly tps: number;
  readonly mspt: number;
}

export interface PhaseContext {
  readonly phaseName: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly botsAtEntry: number;
  readonly botsAtExit: number;
  readonly disconnectCount: number;
  readonly errorCount: number;
  readonly tpsSamples: readonly number[];
  readonly msptSamples: readonly number[];
  readonly completionStatus: 'completed' | 'failed' | 'skipped';
}

@Injectable()
export class PhaseSummaryService {
  private readonly logger = new Logger(PhaseSummaryService.name);
  private readonly baselineSnapshots = new Map<string, PhaseMetricsSnapshot>();

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
  ) {}

  recordBaseline(sessionId: string, phaseIndex: number, snapshot: PhaseMetricsSnapshot): void {
    this.baselineSnapshots.set(`${sessionId}:${phaseIndex}`, snapshot);
  }

  getBaseline(sessionId: string, phaseIndex: number): PhaseMetricsSnapshot | undefined {
    return this.baselineSnapshots.get(`${sessionId}:${phaseIndex}`);
  }

  async generateSummary(
    sessionId: string,
    phaseIndex: number,
    context: PhaseContext,
  ): Promise<PhaseSummaryDto> {
    const id = randomUUID();
    const startMs = new Date(context.startedAt).getTime();
    const endMs = new Date(context.endedAt).getTime();
    const durationMs = endMs - startMs;

    const avgTps =
      context.tpsSamples.length > 0
        ? context.tpsSamples.reduce((a, b) => a + b, 0) / context.tpsSamples.length
        : null;
    const minTps =
      context.tpsSamples.length > 0 ? Math.min(...context.tpsSamples) : null;
    const avgMspt =
      context.msptSamples.length > 0
        ? context.msptSamples.reduce((a, b) => a + b, 0) / context.msptSamples.length
        : null;
    const maxMspt =
      context.msptSamples.length > 0 ? Math.max(...context.msptSamples) : null;

    const row: PhaseSummaryRow = {
      id,
      sessionId,
      phaseIndex,
      phaseName: context.phaseName,
      startedAt: context.startedAt,
      endedAt: context.endedAt,
      durationMs,
      botsAtEntry: context.botsAtEntry,
      botsAtExit: context.botsAtExit,
      disconnectCount: context.disconnectCount,
      errorCount: context.errorCount,
      avgTps,
      minTps,
      avgMspt,
      maxMspt,
      completionStatus: context.completionStatus,
    };

    try {
      await this.db.run(
        /* sql */
        /* Uses raw SQL because schema.ts is not modified yet — will use drizzle insert after schema merge */
        {
          sql: `INSERT INTO phase_summaries (id, session_id, phase_index, phase_name, started_at, ended_at, duration_ms, bots_at_entry, bots_at_exit, disconnect_count, error_count, avg_tps, min_tps, avg_mspt, max_mspt, completion_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            row.id, row.sessionId, row.phaseIndex, row.phaseName,
            row.startedAt, row.endedAt, row.durationMs,
            row.botsAtEntry, row.botsAtExit, row.disconnectCount, row.errorCount,
            row.avgTps, row.minTps, row.avgMspt, row.maxMspt,
            row.completionStatus,
          ],
        } as any,
      );
    } catch (err) {
      this.logger.error(`Failed to insert phase summary: ${err}`);
    }

    this.baselineSnapshots.delete(`${sessionId}:${phaseIndex}`);
    return row;
  }

  async getSummariesBySession(sessionId: string): Promise<readonly PhaseSummaryDto[]> {
    try {
      const result = await this.db.all(
        {
          sql: `SELECT id, session_id as "sessionId", phase_index as "phaseIndex", phase_name as "phaseName", started_at as "startedAt", ended_at as "endedAt", duration_ms as "durationMs", bots_at_entry as "botsAtEntry", bots_at_exit as "botsAtExit", disconnect_count as "disconnectCount", error_count as "errorCount", avg_tps as "avgTps", min_tps as "minTps", avg_mspt as "avgMspt", max_mspt as "maxMspt", completion_status as "completionStatus" FROM phase_summaries WHERE session_id = ? ORDER BY phase_index`,
          params: [sessionId],
        } as any,
      );
      return (result as unknown as PhaseSummaryRow[]) ?? [];
    } catch (err) {
      this.logger.debug(`Failed to query phase summaries for session ${sessionId}`, err);
      return [];
    }
  }
}
