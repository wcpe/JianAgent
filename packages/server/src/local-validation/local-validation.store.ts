import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type {
  LocalValidationAssertionDto,
  LocalValidationAssertionStatus,
  LocalValidationEvidenceDto,
  LocalValidationEvidenceKind,
  LocalValidationRunDto,
  LocalValidationRunStatus,
  LocalValidationStageDto,
  LocalValidationStageStatus,
} from '@jian-agent/shared-domain';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
import {
  localValidationAssertions,
  localValidationEvidence,
  localValidationRuns,
  localValidationStages,
} from '../storage/schema.js';
import { LocalValidationMapper } from './local-validation.mapper.js';

type LocalValidationRunMode = LocalValidationRunDto['mode'];

interface CreateLocalValidationRunInput {
  readonly id?: string;
  readonly name: string;
  readonly mode: LocalValidationRunMode;
  readonly serverId?: string | null;
  readonly status?: LocalValidationRunStatus;
  readonly paperVersion?: string | null;
  readonly scenarioPackId: string;
  readonly requestedBotCount: number;
  readonly effectiveBotCount?: number;
  readonly requestedBy: string;
  readonly failureCode?: string | null;
  readonly failureMessage?: string | null;
  readonly keepServerRunning: boolean;
  readonly keepWorkspace: boolean;
  readonly workspacePath: string;
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
}

interface UpdateRunStatusPatch {
  readonly serverId?: string | null;
  readonly paperVersion?: string | null;
  readonly effectiveBotCount?: number;
  readonly failureCode?: string | null;
  readonly failureMessage?: string | null;
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
}

interface UpsertStageInput {
  readonly id?: string;
  readonly runId: string;
  readonly stageKey: string;
  readonly title: string;
  readonly status?: LocalValidationStageStatus;
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
  readonly timeoutMs: number;
  readonly botGroupSnapshot?: readonly { readonly name: string; readonly botNames: readonly string[] }[];
  readonly assertionSummary?: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
  };
}

interface ReplaceAssertionInput {
  readonly id?: string;
  readonly stageId: string;
  readonly key: string;
  readonly title: string;
  readonly required?: boolean;
  readonly status?: LocalValidationAssertionStatus;
  readonly threshold: number;
  readonly actual: number;
  readonly message: string;
  readonly evidenceRefs?: readonly string[];
}

interface AppendEvidenceInput {
  readonly runId: string;
  readonly id?: string;
  readonly stageId?: string | null;
  readonly evidenceKind: LocalValidationEvidenceKind;
  readonly timestamp?: string;
  readonly summary: string;
  readonly payload?: Record<string, unknown>;
}

const TERMINAL_STATUSES: ReadonlySet<LocalValidationRunStatus> = new Set([
  'PASSED',
  'FAILED_PRECHECK',
  'FAILED_PROVISION',
  'FAILED_STARTUP',
  'FAILED_SCENARIO',
  'FAILED_RUNTIME',
  'CANCELLED',
  'FINISHED',
]);

