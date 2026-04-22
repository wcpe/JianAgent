import type { ProbeRuntimeKind } from './platform-runtime-capability.dto.js';

export interface WorldMetricDto {
  readonly name: string;
  readonly environment: string;
  readonly entityCount: number;
  readonly loadedChunks: number;
  readonly entityTypes: Readonly<Record<string, number>>;
}

export interface PlayerDetailDto {
  readonly name: string;
  readonly uuid: string;
  readonly health: number;
  readonly maxHealth: number;
  readonly food: number;
  readonly level: number;
  readonly gameMode: string;
  readonly world: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly ping: number;
}

export interface PluginDetailDto {
  readonly name: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly authors: readonly string[];
}

export interface ProbeSnapshotDto {
  readonly runtimeKind?: ProbeRuntimeKind;
  readonly capabilityMatrix?: readonly string[];
  readonly tps: number;
  readonly mspt: number;
  readonly onlinePlayers: number;
  readonly maxPlayers: number;
  readonly loadedChunks: number;
  readonly entityCount: number;
  readonly worldCount: number;
  readonly freeMemoryMb: number;
  readonly totalMemoryMb: number;
  readonly maxMemoryMb?: number;
  readonly cpuUsage?: number;
  readonly uptime: string;
  readonly timestamp: string;
  readonly playerNames?: readonly string[];
  readonly pluginCount?: number;
  readonly worlds?: readonly WorldMetricDto[];
  readonly players?: readonly PlayerDetailDto[];
  readonly plugins?: readonly PluginDetailDto[];
}

export interface ProbeEventDto {
  readonly serverId: string;
  readonly eventType: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: string;
}

export interface ProbeCommandDto {
  readonly requestId: string;
  readonly action: string;
  readonly params: Record<string, unknown>;
}

export interface ProbeCommandResultDto {
  readonly requestId: string;
  readonly success: boolean;
  readonly message?: string;
  readonly data?: Record<string, unknown>;
}

export interface ProbeSummaryDto {
  readonly serverId: string;
  readonly status: string;
  readonly pluginVersion: string | null;
  readonly protocolVersion: number | null;
  readonly connectedAt: string | null;
  readonly lastSnapshotAt: string | null;
  readonly runtimeKind?: ProbeRuntimeKind;
  readonly capabilityMatrix?: readonly string[];
}
