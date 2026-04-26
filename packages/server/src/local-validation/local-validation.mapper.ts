import { Injectable } from '@nestjs/common';
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

type LocalValidationRunRow = {
  id: string;
  name: string;
  mode: 'import-existing' | 'init-paper' | string;
  serverId: string | null;
  status: string;
  paperVersion: string | null;
  scenarioPackId: string;
  requestedBotCount: number;
  effectiveBotCount: number;
  requestedBy: string;
  failureCode: string | null;
  failureMessage: string | null;
  keepServerRunning: boolean | number;
  keepWorkspace: boolean | number;
  workspacePath: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LocalValidationStageRow = {
  id: string;
  runId: string;
  stageKey: string;
  title: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  timeoutMs: number;
  botGroupSnapshotJson: string;
  assertionSummaryJson: string;
};

type LocalValidationAssertionRow = {
  id: string;
  runId: string;
  stageId: string;
  assertionKey: string;
  title: string;
  required: boolean | number;
  status: string;
  threshold: number;
  actual: number;
  message: string;
  evidenceRefsJson: string;
};

type LocalValidationEvidenceRow = {
  id: string;
  runId: string;
  evidenceKind: string;
  timestamp: string;
  summary: string;
  payloadJson: string;
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === '') {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (_err) {
    return fallback;
  }
}

function parseObject<T extends Record<string, unknown>>(raw: string | null | undefined, fallback: T): T {
  const value = parseJson<unknown>(raw, fallback);
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : fallback;
}

@Injectable()
export class LocalValidationMapper {
  toRunDto(row: LocalValidationRunRow): LocalValidationRunDto {
    return {
      id: row.id,
      name: row.name,
      mode: row.mode as LocalValidationRunDto['mode'],
      serverId: row.serverId ?? undefined,
      status: row.status as LocalValidationRunStatus,
      paperVersion: row.paperVersion ?? undefined,
      scenarioPackId: row.scenarioPackId,
      requestedBotCount: row.requestedBotCount,
      effectiveBotCount: row.effectiveBotCount,
      requestedBy: row.requestedBy,
      failureCode: row.failureCode ?? undefined,
      failureMessage: row.failureMessage ?? undefined,
      keepServerRunning: Boolean(row.keepServerRunning),
      keepWorkspace: Boolean(row.keepWorkspace),
      workspacePath: row.workspacePath,
      startedAt: row.startedAt ?? undefined,
      finishedAt: row.finishedAt ?? undefined,
    };
  }

  toStageDto(row: LocalValidationStageRow): LocalValidationStageDto {
    return {
      id: row.id,
      runId: row.runId,
      stageKey: row.stageKey,
      title: row.title,
      status: row.status as LocalValidationStageStatus,
      startedAt: row.startedAt ?? undefined,
      finishedAt: row.finishedAt ?? undefined,
      timeoutMs: row.timeoutMs,
      botGroupSnapshot: parseJson(row.botGroupSnapshotJson, [] as LocalValidationStageDto['botGroupSnapshot']),
      assertionSummary: parseObject(row.assertionSummaryJson, { total: 0, passed: 0, failed: 0 }),
    };
  }

  toAssertionDto(row: LocalValidationAssertionRow): LocalValidationAssertionDto {
    return {
      id: row.id,
      runId: row.runId,
      stageId: row.stageId,
      key: row.assertionKey,
      title: row.title,
      required: Boolean(row.required),
      status: row.status as LocalValidationAssertionStatus,
      threshold: row.threshold,
      actual: row.actual,
      message: row.message,
      evidenceRefs: parseJson(row.evidenceRefsJson, [] as string[]),
    };
  }

  toEvidenceDto(row: LocalValidationEvidenceRow): LocalValidationEvidenceDto {
    return {
      id: row.id,
      runId: row.runId,
      kind: row.evidenceKind as LocalValidationEvidenceKind,
      timestamp: row.timestamp,
      summary: row.summary,
      payload: parseObject(row.payloadJson, {}),
    };
  }
}
