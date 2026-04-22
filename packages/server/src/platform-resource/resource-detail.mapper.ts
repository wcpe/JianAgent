import { Injectable } from '@nestjs/common';
import { ResourceKind } from '@jian-agent/shared-domain';
import type {
  ResourceDetailDto,
  ResourceStatusSummaryDto,
  ResourceCapabilityDto,
  ServerWithStatusDto,
  RemoteHostDto,
  ServerState,
  ResourceHealth,
  HostType,
} from '@jian-agent/shared-domain';

/**
 * Maps underlying domain objects (ServerWithStatusDto, RemoteHostDto)
 * into the unified ResourceDetailDto consumed by the frontend.
 */
@Injectable()
export class ResourceDetailMapper {
  /** Map a managed/external server to the unified detail shape. */
  fromServer(
    server: ServerWithStatusDto,
    capabilities: ResourceCapabilityDto,
  ): ResourceDetailDto {
    return {
      id: server.id,
      kind: ResourceKind.SERVER,
      name: server.name,
      serverType: server.serverType,
      hostType: 'local' as HostType,
      host: server.host,
      port: server.port,
      tags: server.tags ?? [],
      createdAt: server.createdAt ?? '',
      updatedAt: server.updatedAt ?? '',
      status: this.mapServerStatus(server),
      capabilities,
      availableActions: [],
      latestValidationSummary: null,
      dependencies: [],
      dependents: [],
    };
  }

  /** Map a remote SSH host to the unified detail shape. */
  fromRemoteHost(
    host: RemoteHostDto,
    capabilities: ResourceCapabilityDto,
  ): ResourceDetailDto {
    return {
      id: host.id,
      kind: ResourceKind.REMOTE_HOST,
      name: host.name,
      serverType: null,
      hostType: 'remote' as HostType,
      host: host.host,
      port: host.port,
      tags: host.tags,
      createdAt: host.createdAt,
      updatedAt: host.updatedAt,
      status: this.mapRemoteHostStatus(host),
      capabilities,
      availableActions: [],
      latestValidationSummary: null,
      dependencies: [],
      dependents: [],
    };
  }

  // ── private helpers ──────────────────────────────────────────

  private mapServerStatus(
    server: ServerWithStatusDto,
  ): ResourceStatusSummaryDto {
    const runtimeStatus = server.runtimeStatus;
    const stateMap: Record<string, ServerState> = {
      running: 'RUNNING',
      stopped: 'STOPPED',
      starting: 'STARTING',
      stopping: 'STOPPING',
      error: 'CRASHED',
      unknown: 'UNKNOWN',
    };
    const state = (stateMap[runtimeStatus] ?? 'UNKNOWN') as ServerState;
    const health = this.deriveHealth(state);
    const uptimeSec =
      state === 'RUNNING' && server.uptime != null
        ? server.uptime
        : null;

    return {
      state,
      health,
      detail: null,
      uptimeSec,
      onlinePlayers: server.onlinePlayers ?? null,
      maxPlayers: server.maxPlayers ?? null,
      version: server.version ?? null,
    };
  }

  private mapRemoteHostStatus(
    host: RemoteHostDto,
  ): ResourceStatusSummaryDto {
    const statusMap: Record<string, ServerState> = {
      online: 'RUNNING',
      error: 'CRASHED',
      unknown: 'UNKNOWN',
    };
    const state = (statusMap[host.status] ?? 'UNKNOWN') as ServerState;
    const health = this.deriveHealth(state);

    return {
      state,
      health,
      detail: host.status === 'online' ? null : host.status,
      uptimeSec: null,
      onlinePlayers: null,
      maxPlayers: null,
      version: null,
    };
  }

  private deriveHealth(state: ServerState): ResourceHealth {
    switch (state) {
      case 'RUNNING':
        return 'healthy';
      case 'CRASHED':
        return 'critical';
      case 'STOPPED':
      case 'STOPPING':
      case 'UNKNOWN':
        return 'unknown';
      case 'STARTING':
        return 'degraded';
      default:
        return 'unknown';
    }
  }
}
