import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
} from '../storage/drizzle.provider.js';
import {
  logEntries,
  logCollectionConfigs,
  logAlertRules,
} from '../storage/schema.js';
import type { ParsedLogLine } from './log-parser.service.js';

export interface LogIngestMeta {
  hostId: string;
  hostName: string;
  hostType: 'local' | 'remote';
  sourceFile: string;
  lineNumber?: number;
}

@Injectable()
export class LogIngestService {
  private readonly logger = new Logger(LogIngestService.name);

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Write a batch of parsed log entries into SQLite.
   * FTS5 is kept in sync by database triggers (log_entries_ai / log_entries_ad).
   * After writing, alert rules are checked for each entry.
   */
  async writeEntries(
    lines: ParsedLogLine[],
    meta: LogIngestMeta,
  ): Promise<number> {
    if (lines.length === 0) return 0;

    try {
      const rows = lines.map((line, i) => ({
        hostId: meta.hostId,
        hostName: meta.hostName,
        hostType: meta.hostType,
        sourceFile: meta.sourceFile,
        lineNumber: (meta.lineNumber ?? 0) + i,
        timestamp: line.timestamp,
        level: line.level,
        content: line.content,
        rawLine: line.content,
      }));

      this.db.insert(logEntries).values(rows).run();

      // Check alert rules for the last few entries (batched)
      const lastEntries = rows.slice(-10);
      for (const entry of lastEntries) {
        await this.checkAlertRules(entry);
      }

      // Emit event for real-time push
      this.eventEmitter.emit('log.entries.ingested', {
        hostId: meta.hostId,
        sourceFile: meta.sourceFile,
        count: lines.length,
      });

      return lines.length;
    } catch (err) {
      this.logger.error(`Failed to write log entries: ${err}`);
      return 0;
    }
  }

  /**
   * Update the collection config's offset after a successful read.
   */
  async updateOffset(
    configId: string,
    lastOffset: number,
    lastLineHash?: string,
  ): Promise<void> {
    this.db
      .update(logCollectionConfigs)
      .set({
        lastOffset,
        lastLineHash: lastLineHash ?? '',
        lastCollectedAt: new Date().toISOString(),
      })
      .where(eq(logCollectionConfigs.id, configId))
      .run();
  }

  /**
   * Check whether any enabled alert rule matches the entry.
   */
  private async checkAlertRules(entry: {
    hostId: string;
    level: string;
    content: string;
  }): Promise<void> {
    try {
      const rules = this.db
        .select()
        .from(logAlertRules)
        .where(eq(logAlertRules.enabled, true))
        .all();

      const now = Date.now();

      for (const rule of rules) {
        // Filter by host if specified
        if (rule.hostId && rule.hostId !== entry.hostId) continue;

        // Level threshold check
        if (!this.levelMeetsThreshold(entry.level, rule.level)) continue;

        // Pattern match
        try {
          const regex = new RegExp(rule.pattern, 'i');
          if (!regex.test(entry.content)) continue;
        } catch (_err) {
          // Invalid regex — skip
          continue;
        }

        // Cooldown check
        if (rule.lastTriggeredAt) {
          const lastTriggered = new Date(rule.lastTriggeredAt).getTime();
          if (now - lastTriggered < rule.cooldownSec * 1000) continue;
        }

        // Update last triggered
        this.db
          .update(logAlertRules)
          .set({ lastTriggeredAt: new Date(now).toISOString() })
          .where(eq(logAlertRules.id, rule.id))
          .run();

        // Emit alert event
        this.eventEmitter.emit('log.alert.triggered', {
          ruleId: rule.id,
          ruleName: rule.name,
          hostId: entry.hostId,
          level: entry.level,
          content: entry.content,
        });

        this.logger.warn(
          `Alert triggered: ${rule.name} — ${entry.content.slice(0, 200)}`,
        );
      }
    } catch (err) {
      this.logger.error(`Alert check failed: ${err}`);
    }
  }

  /** Check if log level meets the minimum alert threshold */
  private levelMeetsThreshold(logLevel: string, threshold: string): boolean {
    const order = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    return order.indexOf(logLevel) >= order.indexOf(threshold);
  }
}
