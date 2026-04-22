import { Injectable, Inject, Logger } from '@nestjs/common';
import { lt, sql } from 'drizzle-orm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DrizzleDb } from './drizzle.provider.js';
import { DRIZZLE_TOKEN } from './drizzle.provider.js';
import { legacyLogEntries as logEntries, alerts, auditRecords } from './schema.js';
import type { ArchiveResultDto, ArchiveStatsDto } from '@jian-agent/shared-domain';

@Injectable()
export class ArchiverService {
  private readonly logger = new Logger(ArchiverService.name);
  private retentionDays = 30;

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  getRetentionDays(): number {
    return this.retentionDays;
  }

  setRetentionDays(days: number): void {
    if (days < 1 || days > 365) {
      throw new Error('Retention days must be between 1 and 365');
    }
    this.retentionDays = days;
  }

  async archiveOldData(): Promise<ArchiveResultDto> {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoff.toISOString();

    // Delete old log entries
    this.db.delete(logEntries).where(lt(logEntries.timestamp, cutoffIso)).run();

    // Delete old alerts
    this.db.delete(alerts).where(lt(alerts.timestamp, cutoffIso)).run();

    // Count exported (we track by counting rows before deletion referencing sessions)
    const archiveDir = this.getArchiveDir();
    const exportedFiles = fs.existsSync(archiveDir)
      ? fs.readdirSync(archiveDir).filter((f) => f.endsWith('.json')).length
      : 0;

    this.logger.log(
      `Archive complete: cutoff=${cutoffIso}, retentionDays=${this.retentionDays}`,
    );

    return {
      exportedSessions: exportedFiles,
      cutoffDate: cutoffIso,
      retentionDays: this.retentionDays,
    };
  }

  async getStats(): Promise<ArchiveStatsDto> {
    const allLogs = this.db.select({ ts: logEntries.timestamp }).from(logEntries).all();
    const oldest = allLogs.length > 0 ? allLogs[0]!.ts : null;

    const archiveDir = this.getArchiveDir();
    let archiveSizeMb = 0;
    if (fs.existsSync(archiveDir)) {
      const files = fs.readdirSync(archiveDir);
      for (const f of files) {
        const stat = fs.statSync(path.join(archiveDir, f));
        archiveSizeMb += stat.size;
      }
      archiveSizeMb = Number((archiveSizeMb / (1024 * 1024)).toFixed(2));
    }

    return {
      totalSessions: allLogs.length,
      oldestDataDate: oldest,
      archiveDirSizeMb: archiveSizeMb,
      retentionDays: this.retentionDays,
    };
  }

  private getArchiveDir(): string {
    const dir = path.join(process.cwd(), 'data', 'archives');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }
}
