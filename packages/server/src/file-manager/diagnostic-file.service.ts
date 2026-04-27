import { Injectable } from '@nestjs/common';
import { eq, and, gte, lte, inArray, desc } from 'drizzle-orm';
import { DrizzleProvider } from '../storage/drizzle.provider.js';
import { diagnosticFiles } from '../storage/schema.js';
import { DiagnosticFile, StorageStats } from './entities/diagnostic-file.entity.js';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';

export interface RegisterFileDto {
  pid: number;
  processName: string;
  fileType: 'thread-dump' | 'heap-dump' | 'jfr' | 'cpu-sample';
  filePath: string;
  fileSize: number;
  description?: string;
}

export interface ListFilesQuery {
  pid?: number;
  fileType?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class DiagnosticFileService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async registerFile(dto: RegisterFileDto): Promise<DiagnosticFile> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    const [file] = await this.drizzle.db
      .insert(diagnosticFiles)
      .values({
        id,
        pid: dto.pid,
        processName: dto.processName,
        fileType: dto.fileType,
        filePath: dto.filePath,
        fileSize: dto.fileSize,
        createdAt,
        description: dto.description || '',
      })
      .returning();

    return file as DiagnosticFile;
  }

  async listFiles(query: ListFilesQuery = {}): Promise<DiagnosticFile[]> {
    const conditions = [];

    if (query.pid !== undefined) {
      conditions.push(eq(diagnosticFiles.pid, query.pid));
    }

    if (query.fileType) {
      conditions.push(eq(diagnosticFiles.fileType, query.fileType));
    }

    if (query.startDate) {
      conditions.push(gte(diagnosticFiles.createdAt, query.startDate));
    }

    if (query.endDate) {
      conditions.push(lte(diagnosticFiles.createdAt, query.endDate));
    }

    const files = await this.drizzle.db
      .select()
      .from(diagnosticFiles)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(diagnosticFiles.createdAt));

    return files as DiagnosticFile[];
  }

  async getFileById(id: string): Promise<DiagnosticFile | null> {
    const [file] = await this.drizzle.db
      .select()
      .from(diagnosticFiles)
      .where(eq(diagnosticFiles.id, id))
      .limit(1);

    return (file as DiagnosticFile) || null;
  }

  async deleteFile(id: string): Promise<void> {
    const file = await this.getFileById(id);
    if (!file) {
      throw new Error(`File not found: ${id}`);
    }

    // 删除文件系统中的文件
    try {
      await fs.unlink(file.filePath);
    } catch (error) {
      // 文件可能已经不存在，继续删除数据库记录
      console.warn(`Failed to delete file: ${file.filePath}`, error);
    }

    // 删除数据库记录
    await this.drizzle.db.delete(diagnosticFiles).where(eq(diagnosticFiles.id, id));
  }

  async deleteFiles(ids: string[]): Promise<void> {
    const files = await this.drizzle.db
      .select()
      .from(diagnosticFiles)
      .where(inArray(diagnosticFiles.id, ids));

    // 删除文件系统中的文件
    await Promise.allSettled(
      files.map(async (file) => {
        try {
          await fs.unlink(file.filePath);
        } catch (error) {
          console.warn(`Failed to delete file: ${file.filePath}`, error);
        }
      }),
    );

    // 删除数据库记录
    await this.drizzle.db.delete(diagnosticFiles).where(inArray(diagnosticFiles.id, ids));
  }

  async getStorageStats(): Promise<StorageStats> {
    const files = await this.drizzle.db.select().from(diagnosticFiles);

    const stats: StorageStats = {
      totalSize: 0,
      totalFiles: files.length,
      byType: {},
    };

    for (const file of files) {
      stats.totalSize += file.fileSize;

      if (!stats.byType[file.fileType]) {
        stats.byType[file.fileType] = { count: 0, size: 0 };
      }

      stats.byType[file.fileType].count++;
      stats.byType[file.fileType].size += file.fileSize;
    }

    return stats;
  }

  async cleanup(olderThanDays: number, fileTypes?: string[]): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffDateStr = cutoffDate.toISOString();

    const conditions = [lte(diagnosticFiles.createdAt, cutoffDateStr)];

    if (fileTypes && fileTypes.length > 0) {
      conditions.push(inArray(diagnosticFiles.fileType, fileTypes));
    }

    const filesToDelete = await this.drizzle.db
      .select()
      .from(diagnosticFiles)
      .where(and(...conditions));

    if (filesToDelete.length === 0) {
      return 0;
    }

    // 删除文件系统中的文件
    await Promise.allSettled(
      filesToDelete.map(async (file) => {
        try {
          await fs.unlink(file.filePath);
        } catch (error) {
          console.warn(`Failed to delete file: ${file.filePath}`, error);
        }
      }),
    );

    // 删除数据库记录
    await this.drizzle.db
      .delete(diagnosticFiles)
      .where(
        inArray(
          diagnosticFiles.id,
          filesToDelete.map((f) => f.id),
        ),
      );

    return filesToDelete.length;
  }
}
