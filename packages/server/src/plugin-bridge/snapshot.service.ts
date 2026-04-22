import { Injectable, Logger } from '@nestjs/common';
import type { ProbeSnapshotDto } from '@jian-agent/shared-domain';
import { MetricStoreService } from '../storage/metric-store.service.js';
import type { ProbeRuntimeKind } from '@jian-agent/shared-domain';

export interface StoredSnapshot {
  readonly serverId: string;
  readonly snapshot: ProbeSnapshotDto;
  readonly receivedAt: Date;
}

const PERSIST_INTERVAL_MS = 10_000;

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);
  private readonly latest = new Map<string, StoredSnapshot>();
  private readonly lastPersistTime = new Map<string, number>();

  constructor(private readonly metricStore: MetricStoreService) {}

  onSnapshot(
    serverId: string,
    snapshot: ProbeSnapshotDto,
    defaults?: {
      readonly runtimeKind?: ProbeRuntimeKind;
      readonly capabilityMatrix?: readonly string[];
    },
  ): ProbeSnapshotDto {
    const effectiveSnapshot: ProbeSnapshotDto = {
      ...snapshot,
      runtimeKind: snapshot.runtimeKind ?? defaults?.runtimeKind,
      capabilityMatrix: snapshot.capabilityMatrix ?? defaults?.capabilityMatrix,
    };
    const stored: StoredSnapshot = {
      serverId,
      snapshot: effectiveSnapshot,
      receivedAt: new Date(),
    };
    this.latest.set(serverId, stored);
    this.logger.debug(`Snapshot updated for server=${serverId}`);
    this.persistIfDue(serverId, effectiveSnapshot);
    return effectiveSnapshot;
  }

  getLatest(serverId: string): StoredSnapshot | undefined {
    return this.latest.get(serverId);
  }

  getAllLatest(): readonly StoredSnapshot[] {
    return [...this.latest.values()];
  }

  private persistIfDue(serverId: string, snapshot: ProbeSnapshotDto): void {
    const now = Date.now();
    const last = this.lastPersistTime.get(serverId) ?? 0;
    if (now - last < PERSIST_INTERVAL_MS) return;

    this.lastPersistTime.set(serverId, now);
    const usedMemoryMb = (snapshot.totalMemoryMb ?? 0) - (snapshot.freeMemoryMb ?? 0);
    const ts = snapshot.timestamp ?? new Date().toISOString();
    const cpuUsage = (snapshot.cpuUsage != null && snapshot.cpuUsage >= 0) ? snapshot.cpuUsage : null;

    this.metricStore
      .insert({
        timestamp: ts,
        serverId,
        tps: snapshot.tps ?? null,
        mspt: snapshot.mspt ?? null,
        onlinePlayers: snapshot.onlinePlayers ?? null,
        onlineBots: null,
        cpuUsage,
        memoryUsageMb: usedMemoryMb,
        maxMemoryMb: snapshot.maxMemoryMb ?? null,
        entityCount: snapshot.entityCount ?? null,
        loadedChunks: snapshot.loadedChunks ?? null,
        worldCount: snapshot.worldCount ?? null,
        maxPlayers: snapshot.maxPlayers ?? null,
        pluginCount: snapshot.pluginCount ?? null,
        playerDetails: snapshot.players ?? null,
        pluginDetails: snapshot.plugins ?? null,
      })
      .then((snapshotId) => {
        const worlds = snapshot.worlds;
        if (worlds && worlds.length > 0) {
          return this.metricStore.insertWorldMetrics(
            snapshotId,
            serverId,
            ts,
            worlds.map((w) => ({
              worldName: w.name,
              environment: w.environment,
              entityCount: w.entityCount ?? null,
              loadedChunks: w.loadedChunks ?? null,
              entityTypes: w.entityTypes ? JSON.stringify(w.entityTypes) : null,
            })),
          );
        }
      })
      .catch((err) => this.logger.warn(`Failed to persist metric: ${err}`));
  }
}
