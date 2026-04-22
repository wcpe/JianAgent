import type { PluginRuntimeState } from '../enums/plugin-runtime-state.js';

/** Player detailed info for world inspector. */
export interface PlayerInspectorDto {
  readonly uuid: string;
  readonly name: string;
  readonly world: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly health: number;
  readonly foodLevel: number;
  readonly gamemode: string;
  readonly isOp: boolean;
  readonly isFlying: boolean;
  readonly inventorySize: number;
  readonly joinedAt: string;
  readonly ipAddress: string | null;
  readonly ping: number;
}

/** Chunk detailed info. */
export interface ChunkInspectorDto {
  readonly x: number;
  readonly z: number;
  readonly loaded: boolean;
  readonly entityCount: number;
  readonly tileEntityCount: number;
  readonly ticketLevel: number;
}

/** Block entity (tile entity) info. */
export interface BlockEntityInspectorDto {
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly customName: string | null;
}

/** Entity info in world. */
export interface EntityInspectorDto {
  readonly uuid: string;
  readonly type: string;
  readonly customName: string | null;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly health: number | null;
}

/** Plugin detailed info for world inspector. */
export interface PluginInspectorDto {
  readonly name: string;
  readonly version: string;
  readonly description: string | null;
  readonly authors: readonly string[];
  readonly state: PluginRuntimeState;
  readonly enabled: boolean;
  readonly mainClass: string;
  readonly depend: readonly string[];
  readonly softDepend: readonly string[];
  readonly commands: readonly PluginCommandDto[];
}

/** Plugin command info. */
export interface PluginCommandDto {
  readonly name: string;
  readonly description: string | null;
  readonly usage: string | null;
  readonly permission: string | null;
  readonly aliases: readonly string[];
}

/**
 * World Inspector DTO.
 * Provides drill-down data for world, player, and plugin inspection.
 */
export interface MinecraftWorldInspectorDto {
  /** Server identifier. */
  readonly serverId: string;
  /** ISO-8601 timestamp when the inspection was generated. */
  readonly generatedAt: string;
  /** World name being inspected. */
  readonly worldName: string;
  /** World environment. */
  readonly environment: 'normal' | 'nether' | 'the_end';
  /** World time (Minecraft ticks). */
  readonly time: number;
  /** Full time (never resets). */
  readonly fullTime: number;
  /** Current weather. */
  readonly weather: string;
  /** Thunder duration (0 if not thundering). */
  readonly thunderDuration: number;
  /** Players in this world. */
  readonly players: readonly PlayerInspectorDto[];
  /** Loaded chunks (paginated). */
  readonly chunks: readonly ChunkInspectorDto[];
  /** Total loaded chunk count. */
  readonly totalLoadedChunks: number;
  /** Entities in viewport (paginated). */
  readonly entities: readonly EntityInspectorDto[];
  /** Total entity count. */
  readonly totalEntityCount: number;
  /** Tile entities (block entities) in viewport. */
  readonly blockEntities: readonly BlockEntityInspectorDto[];
  /** Installed plugins (for server-wide view). */
  readonly plugins: readonly PluginInspectorDto[];
  /** Server seed (if accessible). */
  readonly seed: string | null;
  /** World border size. */
  readonly worldBorderSize: number | null;
}