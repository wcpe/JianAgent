import type { ServerState } from '../enums/server-state.js';
import type { ProbeRuntimeKind } from './platform-runtime-capability.dto.js';

/** Aggregate health indicator across all subsystems. */
export type ResourceHealth = 'healthy' | 'degraded' | 'critical' | 'unknown';
export type LogBackendState = 'healthy' | 'degraded' | 'unavailable';

export interface ResourceStatusSummaryDto {
  /** Primary runtime state (maps from ServerState or ad-hoc status strings). */
  readonly state: ServerState;
  /** Derived health indicator. */
  readonly health: ResourceHealth;
  /** Human-readable detail about the current state. */
  readonly detail: string | null;
  /** Uptime in seconds, null if not running. */
  readonly uptimeSec: number | null;
  /** Online player count for game servers, null otherwise. */
  readonly onlinePlayers: number | null;
  /** Max player capacity, null if N/A. */
  readonly maxPlayers: number | null;
  /** Server version string reported by the runtime, null if unknown. */
  readonly version: string | null;
  /** Storage subsystem health for the control/data plane. */
  readonly storageHealth?: ResourceHealth | null;
  /** Current state of the active log backend. */
  readonly logBackendState?: LogBackendState | null;
  /** Whether the resource is currently operating in degraded mode. */
  readonly degradedMode?: boolean;
  /** Active probe runtime implementation, if known. */
  readonly probeRuntimeKind?: ProbeRuntimeKind | null;
  /** Compatibility tags surfaced by the resource/runtime. */
  readonly compatibilityTags?: readonly string[];
}
