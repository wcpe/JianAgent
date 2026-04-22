import { Injectable, Inject, Logger } from '@nestjs/common';
import { desc, eq, and, gte, lte, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { DrizzleDb } from './drizzle.provider.js';
import { DRIZZLE_TOKEN } from './drizzle.provider.js';
import { metricSnapshots, worldMetricSnapshots, jmxMetricSnapshots } from './schema.js';
import type { MetricSnapshotDto, WorldMetricSnapshotDto, JmxMetricSnapshotDto } from '@jian-agent/shared-domain';

export interface WorldMetricRow {
  readonly worldName: string;
  readonly environment: string;
  readonly entityCount: number | null;
  readonly loadedChunks: number | null;
  readonly entityTypes: string | null;
}

function rowToDto(row: typeof metricSnapshots.$inferSelect): MetricSnapshotDto {
  return {
    id: row.id,
    timestamp: row.timestamp,
    serverId: row.serverId,
    tps: row.tps,
    mspt: row.mspt,
    onlinePlayers: row.onlinePlayers,
    onlineBots: row.onlineBots,
    cpuUsage: row.cpuUsage,
    memoryUsageMb: row.memoryUsageMb,
    maxMemoryMb: row.maxMemoryMb,
    entityCount: row.entityCount,
    loadedChunks: row.loadedChunks,
    worldCount: row.worldCount,
    maxPlayers: row.maxPlayers,
    pluginCount: row.pluginCount,
    playerDetails: row.playerDetails ? JSON.parse(row.playerDetails) : null,
    pluginDetails: row.pluginDetails ? JSON.parse(row.pluginDetails) : null,
  };
}

function jmxRowToDto(row: typeof jmxMetricSnapshots.$inferSelect): JmxMetricSnapshotDto {
  return {
    id: row.id,
    timestamp: row.timestamp,
    serverId: row.serverId,
    pid: row.pid,
    heapUsedMb: row.heapUsedMb,
    heapCommittedMb: row.heapCommittedMb,
    heapMaxMb: row.heapMaxMb,
    threadCount: row.threadCount,
    daemonThreadCount: row.daemonThreadCount,
    gcYoungCount: row.gcYoungCount,
    gcFullCount: row.gcFullCount,
    gcYoungTimeMs: row.gcYoungTimeMs,
    gcFullTimeMs: row.gcFullTimeMs,
  };
}

@Injectable()
export class MetricStoreService {
  private readonly logger = new Logger(MetricStoreService.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async insert(data: Omit<MetricSnapshotDto, 'id'>): Promise<string> {
    const id = randomUUID();
    await this.db.insert(metricSnapshots).values({
      id,
      timestamp: data.timestamp,
      serverId: data.serverId,
      tps: data.tps,
      mspt: data.mspt,
      onlinePlayers: data.onlinePlayers,
      onlineBots: data.onlineBots,
      cpuUsage: data.cpuUsage,
      memoryUsageMb: data.memoryUsageMb,
      maxMemoryMb: data.maxMemoryMb,
      entityCount: data.entityCount,
      loadedChunks: data.loadedChunks,
      worldCount: data.worldCount,
      maxPlayers: data.maxPlayers,
      pluginCount: data.pluginCount,
      playerDetails: data.playerDetails ? JSON.stringify(data.playerDetails) : null,
      pluginDetails: data.pluginDetails ? JSON.stringify(data.pluginDetails) : null,
    });
    this.logger.debug(`Metric snapshot stored: server=${data.serverId} tps=${data.tps}`);
    return id;
  }

  async insertWorldMetrics(
    metricSnapshotId: string,
    serverId: string,
    timestamp: string,
    worlds: readonly WorldMetricRow[],
  ): Promise<void> {
    for (const w of worlds) {
      await this.db.insert(worldMetricSnapshots).values({
        id: randomUUID(),
        metricSnapshotId,
        serverId,
        timestamp,
        worldName: w.worldName,
        environment: w.environment,
        entityCount: w.entityCount,
        loadedChunks: w.loadedChunks,
        entityTypes: w.entityTypes,
      });
    }
  }

  async queryRange(
    serverId: string,
    startTime: string,
    endTime: string,
    limit = 60,
  ): Promise<readonly MetricSnapshotDto[]> {
    const rows = await this.db
      .select()
      .from(metricSnapshots)
      .where(
        and(
          eq(metricSnapshots.serverId, serverId),
          gte(metricSnapshots.timestamp, startTime),
          lte(metricSnapshots.timestamp, endTime),
        ),
      )
      .orderBy(desc(metricSnapshots.timestamp))
      .limit(limit);

    return rows.reverse().map(rowToDto);
  }

  async getLatest(serverId: string): Promise<MetricSnapshotDto | undefined> {
    const rows = await this.db
      .select()
      .from(metricSnapshots)
      .where(eq(metricSnapshots.serverId, serverId))
      .orderBy(desc(metricSnapshots.timestamp))
      .limit(1);

    const row = rows[0];
    if (!row) return undefined;
    return rowToDto(row);
  }

  async queryWorldMetrics(
    serverId: string,
    startTime: string,
    endTime: string,
    limit = 60,
  ): Promise<readonly WorldMetricSnapshotDto[]> {
    const rows = await this.db
      .select()
      .from(worldMetricSnapshots)
      .where(
        and(
          eq(worldMetricSnapshots.serverId, serverId),
          gte(worldMetricSnapshots.timestamp, startTime),
          lte(worldMetricSnapshots.timestamp, endTime),
        ),
      )
      .orderBy(desc(worldMetricSnapshots.timestamp))
      .limit(limit);

    return rows.reverse().map((row) => ({
      id: row.id,
      metricSnapshotId: row.metricSnapshotId,
      serverId: row.serverId,
      timestamp: row.timestamp,
      worldName: row.worldName,
      environment: row.environment,
      entityCount: row.entityCount,
      loadedChunks: row.loadedChunks,
      entityTypes: row.entityTypes ? JSON.parse(row.entityTypes) : null,
    }));
  }

  async deleteOlderThan(cutoff: string): Promise<number> {
    const result = this.db
      .delete(metricSnapshots)
      .where(lt(metricSnapshots.timestamp, cutoff))
      .run();
    this.db
      .delete(worldMetricSnapshots)
      .where(lt(worldMetricSnapshots.timestamp, cutoff))
      .run();
    this.db
      .delete(jmxMetricSnapshots)
      .where(lt(jmxMetricSnapshots.timestamp, cutoff))
      .run();
    return result.changes;
  }

  async insertJmx(data: Omit<JmxMetricSnapshotDto, 'id'>): Promise<string> {
    const id = randomUUID();
    await this.db.insert(jmxMetricSnapshots).values({
      id,
      timestamp: data.timestamp,
      serverId: data.serverId,
      pid: data.pid,
      heapUsedMb: data.heapUsedMb,
      heapCommittedMb: data.heapCommittedMb,
      heapMaxMb: data.heapMaxMb,
      threadCount: data.threadCount,
      daemonThreadCount: data.daemonThreadCount,
      gcYoungCount: data.gcYoungCount,
      gcFullCount: data.gcFullCount,
      gcYoungTimeMs: data.gcYoungTimeMs,
      gcFullTimeMs: data.gcFullTimeMs,
    });
    return id;
  }

  async getLatestJmx(serverId: string): Promise<JmxMetricSnapshotDto | undefined> {
    const rows = await this.db
      .select()
      .from(jmxMetricSnapshots)
      .where(eq(jmxMetricSnapshots.serverId, serverId))
      .orderBy(desc(jmxMetricSnapshots.timestamp))
      .limit(1);
    return rows[0] ? jmxRowToDto(rows[0]) : undefined;
  }

  async queryJmxRange(
    serverId: string,
    startTime: string,
    endTime: string,
    limit = 60,
  ): Promise<readonly JmxMetricSnapshotDto[]> {
    const rows = await this.db
      .select()
      .from(jmxMetricSnapshots)
      .where(
        and(
          eq(jmxMetricSnapshots.serverId, serverId),
          gte(jmxMetricSnapshots.timestamp, startTime),
          lte(jmxMetricSnapshots.timestamp, endTime),
        ),
      )
      .orderBy(desc(jmxMetricSnapshots.timestamp))
      .limit(limit);
    return rows.reverse().map(jmxRowToDto);
  }
}
