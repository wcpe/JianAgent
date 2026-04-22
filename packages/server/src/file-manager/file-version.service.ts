import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import { fileVersions } from '../storage/schema.js';
import { eq, and, desc, asc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export interface FileVersionSummary {
  readonly id: string;
  readonly serverId: string;
  readonly filePath: string;
  readonly userId: string;
  readonly source: string;
  readonly createdAt: number;
}

export interface FileVersionDetail extends FileVersionSummary {
  readonly content: string;
}

const MAX_VERSIONS_PER_FILE = 50;

@Injectable()
export class FileVersionService {
  private readonly logger = new Logger(FileVersionService.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async createVersion(
    serverId: string,
    filePath: string,
    content: string,
    userId: string,
    source: 'manual' | 'auto' = 'manual',
  ): Promise<string> {
    const id = randomUUID();
    const createdAt = Date.now();
    this.db
      .insert(fileVersions)
      .values({ id, serverId, filePath, content, userId, source, createdAt })
      .run();

    this.pruneOldVersions(serverId, filePath);

    return id;
  }

  listVersions(serverId: string, filePath: string): readonly FileVersionSummary[] {
    return this.db
      .select({
        id: fileVersions.id,
        serverId: fileVersions.serverId,
        filePath: fileVersions.filePath,
        userId: fileVersions.userId,
        source: fileVersions.source,
        createdAt: fileVersions.createdAt,
      })
      .from(fileVersions)
      .where(and(eq(fileVersions.serverId, serverId), eq(fileVersions.filePath, filePath)))
      .orderBy(desc(fileVersions.createdAt))
      .all();
  }

  getVersion(versionId: string): FileVersionDetail | undefined {
    return this.db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.id, versionId))
      .get() as FileVersionDetail | undefined;
  }

  private pruneOldVersions(serverId: string, filePath: string): void {
    const all = this.db
      .select({ id: fileVersions.id, source: fileVersions.source })
      .from(fileVersions)
      .where(and(eq(fileVersions.serverId, serverId), eq(fileVersions.filePath, filePath)))
      .orderBy(asc(fileVersions.createdAt))
      .all();

    if (all.length <= MAX_VERSIONS_PER_FILE) return;

    const excess = all.length - MAX_VERSIONS_PER_FILE;
    // Prefer deleting auto versions first
    const autoVersions = all.filter((v) => v.source === 'auto');
    const toDelete = autoVersions.slice(0, excess);

    if (toDelete.length < excess) {
      const remaining = excess - toDelete.length;
      const manualVersions = all.filter((v) => v.source === 'manual');
      toDelete.push(...manualVersions.slice(0, remaining));
    }

    for (const v of toDelete) {
      this.db.delete(fileVersions).where(eq(fileVersions.id, v.id)).run();
    }
  }
}
