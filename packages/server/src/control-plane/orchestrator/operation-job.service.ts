import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DrizzleDb } from '../../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../../storage/drizzle.provider.js';
import { cpOperationJobs } from '../../storage/schema.js';

export type JobStatus =
  | 'WAITING_APPROVAL'
  | 'PENDING'
  | 'RUNNING'
  | 'PENDING_VERIFICATION'
  | 'VERIFYING'
  | 'PENDING_VERDICT'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK'
  | 'CANCELLED';

export interface OperationJob {
  id: string;
  tenantId: string;
  operation: string;
  target: string;
  version: string;
  batch: string;
  idempotencyKey: string;
  status: JobStatus;
  danger: boolean;
}

@Injectable()
export class OperationJobService {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  create(input: {
    tenantId: string;
    operation: string;
    target: string;
    version: string;
    batch: string;
    danger: boolean;
  }): OperationJob {
    const idempotencyKey = `${input.tenantId}:${input.operation}:${input.target}:${input.version}:${input.batch}`;
    const existing = this.db
      .select()
      .from(cpOperationJobs)
      .where(eq(cpOperationJobs.idempotencyKey, idempotencyKey))
      .all()[0];
    if (existing) {
      return {
        id: existing.id,
        tenantId: existing.tenantId,
        operation: existing.operation,
        target: existing.target,
        version: existing.version,
        batch: existing.batch,
        idempotencyKey: existing.idempotencyKey,
        status: existing.status as JobStatus,
        danger: existing.danger,
      };
    }

    const currentCount = this.db.select().from(cpOperationJobs).all().length;
    const job: OperationJob = {
      id: `job-${currentCount + 1}`,
      idempotencyKey,
      status: 'PENDING',
      ...input,
    };
    this.db
      .insert(cpOperationJobs)
      .values({
        id: job.id,
        tenantId: job.tenantId,
        operation: job.operation,
        target: job.target,
        version: job.version,
        batch: job.batch,
        idempotencyKey: job.idempotencyKey,
        status: job.status,
        danger: job.danger,
        createdAt: new Date(),
      })
      .run();
    return job;
  }

  setStatus(id: string, status: JobStatus): void {
    this.db
      .update(cpOperationJobs)
      .set({ status })
      .where(eq(cpOperationJobs.id, id))
      .run();
  }
}
