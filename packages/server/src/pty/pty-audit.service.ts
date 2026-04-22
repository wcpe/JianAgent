import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
import { terminalAuditRecords } from '../storage/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { TerminalCommandEvent } from '../event-bus/events.js';

interface TerminalAuditEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly userId: string;
  readonly username: string;
  readonly serverId: string;
  readonly command: string;
  readonly allowed: boolean;
  readonly reason?: string;
}

@Injectable()
export class PtyAuditService {
  private readonly logger = new Logger(PtyAuditService.name);
  private readonly buffer: TerminalAuditEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, 5_000);
  }

  @OnEvent('terminal.command')
  async handleTerminalCommand(event: TerminalCommandEvent): Promise<void> {
    await this.recordCommand({
      userId: event.userId,
      username: event.username,
      serverId: event.serverId,
      command: event.command,
      allowed: !event.isDanger,
      reason: event.isDanger ? 'dangerous command detected' : undefined,
    });
  }

  async recordCommand(params: {
    readonly userId: string;
    readonly username: string;
    readonly serverId: string;
    readonly command: string;
    readonly allowed: boolean;
    readonly reason?: string;
  }): Promise<void> {
    const entry: TerminalAuditEntry = {
      id: nanoid(),
      timestamp: new Date().toISOString(),
      ...params,
    };
    this.buffer.push(entry);

    if (this.buffer.length >= 50) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = this.buffer.splice(0, this.buffer.length);
    try {
      for (const entry of entries) {
        this.db.insert(terminalAuditRecords).values({
          userId: entry.userId,
          username: entry.username,
          serverId: entry.serverId,
          command: entry.command,
          isDanger: !entry.allowed,
          result: entry.allowed ? 'sent' : 'blocked',
          reason: entry.reason ?? null,
        }).run();
      }
    } catch (err) {
      this.logger.warn(`Failed to flush terminal audit entries: ${err}`);
      this.buffer.unshift(...entries);
    }
  }

  async getAuditEntries(params: {
    readonly serverId?: string;
    readonly userId?: string;
    readonly limit?: number;
    readonly offset?: number;
  }): Promise<TerminalAuditEntry[]> {
    const conditions = [];
    if (params.serverId) {
      conditions.push(eq(terminalAuditRecords.serverId, params.serverId));
    }
    if (params.userId) {
      conditions.push(eq(terminalAuditRecords.userId, params.userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = this.db
      .select()
      .from(terminalAuditRecords)
      .where(whereClause)
      .orderBy(desc(terminalAuditRecords.createdAt))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0)
      .all();

    return rows.map((r) => ({
      id: String(r.id),
      timestamp: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      userId: r.userId,
      username: r.username,
      serverId: r.serverId,
      command: r.command,
      allowed: !r.isDanger,
      reason: r.reason ?? undefined,
    }));
  }

  onModuleDestroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
