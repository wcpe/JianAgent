import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and, like, desc, gte, lte, sql } from 'drizzle-orm';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { legacyLogEntries as logEntries } from '../storage/schema.js';
import type { LogEntryDto, LogSearchRequest, LogSearchResult } from '@jian-agent/shared-domain';
import { randomUUID } from 'node:crypto';

@Injectable()
export class LogStoreService {
  private readonly logger = new Logger(LogStoreService.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async insert(entry: { timestamp: string; level: string; message: string; serverId?: string }): Promise<string> {
    const id = randomUUID();
    await this.db.insert(logEntries).values({
      id,
      timestamp: entry.timestamp,
      level: entry.level,
      source: '',
      module: '',
      message: entry.message,
      serverId: entry.serverId ?? null,
      metadata: null,
    });
    return id;
  }

  async query(queryDto: LogSearchRequest): Promise<LogSearchResult> {
    const page = queryDto.page ?? 1;
    const limit = Math.min(queryDto.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (queryDto.level) conditions.push(eq(logEntries.level, queryDto.level));
    if (queryDto.source) conditions.push(eq(logEntries.source, queryDto.source));
    if (queryDto.hosts?.length) conditions.push(eq(logEntries.serverId, queryDto.hosts[0]));
    if (queryDto.q) conditions.push(like(logEntries.message, `%${queryDto.q}%`));
    if (queryDto.startTime) conditions.push(gte(logEntries.timestamp, queryDto.startTime));
    if (queryDto.endTime) conditions.push(lte(logEntries.timestamp, queryDto.endTime));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(logEntries)
      .where(where)
      .orderBy(desc(logEntries.timestamp))
      .limit(limit)
      .offset(offset);

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(logEntries)
      .where(where);

    const total = countResult[0]?.count ?? 0;

    const entries: LogEntryDto[] = rows.map((r) => ({
      id: Number(r.id),
      hostId: r.serverId ?? '',
      hostName: '',
      hostType: '',
      sourceFile: '',
      timestamp: r.timestamp,
      level: r.level,
      content: r.message,
      rawLine: r.message,
    }));

    return { entries, total, page, limit, highlightMap: new Map() };
  }
}
