import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PluginBridgeService } from '../plugin-bridge/plugin-bridge.service.js';
import { SnapshotService } from '../plugin-bridge/snapshot.service.js';
import { randomUUID } from 'node:crypto';

export interface PluginRuntimeStatus {
  readonly name: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly authors: readonly string[];
  readonly hasConnection: boolean;
}

@Injectable()
export class PluginRuntimeService {
  private readonly logger = new Logger(PluginRuntimeService.name);

  constructor(
    private readonly bridgeService: PluginBridgeService,
    private readonly snapshotService: SnapshotService,
  ) {}

  /** Check if the server has an active plugin bridge connection. */
  isConnected(serverId: string): boolean {
    return this.bridgeService.getConnectionByServerId(serverId) !== undefined;
  }

  /** Get runtime plugin statuses from latest snapshot. */
  getPluginStatuses(serverId: string): readonly PluginRuntimeStatus[] {
    const stored = this.snapshotService.getLatest(serverId);
    if (!stored?.snapshot.plugins) return [];

    const hasConn = this.isConnected(serverId);
    return stored.snapshot.plugins.map((p) => ({
      name: p.name,
      version: p.version,
      enabled: p.enabled,
      authors: p.authors,
      hasConnection: hasConn,
    }));
  }

  /** Get a single plugin's runtime status by name. */
  getPluginStatus(serverId: string, pluginName: string): PluginRuntimeStatus | undefined {
    const statuses = this.getPluginStatuses(serverId);
    return statuses.find(
      (p) => p.name.toLowerCase() === pluginName.toLowerCase(),
    );
  }

  /** Verify bridge connection is active or throw. */
  private requireConnection(serverId: string): void {
    if (!this.isConnected(serverId)) {
      throw new BadRequestException(
        `No active plugin bridge connection for server ${serverId}. ` +
        'Cannot perform hot operations without a connected probe plugin.',
      );
    }
  }

  /** Execute a hot-load: loads a disabled plugin or reloads a plugin JAR. */
  hotLoad(serverId: string, pluginName: string): boolean {
    this.requireConnection(serverId);
    const requestId = randomUUID();
    this.logger.log(`Hot-loading plugin "${pluginName}" on server ${serverId} (requestId=${requestId})`);
    return this.bridgeService.sendConsoleCommand(
      serverId,
      `plugman load ${pluginName}`,
      requestId,
    );
  }

  /** Execute a hot-unload: unloads a running plugin without deleting the JAR. */
  hotUnload(serverId: string, pluginName: string): boolean {
    this.requireConnection(serverId);
    const requestId = randomUUID();
    this.logger.log(`Hot-unloading plugin "${pluginName}" on server ${serverId} (requestId=${requestId})`);
    return this.bridgeService.sendConsoleCommand(
      serverId,
      `plugman unload ${pluginName}`,
      requestId,
    );
  }

  /** Execute a hot-reload: unloads then reloads a plugin in-place. */
  hotReload(serverId: string, pluginName: string): boolean {
    this.requireConnection(serverId);
    const requestId = randomUUID();
    this.logger.log(`Hot-reloading plugin "${pluginName}" on server ${serverId} (requestId=${requestId})`);
    return this.bridgeService.sendConsoleCommand(
      serverId,
      `plugman reload ${pluginName}`,
      requestId,
    );
  }

  /** Enable a plugin: writes enabled state in the snapshot and hot-loads if bridge is connected. */
  async enable(serverId: string, pluginName: string): Promise<{ sent: boolean; hasConnection: boolean }> {
    this.logger.log(`Enabling plugin "${pluginName}" on server ${serverId}`);

    if (this.isConnected(serverId)) {
      const sent = this.hotLoad(serverId, pluginName);
      return { sent, hasConnection: true };
    }

    this.logger.warn(
      `No bridge connection for server ${serverId}. ` +
      `Plugin "${pluginName}" will be enabled on next server start.`,
    );
    return { sent: false, hasConnection: false };
  }

  /** Disable a plugin: hot-unloads if bridge is connected. */
  async disable(serverId: string, pluginName: string): Promise<{ sent: boolean; hasConnection: boolean }> {
    this.logger.log(`Disabling plugin "${pluginName}" on server ${serverId}`);

    if (this.isConnected(serverId)) {
      const sent = this.hotUnload(serverId, pluginName);
      return { sent, hasConnection: true };
    }

    this.logger.warn(
      `No bridge connection for server ${serverId}. ` +
      `Plugin "${pluginName}" will be disabled on next server start.`,
    );
    return { sent: false, hasConnection: false };
  }
}
