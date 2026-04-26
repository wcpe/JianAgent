import { Injectable, Logger } from '@nestjs/common';
import type { ValidationRunDto } from './validation.types.js';

type ValidationRunRow = {
  id: string;
  planId: string;
  sessionId: string | null;
  operationJobId: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  metricsJson: string | null;
  createdAt: string;
};

@Injectable()
export class ValidationRunMapper {
  private readonly logger = new Logger(ValidationRunMapper.name);

  toDto(row: ValidationRunRow): ValidationRunDto {
    let metrics: Record<string, unknown> | undefined;
    if (row.metricsJson) {
      try {
        metrics = JSON.parse(row.metricsJson);
      } catch (err) {
        this.logger.warn(`Failed to parse metrics JSON for run ${row.id}`, err);
      }
    }

    return {
      id: row.id,
      planId: row.planId,
      serverId: row.sessionId ?? 'unknown',
      status: row.status as ValidationRunDto['status'],
      startedAt: row.startedAt,
      finishedAt: row.completedAt,
      durationMs: null,
      resultSummary: null,
      errorDetail: (metrics?.error as string) ?? null,
      metrics,
      createdAt: row.createdAt,
      updatedAt: row.createdAt,
    };
  }

  toDtoList(rows: ValidationRunRow[]): ValidationRunDto[] {
    return rows.map((row) => this.toDto(row));
  }
}