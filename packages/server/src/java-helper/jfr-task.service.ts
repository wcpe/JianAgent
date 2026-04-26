import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { desc, eq, lt } from 'drizzle-orm';
import type { JfrTaskDto } from '@jian-agent/shared-domain';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import { jfrTasks } from '../storage/schema.js';

const execFileAsync = promisify(execFile);

@Injectable()
export class JfrTaskService {
  private readonly logger = new Logger(JfrTaskService.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  private mapRow(row: typeof jfrTasks.$inferSelect): JfrTaskDto {
    return {
      id: row.id,
      serverId: row.serverId,
      pid: row.pid,
      recordingName: row.recordingName,
      status: row.status as JfrTaskDto['status'],
      filePath: row.filePath,
      startedAt: row.startedAt,
      endedAt: row.endedAt ?? undefined,
      error: row.error ?? undefined,
    };
  }

  protected async runJcmd(pid: string, args: readonly string[]): Promise<void> {
    await execFileAsync('jcmd', [pid, ...args]);
  }

  async startTask(input: {
    serverId: string;
    pid: string;
    durationSec?: number;
    settings?: 'default' | 'profile';
  }): Promise<JfrTaskDto> {
    const id = randomUUID();
    const recordingName = `jfr-${id}`;
    const startedAt = new Date().toISOString();
    const filePath = resolve(process.cwd(), 'data', 'jfr', `${id}.jfr`);
    const durationSec = input.durationSec ?? 60;
    const settings = input.settings ?? 'profile';

    await mkdir(dirname(filePath), { recursive: true });

    try {
      await this.runJcmd(input.pid, [
        'JFR.start',
        `name=${recordingName}`,
        `settings=${settings}`,
        `filename=${filePath}`,
        `duration=${durationSec}s`,
      ]);

      this.db.insert(jfrTasks).values({
        id,
        serverId: input.serverId,
        pid: input.pid,
        recordingName,
        status: 'running',
        filePath,
        startedAt,
      }).run();

      const row = this.db.select().from(jfrTasks).where(eq(jfrTasks.id, id)).all()[0];
      return this.mapRow(row);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.db.insert(jfrTasks).values({
        id,
        serverId: input.serverId,
        pid: input.pid,
        recordingName,
        status: 'failed',
        filePath,
        startedAt,
        endedAt: new Date().toISOString(),
        error: message,
      }).run();
      const row = this.db.select().from(jfrTasks).where(eq(jfrTasks.id, id)).all()[0];
      return this.mapRow(row);
    }
  }

  async stopTask(taskId: string): Promise<JfrTaskDto> {
    const row = this.db.select().from(jfrTasks).where(eq(jfrTasks.id, taskId)).all()[0];
    if (!row) {
      throw new Error(`JFR task not found: ${taskId}`);
    }

    if (row.status !== 'running') {
      return this.mapRow(row);
    }

    try {
      await this.runJcmd(row.pid, ['JFR.dump', `name=${row.recordingName}`, `filename=${row.filePath}`]);
      await this.runJcmd(row.pid, ['JFR.stop', `name=${row.recordingName}`]);
      this.db.update(jfrTasks)
        .set({ status: 'completed', endedAt: new Date().toISOString() })
        .where(eq(jfrTasks.id, taskId))
        .run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.db.update(jfrTasks)
        .set({ status: 'failed', endedAt: new Date().toISOString(), error: message })
        .where(eq(jfrTasks.id, taskId))
        .run();
    }

    const updated = this.db.select().from(jfrTasks).where(eq(jfrTasks.id, taskId)).all()[0];
    return this.mapRow(updated);
  }

  async getTask(taskId: string): Promise<JfrTaskDto | undefined> {
    const row = this.db.select().from(jfrTasks).where(eq(jfrTasks.id, taskId)).all()[0];
    return row ? this.mapRow(row) : undefined;
  }

  async listTasks(serverId?: string): Promise<readonly JfrTaskDto[]> {
    const rows = serverId
      ? this.db.select().from(jfrTasks).where(eq(jfrTasks.serverId, serverId)).orderBy(desc(jfrTasks.startedAt)).all()
      : this.db.select().from(jfrTasks).orderBy(desc(jfrTasks.startedAt)).all();
    return rows.map((row) => this.mapRow(row));
  }

  async getDownloadPayload(taskId: string): Promise<{ fileName: string; contentBase64: string }> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`JFR task not found: ${taskId}`);
    }
    if (task.status !== 'completed') {
      throw new Error(`JFR task is not completed: ${taskId}`);
    }

    const bytes = await readFile(task.filePath);
    return {
      fileName: `${task.id}.jfr`,
      contentBase64: bytes.toString('base64'),
    };
  }

  async getDownloadStreamMeta(
    taskId: string,
    maxBytes = 200 * 1024 * 1024,
  ): Promise<{ fileName: string; filePath: string; sizeBytes: number }> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`JFR task not found: ${taskId}`);
    }
    if (task.status !== 'completed') {
      throw new Error(`JFR task is not completed: ${taskId}`);
    }

    const fileStat = await stat(task.filePath);
    if (fileStat.size > maxBytes) {
      throw new Error(`JFR file exceeds download size limit: ${fileStat.size}`);
    }

    return {
      fileName: `${task.id}.jfr`,
      filePath: task.filePath,
      sizeBytes: fileStat.size,
    };
  }

  async cleanupOldTasks(retentionDays: number): Promise<{ deletedTasks: number; deletedFiles: number }> {
    const cutoffIso = new Date(Date.now() - retentionDays * 86400_000).toISOString();
    const rows = this.db
      .select()
      .from(jfrTasks)
      .where(lt(jfrTasks.startedAt, cutoffIso))
      .all();

    let deletedFiles = 0;
    for (const row of rows) {
      try {
        await rm(row.filePath, { force: true });
        deletedFiles += 1;
      } catch (err) {
        this.logger.debug(`Best-effort JFR file cleanup failed for ${row.filePath}`, err);
      }
    }

    const result = this.db
      .delete(jfrTasks)
      .where(lt(jfrTasks.startedAt, cutoffIso))
      .run();

    return { deletedTasks: result.changes, deletedFiles };
  }
}
