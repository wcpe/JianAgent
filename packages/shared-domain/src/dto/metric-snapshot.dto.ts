import type { PlayerDetailDto, PluginDetailDto } from './probe.dto.js';

export interface MetricSnapshotDto {
  readonly id: string;
  readonly timestamp: string;
  readonly serverId: string;
  readonly tps: number | null;
  readonly mspt: number | null;
  readonly onlinePlayers: number | null;
  readonly onlineBots: number | null;
  readonly cpuUsage: number | null;
  readonly memoryUsageMb: number | null;
  readonly maxMemoryMb: number | null;
  readonly entityCount: number | null;
  readonly loadedChunks: number | null;
  readonly worldCount: number | null;
  readonly maxPlayers: number | null;
  readonly pluginCount: number | null;
  readonly playerDetails: readonly PlayerDetailDto[] | null;
  readonly pluginDetails: readonly PluginDetailDto[] | null;
}

export interface WorldMetricSnapshotDto {
  readonly id: string;
  readonly metricSnapshotId: string;
  readonly serverId: string;
  readonly timestamp: string;
  readonly worldName: string;
  readonly environment: string;
  readonly entityCount: number | null;
  readonly loadedChunks: number | null;
  readonly entityTypes: Record<string, number> | null;
}

export interface JmxMetricSnapshotDto {
  readonly id: string;
  readonly timestamp: string;
  readonly serverId: string;
  readonly pid: string;
  readonly heapUsedMb: number | null;
  readonly heapCommittedMb: number | null;
  readonly heapMaxMb: number | null;
  readonly threadCount: number | null;
  readonly daemonThreadCount: number | null;
  readonly gcYoungCount: number | null;
  readonly gcFullCount: number | null;
  readonly gcYoungTimeMs: number | null;
  readonly gcFullTimeMs: number | null;
}

export interface JmxMetricBucketDto {
  readonly timestamp: string;
  readonly bucketStart: string;
  readonly bucketEnd: string;
  readonly serverId: string;
  readonly pid: string;
  readonly sampleCount: number;
  readonly heapUsedMb: number | null;
  readonly heapCommittedMb: number | null;
  readonly heapMaxMb: number | null;
  readonly threadCount: number | null;
  readonly daemonThreadCount: number | null;
  readonly gcYoungCount: number | null;
  readonly gcFullCount: number | null;
  readonly gcYoungTimeMs: number | null;
  readonly gcFullTimeMs: number | null;
}
