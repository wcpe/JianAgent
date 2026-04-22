import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../../storage/drizzle.provider.js';
import { processMetrics } from '../../storage/schema.js';
import { eq, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { ProcessMetrics } from '@jian-agent/shared-domain';

@Injectable()
export class ProcessMetricsStore {
  private readonly logger = new Logger(ProcessMetricsStore.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async save(metrics: ProcessMetrics): Promise<void> {
    await this.db.insert(processMetrics).values({
      id: randomUUID(),
      serverId: metrics.serverId,
      timestamp: metrics.timestamp,
      cpuPercent: metrics.cpuPercent,
      rssBytes: metrics.rssBytes,
      heapUsed: metrics.heapUsed ?? null,
      heapMax: metrics.heapMax ?? null,
      threadCount: metrics.threadCount ?? null,
      fdCount: metrics.fdCount ?? null,
    });
  }

  async query(serverId: string, since: string): Promise<ProcessMetrics[]> {
    const rows = await this.db
      .select()
      .from(processMetrics)
      .where(eq(processMetrics.serverId, serverId))
      .all();

    return rows
      .filter((r) => r.timestamp >= since)
      .map((r) => ({
        serverId: r.serverId,
        timestamp: r.timestamp,
        cpuPercent: r.cpuPercent,
        rssBytes: r.rssBytes,
        heapUsed: r.heapUsed ?? undefined,
        heapMax: r.heapMax ?? undefined,
        threadCount: r.threadCount ?? undefined,
        fdCount: r.fdCount ?? undefined,
      }));
  }

  async cleanup(olderThan: string): Promise<number> {
    const result = await this.db
      .delete(processMetrics)
      .where(lt(processMetrics.timestamp, olderThan));
    return (result as any).changes ?? 0;
  }
}