import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { PluginBridgeService } from './plugin-bridge.service.js';
import { HandshakeService } from './handshake.service.js';
import { SnapshotService } from './snapshot.service.js';
import type { PluginBridgeMessage, HandshakeRequestPayload } from './plugin-bridge.types.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { WsChannel } from '@jian-agent/shared-protocol';
import { readPluginBridgeConfig } from '../common/network-config.js';

interface PendingConnection {
  ws: WebSocket;
  timeout: ReturnType<typeof setTimeout>;
}

@Injectable()
export class PluginBridgeGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PluginBridgeGateway.name);
  private wss: WebSocketServer | null = null;
  private readonly pending = new Map<WebSocket, PendingConnection>();
  private readonly wsToId = new Map<WebSocket, string>();

  constructor(
    private readonly bridgeService: PluginBridgeService,
    private readonly handshakeService: HandshakeService,
    private readonly snapshotService: SnapshotService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  onModuleInit(): void {
    const { disabled, host, port } = readPluginBridgeConfig();
    if (disabled) {
      this.logger.warn('Plugin bridge WS server is disabled by PLUGIN_BRIDGE_DISABLED');
      return;
    }

    this.wss = new WebSocketServer({ host, port });
    this.wss.on('listening', () => {
      this.logger.log(`Plugin bridge WS server listening on ${host}:${port}`);
    });
    this.wss.on('error', (error: Error) => {
      this.logger.error(`Plugin bridge WS server failed on ${host}:${port}: ${error.message}`);
      this.wss?.close();
      this.wss = null;
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleNewConnection(ws, req);
    });
  }

  onModuleDestroy(): void {
    for (const [ws, pending] of this.pending) {
      clearTimeout(pending.timeout);
      ws.close();
    }
    this.pending.clear();
    this.wss?.close();
  }

  private handleNewConnection(ws: WebSocket, _req: IncomingMessage): void {
    this.logger.log('New plugin connection, awaiting handshake...');

    const timeout = setTimeout(() => {
      this.logger.warn('Handshake timeout, closing connection');
      this.pending.delete(ws);
      ws.close();
    }, 10_000);

    this.pending.set(ws, { ws, timeout });

    ws.on('message', (data: Buffer) => {
      const raw = data.toString();
      if (this.pending.has(ws)) {
        this.handleHandshake(ws, raw);
      } else {
        this.handleMessage(ws, raw);
      }
    });

    ws.on('close', () => {
      const connId = this.wsToId.get(ws);
      if (connId) {
        this.bridgeService.removeConnection(connId);
        this.wsToId.delete(ws);
      }
      const pending = this.pending.get(ws);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pending.delete(ws);
      }
    });
  }

  private handleHandshake(ws: WebSocket, raw: string): void {
    try {
      const message: PluginBridgeMessage<HandshakeRequestPayload> = JSON.parse(raw);
      if (message.channel !== 'plugin:handshake') return;

      const response = this.handshakeService.validate(message.payload);
      ws.send(JSON.stringify({
        channel: 'plugin:handshake',
        payload: response,
        timestamp: new Date().toISOString(),
      }));

      if (response.accepted) {
        const pending = this.pending.get(ws);
        if (pending) clearTimeout(pending.timeout);
        this.pending.delete(ws);

        const connId = this.bridgeService.addConnection(
          message.payload.serverId,
          ws,
          message.payload.protocolVersion,
          {
            runtimeKind: message.payload.runtimeKind,
            capabilityMatrix: message.payload.capabilityMatrix,
          },
        );
        this.wsToId.set(ws, connId);
      } else {
        ws.close();
      }
    } catch (e) {
      this.logger.warn(`Invalid handshake message: ${e}`);
      ws.close();
    }
  }

  private handleMessage(ws: WebSocket, raw: string): void {
    try {
      const message: PluginBridgeMessage = JSON.parse(raw);
      const connId = this.wsToId.get(ws);
      if (!connId) return;

      const conn = this.bridgeService.getConnection(connId);
      if (!conn) return;

      switch (message.channel) {
        case 'plugin:snapshot':
          const snapshot = this.snapshotService.onSnapshot(conn.serverId, message.payload as any, {
            runtimeKind: conn.runtimeKind,
            capabilityMatrix: conn.capabilityMatrix,
          });
          this.realtimeGateway.broadcastChannel(
            WsChannel.RESOURCE_PLUGIN_SNAPSHOT,
            snapshot,
          );
          break;

        case 'plugin:event':
          this.realtimeGateway.broadcastChannel(
            WsChannel.RESOURCE_PLUGIN_STATUS,
            message.payload,
          );
          break;

        case 'plugin:command-result':
        case 'plugin:console-result':
        case 'plugin:eval-result':
          this.realtimeGateway.broadcastChannel(
            WsChannel.RESOURCE_PLUGIN_STATUS,
            { channel: message.channel, ...message.payload as Record<string, unknown> },
          );
          break;

        default:
          this.logger.debug(`Unknown plugin channel: ${message.channel}`);
      }
    } catch (e) {
      this.logger.warn(`Failed to parse plugin message: ${e}`);
    }
  }
}
