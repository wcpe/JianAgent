import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { desc, eq } from 'drizzle-orm';
import type { FileTaskDto, FileTaskKind, TaskFailureClass } from '@jian-agent/shared-domain';
import { TaskState } from '@jian-agent/shared-domain';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import { fileTasks } from '../storage/schema.js';
import { FileTaskMapper } from './file-task.mapper.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class FileTaskService {
  private readonly logger = new Logger(FileTaskService.name);
  private static readonly DEFAULT_ATTEMPTS = 1;
  private static readonly DEFAULT_RETRYABLE_MAX_ATTEMPTS = 3;

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly mapper: FileTaskMapper,
    private readonly eventBus: EventEmitter2,
    private readonly auditService: AuditService,
  ) {}

  async createTask(input: {
    serverId: string;
    kind: FileTaskKind;
    sourcePaths: string[];
  }): Promise<FileTaskDto> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const retryable = this.isRetryableKind(input.kind);
    const maxAttempts = retryable
      ? FileTaskService.DEFAULT_RETRYABLE_MAX_ATTEMPTS
      : FileTaskService.DEFAULT_ATTEMPTS;

    this.db
      .insert(fileTasks)
      .values({
        id,
        serverId: input.serverId,
        kind: input.kind,
        state: TaskState.PENDING,
        attempt: FileTaskService.DEFAULT_ATTEMPTS,
        maxAttempts,
        retryable,
        resumeToken: null,
        failureClass: null,
        progress: 0,
        sourcePaths: JSON.stringify(input.sourcePaths),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const row = this.db.select().from(fileTasks).where(eq(fileTasks.id, id)).all()[0];
    this.logger.log(`File task created: ${id} kind=${input.kind} server=${input.serverId}`);

    this.eventBus.emit('file-task.created', {
      taskId: id,
      serverId: input.serverId,
      kind: input.kind,
      sourcePaths: input.sourcePaths,
      timestamp: Date.now(),
    });

    void this.auditService.record({
      userId: 'system',
      username: 'system',
      operation: `file-task.create.${input.kind}`,
      target: id,
      params: JSON.stringify({ serverId: input.serverId, sourcePaths: input.sourcePaths }).slice(0, 1000),
      success: true,
      ip: '',
    });

    return this.mapper.toDto(row);
  }

  async getTask(taskId: string): Promise<FileTaskDto | undefined> {
    const row = this.db.select().from(fileTasks).where(eq(fileTasks.id, taskId)).all()[0];
    return row ? this.mapper.toDto(row) : undefined;
  }

  async listTasks(serverId?: string): Promise<readonly FileTaskDto[]> {
    const rows = serverId
      ? this.db
          .select()
          .from(fileTasks)
          .where(eq(fileTasks.serverId, serverId))
          .orderBy(desc(fileTasks.createdAt))
          .all()
      : this.db.select().from(fileTasks).orderBy(desc(fileTasks.createdAt)).all();
    return rows.map((row) => this.mapper.toDto(row));
  }

  async markRunning(
    taskId: string,
    metadata?: {
      readonly attempt?: number;
      readonly maxAttempts?: number;
      readonly retryable?: boolean;
    },
  ): Promise<FileTaskDto> {
    const prev = this.db.select().from(fileTasks).where(eq(fileTasks.id, taskId)).all()[0];
    this.db
      .update(fileTasks)
      .set({
        state: TaskState.RUNNING,
        attempt: metadata?.attempt ?? prev?.attempt ?? FileTaskService.DEFAULT_ATTEMPTS,
        maxAttempts:
          metadata?.maxAttempts ??
          prev?.maxAttempts ??
          FileTaskService.DEFAULT_ATTEMPTS,
        retryable: metadata?.retryable ?? prev?.retryable ?? false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(fileTasks.id, taskId))
      .run();

    const row = this.db.select().from(fileTasks).where(eq(fileTasks.id, taskId)).all()[0];

    this.eventBus.emit('file-task.state-changed', {
      taskId,
      serverId: row.serverId,
      kind: row.kind,
      oldState: prev?.state ?? TaskState.PENDING,
      newState: TaskState.RUNNING,
      timestamp: Date.now(),
    });

    return this.mapper.toRunningDto(row);
  }

  async updateProgress(taskId: string, progress: number): Promise<void> {
    this.db
      .update(fileTasks)
      .set({
        progress: Math.round(Math.min(1, Math.max(0, progress)) * 100),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(fileTasks.id, taskId))
      .run();
  }

  async markRetryScheduled(
    taskId: string,
    metadata: {
      readonly attempt: number;
      readonly maxAttempts: number;
      readonly retryable: boolean;
      readonly resumeToken: string;
      readonly failureClass: TaskFailureClass;
      readonly errorDetail: string;
    },
  ): Promise<FileTaskDto> {
    const row = this.db.select().from(fileTasks).where(eq(fileTasks.id, taskId)).all()[0];
    if (!row) {
      throw new Error(`File task not found: ${taskId}`);
    }

    this.db
      .update(fileTasks)
      .set({
        state: TaskState.RUNNING,
        attempt: metadata.attempt,
        maxAttempts: metadata.maxAttempts,
        retryable: metadata.retryable,
        resumeToken: metadata.resumeToken,
        failureClass: metadata.failureClass,
        errorDetail: metadata.errorDetail,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(fileTasks.id, taskId))
      .run();

    const updated = this.db.select().from(fileTasks).where(eq(fileTasks.id, taskId)).all()[0];

    this.eventBus.emit('file-task.retry-scheduled', {
      taskId,
      serverId: updated.serverId,
      kind: updated.kind,
      attempt: metadata.attempt,
      maxAttempts: metadata.maxAttempts,
      retryable: metadata.retryable,
      resumeToken: metadata.resumeToken,
      failureClass: metadata.failureClass,
      errorDetail: metadata.errorDetail,
      timestamp: Date.now(),
    });

    return this.mapper.toRunningDto(updated);
  }

  async markCompleted(
    taskId: string,
    artifact: string,
    metadata?: {
      readonly attempt?: number;
      readonly maxAttempts?: number;
      readonly retryable?: boolean;
    },
  ): Promise<FileTaskDto> {
    const prev = this.db.select().from(fileTasks).where(eq(fileTasks.id, taskId)).all()[0];
    this.db
      .update(fileTasks)
      .set({
        state: TaskState.COMPLETED,
        attempt: metadata?.attempt ?? prev?.attempt ?? FileTaskService.DEFAULT_ATTEMPTS,
        maxAttempts:
          metadata?.maxAttempts ??
          prev?.maxAttempts ??
          FileTaskService.DEFAULT_ATTEMPTS,
        retryable: metadata?.retryable ?? prev?.retryable ?? false,
        resumeToken: null,
        failureClass: null,
        errorDetail: null,
        progress: 100,
        resultArtifact: artifact,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(fileTasks.id, taskId))
      .run();

    const row = this.db.select().from(fileTasks).where(eq(fileTasks.id, taskId)).all()[0];
    this.logger.log(`File task completed: ${taskId} artifact=${artifact}`);

    this.eventBus.emit('file-task.state-changed', {
      taskId,
      serverId: row.serverId,
      kind: row.kind,
      oldState: prev?.state ?? TaskState.RUNNING,
      newState: TaskState.COMPLETED,
      progress: 100,
      resultArtifact: artifact,
      timestamp: Date.now(),
    });

    return this.mapper.toCompletedDto(row, artifact);
  }

  async markFailed(
    taskId: string,
    error: string,
    errorDetail?: string,
    metadata?: {
      readonly attempt?: number;
      readonly maxAttempts?: number;
      readonly retryable?: boolean;
      readonly resumeToken?: string | null;
      readonly failureClass?: TaskFailureClass | null;
    },
  ): Promise<FileTaskDto> {
    const prev = this.db.select().from(fileTasks).where(eq(fileTasks.id, taskId)).all()[0];
    this.db
      .update(fileTasks)
      .set({
        state: TaskState.FAILED,
        attempt: metadata?.attempt ?? prev?.attempt ?? FileTaskService.DEFAULT_ATTEMPTS,
        maxAttempts:
          metadata?.maxAttempts ??
          prev?.maxAttempts ??
          FileTaskService.DEFAULT_ATTEMPTS,
        retryable: metadata?.retryable ?? prev?.retryable ?? false,
        resumeToken: metadata?.resumeToken ?? null,
        failureClass: metadata?.failureClass ?? null,
        errorDetail: errorDetail ?? error,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(fileTasks.id, taskId))
      .run();

    const row = this.db.select().from(fileTasks).where(eq(fileTasks.id, taskId)).all()[0];
    this.logger.warn(`File task failed: ${taskId} error=${error}`);

    this.eventBus.emit('file-task.state-changed', {
      taskId,
      serverId: row.serverId,
      kind: row.kind,
      oldState: prev?.state ?? TaskState.RUNNING,
      newState: TaskState.FAILED,
      error,
      errorDetail: errorDetail ?? error,
      timestamp: Date.now(),
    });

    void this.auditService.record({
      userId: 'system',
      username: 'system',
      operation: `file-task.fail.${row.kind}`,
      target: taskId,
      params: JSON.stringify({ error, errorDetail: errorDetail ?? error }).slice(0, 1000),
      success: false,
      ip: '',
    });

    return this.mapper.toFailedDto(row, error, errorDetail);
  }

  async markCancelled(taskId: string): Promise<FileTaskDto> {
    const prev = this.db.select().from(fileTasks).where(eq(fileTasks.id, taskId)).all()[0];
    this.db
      .update(fileTasks)
      .set({
        state: TaskState.CANCELLED,
        resumeToken: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(fileTasks.id, taskId))
      .run();

    const row = this.db.select().from(fileTasks).where(eq(fileTasks.id, taskId)).all()[0];
    this.logger.log(`File task cancelled: ${taskId}`);

    this.eventBus.emit('file-task.state-changed', {
      taskId,
      serverId: row.serverId,
      kind: row.kind,
      oldState: prev?.state ?? TaskState.PENDING,
      newState: TaskState.CANCELLED,
      timestamp: Date.now(),
    });

    void this.auditService.record({
      userId: 'system',
      username: 'system',
      operation: `file-task.cancel.${row.kind}`,
      target: taskId,
      params: JSON.stringify({ serverId: row.serverId }).slice(0, 1000),
      success: true,
      ip: '',
    });

    return this.mapper.toCancelledDto(row);
  }

  async cancelTask(taskId: string): Promise<FileTaskDto> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`File task not found: ${taskId}`);
    }
    if (
      task.state === TaskState.COMPLETED ||
      task.state === TaskState.FAILED ||
      task.state === TaskState.CANCELLED
    ) {
      return task;
    }
    return this.markCancelled(taskId);
  }

  async getArtifactBuffer(taskId: string): Promise<{ filename: string; data: Buffer } | null> {
    const task = await this.getTask(taskId);
    if (!task || task.state !== TaskState.COMPLETED || !task.resultArtifact) {
      return null;
    }
    try {
      const data = await readFile(task.resultArtifact);
      const filename = task.resultArtifact.split('/').pop() ?? `task-${taskId}.bin`;
      return { filename, data };
    } catch {
      // If artifact is not a readable file path, return null
      return null;
    }
  }

  private isRetryableKind(kind: FileTaskKind): boolean {
    return (
      kind === 'UPLOAD' ||
      kind === 'PACK_DOWNLOAD' ||
      kind === 'REMOTE_DOWNLOAD' ||
      kind === 'DIR_COPY' ||
      kind === 'DIR_MOVE'
    );
  }
}
