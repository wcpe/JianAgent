/**
 * Resource events - server, bot state, session state, plugin, worker, metrics, logs
 */

import type {
  ServerState,
  BotSummary,
  SessionSummary,
  ResourceRefDto,
  ResourceSummaryDto,
} from '@jian-agent/shared-domain';

// Server resource events
export interface ServerStatusPayload {
  /** Unified resource reference for this server */
  readonly resourceRef: ResourceRefDto;
  /** Full resource summary (includes kind, name, status, host, etc.) */
  readonly resourceSummary: ResourceSummaryDto;
  readonly state: ServerState;
  readonly pid?: number;
  readonly uptime?: number;
  readonly cpuPercent?: number;
  readonly memoryMb?: number;
  readonly lastExitCode?: number;
  readonly lastExitTime?: string;
  readonly restartCount: number;
}

export interface ServerOutputPayload {
  readonly resourceRef: ResourceRefDto;
  readonly data: string;
}

export interface ServerCrashedPayload {
  readonly resourceRef: ResourceRefDto;
  readonly exitCode: number;
  readonly signal?: string;
  readonly timestamp: string;
}

export interface ServerHealthPayload {
  readonly resourceRef: ResourceRefDto;
  readonly healthy: boolean;
  readonly latencyMs?: number;
  readonly details?: string;
}

// Bot resource events
export interface BotSummaryPayload {
  readonly resourceRef: ResourceRefDto;
  readonly groupId: string;
  readonly bots: readonly BotSummary[];
}

export interface BotStatePayload {
  readonly resourceRef: ResourceRefDto;
  readonly groupId: string;
  readonly bots: readonly BotSummary[];
}

// Session resource events
export interface SessionStatePayload {
  readonly resourceRef: ResourceRefDto;
  readonly session: SessionSummary;
}

// Plugin resource events
export interface PluginStatusPayload {
  readonly resourceRef: ResourceRefDto;
  readonly pluginId: string;
  readonly status: 'active' | 'inactive' | 'error';
  readonly version?: string;
  readonly lastHeartbeat?: string;
}

export interface PluginSnapshotPayload {
  readonly resourceRef: ResourceRefDto;
  readonly pluginId: string;
  readonly snapshot: Record<string, unknown>;
}

// Java helper resource events
export interface JavaHelperStatusPayload {
  readonly resourceRef: ResourceRefDto;
  readonly status: 'running' | 'stopped' | 'error';
  readonly pid?: number;
  readonly version?: string;
}

// Worker resource events
export interface WorkerStatusPayload {
  readonly resourceRef: ResourceRefDto;
  readonly workerId: string;
  readonly status: 'online' | 'offline' | 'error';
  readonly lastHeartbeat?: string;
}

// Log events
export interface LogTailPayload {
  readonly resourceRef?: ResourceRefDto;
  readonly serverId?: string;
  readonly lines: readonly string[];
}

export interface LogTailStartPayload {
  readonly resourceRef?: ResourceRefDto;
  readonly serverId?: string;
  readonly source?: string;
}

export interface LogTailStopPayload {
  readonly resourceRef?: ResourceRefDto;
  readonly serverId?: string;
}
