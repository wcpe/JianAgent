import type { ProbeStatus } from '../enums/probe-status.js';
import type { PluginRuntimeState } from '../enums/plugin-runtime-state.js';

/** Quick action context for Minecraft ops. */
export interface MinecraftQuickActionDto {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly enabled: boolean;
  readonly requiresConfirmation: boolean;
}

/** Player online summary. */
export interface PlayerOnlineDto {
  readonly uuid: string;
  readonly name: string;
  readonly world: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly health: number;
  readonly gamemode: string;
  readonly joinedAt: string;
}

/** Plugin status summary. */
export interface PluginStatusDto {
  readonly name: string;
  readonly version: string;
  readonly state: PluginRuntimeState;
  readonly enabled: boolean;
}

/** World summary. */
export interface WorldSummaryDto {
  readonly name: string;
  readonly environment: 'normal' | 'nether' | 'the_end';
  readonly playerCount: number;
  readonly entityCount: number;
  readonly loadedChunks: number;
  readonly time: number;
  readonly weather: string;
}

/** Probe connection status. */
export interface ProbeConnectionStatusDto {
  readonly probeId: string;
  readonly status: ProbeStatus;
  readonly connectedAt: string | null;
  readonly lastPingMs: number | null;
  readonly version: string | null;
}

/**
 * Minecraft Operations Summary DTO.
 * Provides a consolidated view of player, plugin, world,
 * and probe status for quick operations.
 */
export interface MinecraftOpsSummaryDto {
  /** Server identifier. */
  readonly serverId: string;
  /** ISO-8601 timestamp when the summary was generated. */
  readonly generatedAt: string;
  /** Whether the server is running. */
  readonly serverRunning: boolean;
  /** Server TPS (ticks per second). */
  readonly tps: number | null;
  /** Online players. */
  readonly players: readonly PlayerOnlineDto[];
  /** Max player capacity. */
  readonly maxPlayers: number;
  /** Installed plugins. */
  readonly plugins: readonly PluginStatusDto[];
  /** Loaded worlds. */
  readonly worlds: readonly WorldSummaryDto[];
  /** Probe connection status. */
  readonly probeStatus: ProbeConnectionStatusDto | null;
  /** Available quick actions. */
  readonly quickActions: readonly MinecraftQuickActionDto[];
  /** Server version (e.g., "1.20.4"). */
  readonly serverVersion: string | null;
}