import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
import { backups, backupSchedules } from '../storage/schema.js';
import { ServerConfigService } from '../server-process/server-config.service.js';
import type { BackupDto, BackupScheduleDto, BackupType, CreateBackupRequest, UpdateBackupScheduleRequest } from '@jian-agent/shared-domain';
import { randomUUID } from 'node:crypto';
import { eq, desc } from 'drizzle-orm';
import { resolve, join, basename } from 'node:path';
import { readdir, stat, mkdir, unlink, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import AdmZip from 'adm-zip';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly runningBackups = new Set<string>();

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly configService: ServerConfigService,
  ) {}

  async listBackups(serverId: string): Promise<readonly BackupDto[]> {
    const rows = await this.db
      .select()
      .from(backups)
      .where(eq(backups.serverId, serverId))
      .orderBy(desc(backups.createdAt));

    return rows.map((r) => ({
      id: r.id,
      serverId: r.serverId,
      serverName: r.serverName,
      type: r.type as BackupType,
      status: r.status as BackupDto['status'],
      fileName: r.fileName,
      sizeBytes: r.sizeBytes,
      includes: JSON.parse(r.includes) as string[],
      note: r.note,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    }));
  }

  async createBackup(serverId: string, request: CreateBackupRequest): Promise<BackupDto> {
    if (this.runningBackups.has(serverId)) {
      throw new BadRequestException('A backup is already running for this server');
    }

    const config = await this.configService.getById(serverId);
    if (!config) throw new NotFoundException('Server not found');

    const rootDir = config.workDir || config.serverDir || '';
    if (!rootDir) throw new BadRequestException('No server directory configured');

    const backupId = randomUUID();
    const now = new Date().toISOString();
    const fileName = `backup-${config.name}-${request.type}-${now.replace(/[:.]/g, '-')}.zip`;

    const record: BackupDto = {
      id: backupId,
      serverId,
      serverName: config.name,
      type: request.type,
      status: 'pending',
      fileName,
      sizeBytes: 0,
      includes: request.includes ?? [],
      note: request.note ?? '',
      createdAt: now,
      completedAt: '',
    };

    await this.db.insert(backups).values({
      id: record.id,
      serverId: record.serverId,
      serverName: record.serverName,
      type: record.type,
      status: record.status,
      fileName: record.fileName,
      sizeBytes: 0,
      includes: JSON.stringify(record.includes),
      note: record.note,
      createdAt: record.createdAt,
      completedAt: '',
    });

    // Run backup async
    this.runBackupAsync(backupId, serverId, rootDir, request.type, request.includes ?? []);

    return record;
  }

  async deleteBackup(serverId: string, backupId: string): Promise<void> {
    const rows = await this.db.select().from(backups).where(eq(backups.id, backupId));
    const record = rows[0];
    if (!record || record.serverId !== serverId) {
      throw new NotFoundException('Backup not found');
    }

    // Delete file from disk
    const backupDir = await this.getBackupDir(serverId);
    const filePath = resolve(backupDir, record.fileName);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }

    await this.db.delete(backups).where(eq(backups.id, backupId));
    this.logger.log(`Deleted backup ${backupId} for server ${serverId}`);
  }

  async getBackupFile(serverId: string, backupId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const rows = await this.db.select().from(backups).where(eq(backups.id, backupId));
    const record = rows[0];
    if (!record || record.serverId !== serverId) {
      throw new NotFoundException('Backup not found');
    }
    if (record.status !== 'completed') {
      throw new BadRequestException('Backup is not completed');
    }

    const backupDir = await this.getBackupDir(serverId);
    const filePath = resolve(backupDir, record.fileName);
    if (!existsSync(filePath)) {
      throw new NotFoundException('Backup file not found on disk');
    }

    const buffer = await readFile(filePath);
    return { buffer, fileName: record.fileName };
  }

  async getSchedule(serverId: string): Promise<BackupScheduleDto> {
    const rows = await this.db.select().from(backupSchedules).where(eq(backupSchedules.serverId, serverId));
    if (rows[0]) {
      return {
        serverId: rows[0].serverId,
        enabled: rows[0].enabled,
        cronExpression: rows[0].cronExpression,
        type: rows[0].type as BackupType,
        maxKeep: rows[0].maxKeep,
      };
    }
    // Return default schedule
    return {
      serverId,
      enabled: false,
      cronExpression: '0 3 * * *',
      type: 'full',
      maxKeep: 7,
    };
  }

  async updateSchedule(serverId: string, request: UpdateBackupScheduleRequest): Promise<BackupScheduleDto> {
    const config = await this.configService.getById(serverId);
    if (!config) throw new NotFoundException('Server not found');

    const existing = await this.db.select().from(backupSchedules).where(eq(backupSchedules.serverId, serverId));
    if (existing[0]) {
      await this.db.update(backupSchedules).set({
        enabled: request.enabled,
        cronExpression: request.cronExpression,
        type: request.type,
        maxKeep: request.maxKeep,
      }).where(eq(backupSchedules.serverId, serverId));
    } else {
      await this.db.insert(backupSchedules).values({
        serverId,
        enabled: request.enabled,
        cronExpression: request.cronExpression,
        type: request.type,
        maxKeep: request.maxKeep,
      });
    }

    this.rescheduleBackup(serverId);

    return {
      serverId,
      enabled: request.enabled,
      cronExpression: request.cronExpression,
      type: request.type as BackupType,
      maxKeep: request.maxKeep,
    };
  }

  // --- Private helpers ---

  private async getBackupDir(serverId: string): Promise<string> {
    const config = await this.configService.getById(serverId);
    const rootDir = config?.workDir || config?.serverDir || '';
    const backupDir = resolve(rootDir, 'backups');
    if (!existsSync(backupDir)) {
      await mkdir(backupDir, { recursive: true });
    }
    return backupDir;
  }

  private runBackupAsync(backupId: string, serverId: string, rootDir: string, type: BackupType, includes: readonly string[]): void {
    this.runningBackups.add(serverId);

    this.db.update(backups).set({ status: 'running' }).where(eq(backups.id, backupId)).then(() => {
      // noop
    });

    this.performBackup(backupId, serverId, rootDir, type, includes)
      .then(async (sizeBytes) => {
        await this.db.update(backups).set({
          status: 'completed',
          sizeBytes,
          completedAt: new Date().toISOString(),
        }).where(eq(backups.id, backupId));
        this.logger.log(`Backup ${backupId} completed (${(sizeBytes / 1048576).toFixed(1)} MB)`);
      })
      .catch(async (err) => {
        this.logger.error(`Backup ${backupId} failed: ${err}`);
        await this.db.update(backups).set({
          status: 'failed',
          completedAt: new Date().toISOString(),
        }).where(eq(backups.id, backupId));
      })
      .finally(() => {
        this.runningBackups.delete(serverId);
      });
  }

  private async performBackup(backupId: string, serverId: string, rootDir: string, type: BackupType, includes: readonly string[]): Promise<number> {
    const zip = new AdmZip();
    const resolvedRoot = resolve(rootDir);

    const dirsToBackup = this.getDirectoriesToBackup(resolvedRoot, type, includes);

    for (const dir of dirsToBackup) {
      if (existsSync(dir.fullPath)) {
        zip.addLocalFolder(dir.fullPath, dir.zipPath);
      }
    }

    // Also backup server.properties and other config files at root for 'full' and 'config' types
    if (type === 'full' || type === 'config') {
      const rootFiles = await this.listConfigFiles(resolvedRoot);
      for (const file of rootFiles) {
        const fullPath = resolve(resolvedRoot, file);
        const content = await readFile(fullPath);
        zip.addFile(file, content);
      }
    }

    const backupDir = await this.getBackupDir(serverId);
    const rows = await this.db.select().from(backups).where(eq(backups.id, backupId));
    const record = rows[0];
    if (!record) throw new Error('Backup record not found');

    const outputPath = resolve(backupDir, record.fileName);
    zip.writeZip(outputPath);

    const fileStat = await stat(outputPath);
    return fileStat.size;
  }

  private getDirectoriesToBackup(rootDir: string, type: BackupType, includes: readonly string[]): readonly { fullPath: string; zipPath: string }[] {
    switch (type) {
      case 'full':
        return [
          { fullPath: rootDir, zipPath: '' },
        ];
      case 'world': {
        // Backup world directories (world, world_nether, world_the_end, etc.)
        const worldDirs = ['world', 'world_nether', 'world_the_end'];
        if (includes.length > 0) {
          return includes.map((name) => ({
            fullPath: join(rootDir, name),
            zipPath: name,
          }));
        }
        return worldDirs.map((name) => ({
          fullPath: join(rootDir, name),
          zipPath: name,
        }));
      }
      case 'config':
        return []; // Config files handled separately in performBackup
      case 'plugins':
        return [
          { fullPath: join(rootDir, 'plugins'), zipPath: 'plugins' },
        ];
      default:
        return [];
    }
  }

  private async listConfigFiles(rootDir: string): Promise<readonly string[]> {
    const configExtensions = ['.yml', '.yaml', '.properties', '.json', '.toml', '.conf'];
    try {
      const entries = await readdir(rootDir, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile() && configExtensions.some((ext) => e.name.endsWith(ext)))
        .map((e) => e.name);
    } catch {
      return [];
    }
  }

  // --- Scheduled backup support ---

  private readonly scheduledTimers = new Map<string, NodeJS.Timeout>();

  private rescheduleBackup(serverId: string): void {
    // Clear existing timer
    const existing = this.scheduledTimers.get(serverId);
    if (existing) {
      clearInterval(existing);
      this.scheduledTimers.delete(serverId);
    }

    // Schedule new timer based on cron
    this.db.select().from(backupSchedules).where(eq(backupSchedules.serverId, serverId)).then((rows) => {
      const schedule = rows[0];
      if (!schedule || !schedule.enabled) return;

      const intervalMs = this.cronToIntervalMs(schedule.cronExpression);
      if (intervalMs <= 0) return;

      const timer = setInterval(() => {
        this.logger.log(`Running scheduled backup for server ${serverId}`);
        this.createBackup(serverId, { type: schedule.type as BackupType }).then(() => {
          this.cleanupOldBackups(serverId, schedule.maxKeep);
        }).catch((err) => {
          this.logger.error(`Scheduled backup failed for ${serverId}: ${err}`);
        });
      }, intervalMs);

      this.scheduledTimers.set(serverId, timer);
      this.logger.log(`Scheduled backup for server ${serverId} every ${intervalMs / 3600000}h`);
    });
  }

  private async cleanupOldBackups(serverId: string, maxKeep: number): Promise<void> {
    const allBackups = await this.db
      .select()
      .from(backups)
      .where(eq(backups.serverId, serverId))
      .orderBy(desc(backups.createdAt));

    const completed = allBackups.filter((b) => b.status === 'completed');
    if (completed.length <= maxKeep) return;

    const toDelete = completed.slice(maxKeep);
    for (const b of toDelete) {
      await this.deleteBackup(serverId, b.id);
    }
    this.logger.log(`Cleaned up ${toDelete.length} old backups for server ${serverId}`);
  }

  private cronToIntervalMs(cron: string): number {
    // Simple cron-to-interval: supports daily patterns like "0 3 * * *" → 24h
    // For simplicity, map common patterns to intervals
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return 86400000; // Default 24h

    const [, , dayOfMonth, , dayOfWeek] = parts;

    // If day-of-week is specific (not *), it's weekly
    if (dayOfWeek !== '*') return 7 * 86400000;
    // If day-of-month is specific (not *), it's monthly (~30 days)
    if (dayOfMonth !== '*') return 30 * 86400000;
    // Otherwise daily
    return 86400000;
  }
}
