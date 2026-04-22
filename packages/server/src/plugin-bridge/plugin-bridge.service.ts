import { Injectable, Logger } from '@nestjs/common';
import type { WebSocket } from 'ws';
import type { PluginConnection, PluginBridgeMessage } from './plugin-bridge.types.js';
import { randomUUID } from 'crypto';
import type { ProbeRuntimeKind } from '@jian-agent/shared-domain';

@Injectable()
export class PluginBridgeService {
  private readonly logger = new Logger(PluginBridgeService.name);
  private readonly connections = new Map<string, PluginConnection>();

  addConnection(
    serverId: string,
    ws: WebSocket,
    protocolVersion: number,
    runtime?: {
      readonly runtimeKind?: ProbeRuntimeKind;
      readonly capabilityMatrix?: readonly string[];
    },
  ): string {
    const id = randomUUID();
    const conn: PluginConnection = {
      id,
      serverId,
      ws,
      connectedAt: new Date(),
      protocolVersion,
      runtimeKind: runtime?.runtimeKind,
      capabilityMatrix: runtime?.capabilityMatrix ?? [],
    };
    this.connections.set(id, conn);
    this.logger.log(`Plugin connected: id=${id} server=${serverId}`);
    return id;
  }

  removeConnection(id: string): void {
    const conn = this.connections.get(id);
    if (conn) {
      this.connections.delete(id);
      this.logger.log(`Plugin disconnected: id=${id} server=${conn.serverId}`);
    }
  }

  getConnection(id: string): PluginConnection | undefined {
    return this.connections.get(id);
  }

  getConnectionByServerId(serverId: string): PluginConnection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.serverId === serverId) return conn;
    }
    return undefined;
  }

  sendToPlugin(connectionId: string, channel: string, payload: unknown): boolean {
    const conn = this.connections.get(connectionId);
    if (!conn || conn.ws.readyState !== 1) return false;

    const message: PluginBridgeMessage = {
      channel,
      payload,
      timestamp: new Date().toISOString(),
    };
    conn.ws.send(JSON.stringify(message));
    return true;
  }

  sendCommand(serverId: string, action: string, params: Record<string, unknown>, requestId: string): boolean {
    const conn = this.getConnectionByServerId(serverId);
    if (!conn) return false;

    return this.sendToPlugin(conn.id, 'server:command', {
      action,
      params,
      requestId,
    });
  }

  /**
   * Send a console command to the MC server via the probe plugin.
   * The plugin will execute it as Bukkit.dispatchCommand(consoleSender, command).
   */
  sendConsoleCommand(serverId: string, command: string, requestId: string): boolean {
    const conn = this.getConnectionByServerId(serverId);
    if (!conn) return false;

    return this.sendToPlugin(conn.id, 'server:execute-console', {
      command,
      requestId,
    });
  }

  /**
   * Send a JS script to be executed by the probe plugin's scripting engine.
   * The script has access to Bukkit API objects (server, Bukkit, etc.).
   */
  sendEvalScript(serverId: string, script: string, requestId: string): boolean {
    const conn = this.getConnectionByServerId(serverId);
    if (!conn) return false;

    return this.sendToPlugin(conn.id, 'server:eval-script', {
      script,
      requestId,
    });
  }

  getAllConnections(): readonly PluginConnection[] {
    return [...this.connections.values()];
  }
}
