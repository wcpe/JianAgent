import type { ProbeRuntimeKind, ResourceRefDto, TaskStatusDto } from '@jian-agent/shared-domain';

export const PLUGIN_PROTOCOL_VERSION = 2;

export const PluginBridgeChannel = {
  HANDSHAKE: 'resource:plugin:handshake',
  SNAPSHOT: 'resource:plugin:snapshot',
  EVENT: 'resource:plugin:event',
  COMMAND: 'resource:plugin:command',
  COMMAND_RESULT: 'resource:plugin:command-result',
  STATUS: 'resource:plugin:status',
} as const;

export type PluginBridgeChannel = (typeof PluginBridgeChannel)[keyof typeof PluginBridgeChannel];

export interface BridgeMessage<T = unknown> {
  readonly channel: string;
  readonly protocolVersion: number;
  readonly payload: T;
  readonly timestamp: string;
}

export function createBridgeMessage<T>(channel: string, payload: T): BridgeMessage<T> {
  return {
    channel,
    protocolVersion: PLUGIN_PROTOCOL_VERSION,
    payload,
    timestamp: new Date().toISOString(),
  };
}

// --- Payload Types ---

export interface HandshakeRequestPayload {
  readonly protocolVersion: number;
  readonly pluginVersion: string;
  readonly serverVersion: string;
  readonly runtimeKind: ProbeRuntimeKind;
  /** @deprecated Use resourceRef.id instead */
  readonly serverId: string;
  /** Unified resource reference for the plugin's parent server */
  readonly resourceRef: ResourceRefDto;
}

export interface HandshakeResponsePayload {
  readonly accepted: boolean;
  readonly reason?: string;
  /** Current task status of the handshake */
  readonly taskStatus?: TaskStatusDto;
}

export interface SnapshotPushPayload {
  /** @deprecated Use resourceRef.id instead */
  readonly serverId: string;
  /** Unified resource reference for the monitored server */
  readonly resourceRef: ResourceRefDto;
  readonly runtimeKind: ProbeRuntimeKind;
  readonly capabilityMatrix: readonly string[];
  readonly tps: number;
  readonly mspt: number;
  readonly onlinePlayers: number;
  readonly maxPlayers: number;
  readonly loadedChunks: number;
  readonly entityCount: number;
  readonly worldCount: number;
  readonly freeMemoryMb: number;
  readonly totalMemoryMb: number;
  readonly uptime: string;
}

export interface EventPushPayload {
  /** @deprecated Use resourceRef.id instead */
  readonly serverId: string;
  /** Unified resource reference for the event source */
  readonly resourceRef: ResourceRefDto;
  readonly eventType: string;
  readonly data: Record<string, unknown>;
  /** Optional task status associated with this event */
  readonly taskStatus?: TaskStatusDto;
}

export interface CommandRequestPayload {
  readonly requestId: string;
  readonly action: string;
  readonly params: Record<string, unknown>;
  /** Unified resource reference for the command target */
  readonly resourceRef: ResourceRefDto;
}

export interface CommandResponsePayload {
  readonly requestId: string;
  readonly success: boolean;
  readonly message?: string;
  readonly data?: Record<string, unknown>;
  /** Task status reflecting command execution result */
  readonly taskStatus?: TaskStatusDto;
}
