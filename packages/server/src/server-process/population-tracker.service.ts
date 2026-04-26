import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { desc, eq, and, gte, lte } from 'drizzle-orm';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import { playerPopulations } from '../storage/schema.js';
import { MultiServerService } from '../server-process/multi-server.service.js';

export interface PopulationRecord {
  readonly id: number;
  readonly serverId: string;
  readonly serverName: string;
  readonly timestamp: string;
  readonly onlinePlayers: number;
  readonly maxPlayers: number;
}

@Injectable()
export class PopulationTrackerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PopulationTrackerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private static readonly RECORD_INTERVAL = 60_000; // 1 minute

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly multiServer: MultiServerService,
  ) {}

  onModuleInit(): void {
    // Record immediately then every minute
    void this.recordSnapshot();
    this.timer = setInterval(() => void this.recordSnapshot(), PopulationTrackerService.RECORD_INTERVAL);
    this.logger.log('Population tracker started (1-minute interval)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async recordSnapshot(): Promise<void> {
    try {
      const servers = await this.multiServer.listServers();
      const now = new Date().toISOString();

      for (const server of servers) {
        if (server.runtimeStatus !== 'running') continue;
        const onlinePlayers = server.onlinePlayers ?? 0;
        const maxPlayers = server.maxPlayers ?? 0;

        this.db.insert(playerPopulations).values({
          serverId: server.id,
          serverName: server.name,
          timestamp: now,
          onlinePlayers,
          maxPlayers,
        }).run();
      }
    } catch (err) {
      this.logger.error('Failed to record population snapshot', (err as Error).message);
    }
  }

  getHistory(params: {
    readonly serverId?: string;
    readonly startTime?: string;
    readonly endTime?: string;
    readonly limit?: number;
  }): readonly PopulationRecord[] {
    const conditions = [];

    if (params.serverId) {
      conditions.push(eq(playerPopulations.serverId, params.serverId));
    }
    if (params.startTime) {
      conditions.push(gte(playerPopulations.timestamp, params.startTime));
    }
    if (params.endTime) {
      conditions.push(lte(playerPopulations.timestamp, params.endTime));
    }

    return this.db
      .select()
      .from(playerPopulations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(playerPopulations.timestamp))
      .limit(params.limit ?? 1440)
      .all();
  }

  cleanup(retentionDays: number): number {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    const result = this.db.delete(playerPopulations)
      .where(lte(playerPopulations.timestamp, cutoff))
      .run();
    return result.changes;
  }
}