function shortId(prefix: string): string {
  return `${prefix}${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

function stringifyJson(value: unknown, fallback: string): string {
  return value === undefined ? fallback : JSON.stringify(value);
}

async function requireRow<T>(
  rows: readonly T[] | T[],
  notFoundMessage: string,
): Promise<T> {
  const [row] = rows;
  if (!row) {
    throw new Error(notFoundMessage);
  }

  return row;
}

@Injectable()
export class LocalValidationStore {
  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly mapper: LocalValidationMapper = new LocalValidationMapper(),
  ) {}

  async createRun(input: CreateLocalValidationRunInput): Promise<LocalValidationRunDto> {
    const now = new Date().toISOString();
    const status = input.status ?? 'CREATED';
    const startedAt = input.startedAt ?? (status === 'CREATED' ? null : now);
    const finishedAt = input.finishedAt ?? (TERMINAL_STATUSES.has(status) ? now : null);
    const [row] = await this.db
      .insert(localValidationRuns)
      .values({
        id: input.id ?? shortId('lvr_'),
        name: input.name,
        mode: input.mode,
        serverId: input.serverId ?? null,
        status,
        paperVersion: input.paperVersion ?? null,
        scenarioPackId: input.scenarioPackId,
        requestedBotCount: input.requestedBotCount,
        effectiveBotCount: input.effectiveBotCount ?? 0,
        requestedBy: input.requestedBy,
        failureCode: input.failureCode ?? null,
        failureMessage: input.failureMessage ?? null,
        keepServerRunning: input.keepServerRunning,
        keepWorkspace: input.keepWorkspace,
        workspacePath: input.workspacePath,
        startedAt,
        finishedAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.mapper.toRunDto(row);
  }

  async createDraftRun(input: Omit<CreateLocalValidationRunInput, 'status' | 'effectiveBotCount'>): Promise<LocalValidationRunDto> {
    return this.createRun({
      ...input,
      status: 'CREATED',
      effectiveBotCount: 0,
    });
  }

  async findRunById(id: string): Promise<LocalValidationRunDto | null> {
    const [row] = await this.db.select().from(localValidationRuns).where(eq(localValidationRuns.id, id));
    return row ? this.mapper.toRunDto(row) : null;
  }

  async requireRun(id: string): Promise<LocalValidationRunDto> {
    const run = await this.findRunById(id);
    if (!run) {
      throw new Error(`Local validation run ${id} not found`);
    }

    return run;
  }

  async updateRunStatus(id: string, status: LocalValidationRunStatus, patch: UpdateRunStatusPatch = {}): Promise<LocalValidationRunDto> {
    const existing = await this.requireRun(id);
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status,
      updatedAt: now,
      ...patch,
    };

    if (patch.startedAt === undefined && existing.startedAt === undefined && status !== 'CREATED') {
      updates.startedAt = now;
    }

    if (patch.finishedAt === undefined && TERMINAL_STATUSES.has(status)) {
      updates.finishedAt = now;
    }

    const [row] = await this.db
      .update(localValidationRuns)
      .set(updates)
      .where(eq(localValidationRuns.id, id))
      .returning();

    return this.mapper.toRunDto(row);
  }

  async attachServer(id: string, serverId: string): Promise<LocalValidationRunDto> {
    return this.updateRunStatus(id, 'PROVISIONING', { serverId });
  }

  async listRuns(): Promise<LocalValidationRunDto[]> {
    const rows = await this.db.select().from(localValidationRuns).orderBy(desc(localValidationRuns.updatedAt));
    return rows.map((row) => this.mapper.toRunDto(row));
  }

  async getLatestRunsByServerIds(
    serverIds: readonly string[],
  ): Promise<Map<string, LocalValidationRunDto>> {
    if (serverIds.length === 0) {
      return new Map();
    }

    const targetIds = new Set(serverIds);
    const runs = await this.listRuns();
    const latest = new Map<string, LocalValidationRunDto>();

    for (const run of runs) {
      const serverId = run.serverId;
      if (!serverId || !targetIds.has(serverId) || latest.has(serverId)) {
        continue;
      }
      latest.set(serverId, run);
      if (latest.size === targetIds.size) {
        break;
      }
    }

    return latest;
  }

  async listStages(runId: string): Promise<LocalValidationStageDto[]> {
    await this.requireRun(runId);
    const rows = await this.db
      .select()
      .from(localValidationStages)
      .where(eq(localValidationStages.runId, runId))
      .orderBy(asc(localValidationStages.startedAt), asc(localValidationStages.stageKey));
    return rows.map((row) => this.mapper.toStageDto(row));
  }

  async listAssertions(runId: string): Promise<LocalValidationAssertionDto[]> {
    await this.requireRun(runId);
    const rows = await this.db
      .select({
        assertion: localValidationAssertions,
      })
      .from(localValidationAssertions)
      .leftJoin(localValidationStages, eq(localValidationAssertions.stageId, localValidationStages.id))
      .where(eq(localValidationAssertions.runId, runId))
      .orderBy(asc(localValidationStages.startedAt), asc(localValidationStages.stageKey), asc(localValidationAssertions.assertionKey));
    return rows.map(({ assertion }) => this.mapper.toAssertionDto(assertion));
  }

  async listEvidence(runId: string): Promise<LocalValidationEvidenceDto[]> {
    await this.requireRun(runId);
    const rows = await this.db
      .select()
      .from(localValidationEvidence)
      .where(eq(localValidationEvidence.runId, runId))
      .orderBy(desc(localValidationEvidence.timestamp));
    return rows.map((row) => this.mapper.toEvidenceDto(row));
  }

  async upsertStage(input: UpsertStageInput): Promise<LocalValidationStageDto> {
    await this.requireRun(input.runId);

    const [existing] = await this.db
      .select()
      .from(localValidationStages)
      .where(and(eq(localValidationStages.runId, input.runId), eq(localValidationStages.stageKey, input.stageKey)));
    const now = new Date().toISOString();
    const botGroupSnapshot = input.botGroupSnapshot ?? [];
    const assertionSummary = input.assertionSummary ?? { total: 0, passed: 0, failed: 0 };

    if (existing) {
      const [row] = await this.db
        .update(localValidationStages)
        .set({
          title: input.title,
          status: input.status ?? existing.status,
          startedAt: input.startedAt === undefined ? existing.startedAt : input.startedAt,
          finishedAt: input.finishedAt === undefined ? existing.finishedAt : input.finishedAt,
          timeoutMs: input.timeoutMs,
          botGroupSnapshotJson: stringifyJson(botGroupSnapshot, '[]'),
          assertionSummaryJson: stringifyJson(assertionSummary, '{"total":0,"passed":0,"failed":0}'),
        })
        .where(eq(localValidationStages.id, existing.id))
        .returning();

      return this.mapper.toStageDto(row);
    }

    const [row] = await this.db
      .insert(localValidationStages)
      .values({
        id: input.id ?? shortId('lvs_'),
        runId: input.runId,
        stageKey: input.stageKey,
        title: input.title,
        status: input.status ?? 'pending',
        startedAt: input.startedAt ?? null,
        finishedAt: input.finishedAt ?? null,
        timeoutMs: input.timeoutMs,
        botGroupSnapshotJson: stringifyJson(botGroupSnapshot, '[]'),
        assertionSummaryJson: stringifyJson(assertionSummary, '{"total":0,"passed":0,"failed":0}'),
      })
      .returning();

    return this.mapper.toStageDto(row);
  }

  async replaceAssertions(runId: string, items: readonly ReplaceAssertionInput[]): Promise<LocalValidationAssertionDto[]> {
    await this.requireRun(runId);

    if (items.length > 0) {
      const stageIds = [...new Set(items.map((item) => item.stageId))];
      for (const stageId of stageIds) {
        await requireRow(
          await this.db.select().from(localValidationStages).where(and(eq(localValidationStages.id, stageId), eq(localValidationStages.runId, runId))),
          `Local validation stage ${stageId} not found`,
        );
      }
    }

    return this.db.transaction((tx) => {
      const stageIds = [...new Set(items.map((item) => item.stageId))];
      for (const stageId of stageIds) {
        tx.delete(localValidationAssertions)
          .where(and(eq(localValidationAssertions.runId, runId), eq(localValidationAssertions.stageId, stageId)))
          .run();
      }

      const rows: LocalValidationAssertionDto[] = [];
      for (const item of items) {
        const [row] = tx
          .insert(localValidationAssertions)
          .values({
            id: item.id ?? shortId('lva_'),
            runId,
            stageId: item.stageId,
            assertionKey: item.key,
            title: item.title,
            required: item.required ?? true,
            status: item.status ?? 'pending',
            threshold: item.threshold,
            actual: item.actual,
            message: item.message,
            evidenceRefsJson: stringifyJson(item.evidenceRefs ?? [], '[]'),
          })
          .returning()
          .all();

        rows.push(this.mapper.toAssertionDto(row));
      }

      return rows;
    });
  }

  async appendEvidence(input: AppendEvidenceInput): Promise<LocalValidationEvidenceDto> {
    await this.requireRun(input.runId);

    if (input.stageId !== undefined && input.stageId !== null) {
      await requireRow(
        await this.db.select().from(localValidationStages).where(eq(localValidationStages.id, input.stageId)),
        `Local validation stage ${input.stageId} not found`,
      );
    }

    const [row] = await this.db
      .insert(localValidationEvidence)
      .values({
        id: input.id ?? shortId('lve_'),
        runId: input.runId,
        evidenceKind: input.evidenceKind,
        timestamp: input.timestamp ?? new Date().toISOString(),
        summary: input.summary,
        payloadJson: stringifyJson(input.payload ?? {}, '{}'),
      })
      .returning();

    return this.mapper.toEvidenceDto(row);
  }
}
