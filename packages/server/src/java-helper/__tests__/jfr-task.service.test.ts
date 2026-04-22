import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../storage/schema.js';
import { JfrTaskService } from '../jfr-task.service.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

class TestJfrTaskService extends JfrTaskService {
  constructor(db: any, private readonly runner: (pid: string, args: readonly string[]) => Promise<void>) {
    super(db);
  }

  protected override async runJcmd(pid: string, args: readonly string[]): Promise<void> {
    await this.runner(pid, args);
  }
}

describe('JfrTaskService', () => {
  let sqlite: Database.Database;
  let service: TestJfrTaskService;
  const runner = vi.fn(async () => {});

  beforeEach(() => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    sqlite.exec(`
      CREATE TABLE jfr_tasks (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        pid TEXT NOT NULL,
        recording_name TEXT NOT NULL,
        status TEXT NOT NULL,
        file_path TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        error TEXT
      );
    `);
    service = new TestJfrTaskService(db, runner);
    runner.mockClear();
  });

  it('starts and stops jfr task', async () => {
    const started = await service.startTask({ serverId: 'srv-1', pid: '1000', durationSec: 30 });
    expect(started.serverId).toBe('srv-1');
    expect(started.status).toBe('running');

    const stopped = await service.stopTask(started.id);
    expect(stopped.status).toBe('completed');
    expect(runner).toHaveBeenCalled();
  });

  it('cleans up old tasks and files', async () => {
    const started = await service.startTask({ serverId: 'srv-1', pid: '1000', durationSec: 30 });
    const stopped = await service.stopTask(started.id);
    await mkdir(dirname(stopped.filePath), { recursive: true });
    await writeFile(stopped.filePath, 'dummy-jfr');

    // Push the task to old timestamp so retention removes it
    sqlite.prepare("UPDATE jfr_tasks SET started_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(stopped.id);

    const result = await service.cleanupOldTasks(1);
    expect(result.deletedTasks).toBeGreaterThan(0);
  });

  it('returns stream metadata for completed task with size limit', async () => {
    const started = await service.startTask({ serverId: 'srv-1', pid: '1000', durationSec: 30 });
    const stopped = await service.stopTask(started.id);
    await mkdir(dirname(stopped.filePath), { recursive: true });
    await writeFile(stopped.filePath, 'dummy-jfr');

    const meta = await service.getDownloadStreamMeta(stopped.id, 1024);
    expect(meta.filePath).toBe(stopped.filePath);
    expect(meta.sizeBytes).toBeGreaterThan(0);
  });
});
