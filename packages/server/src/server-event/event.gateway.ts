import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, WebSocket } from 'ws';
import { createWsMessage, WsChannel } from '@jian-agent/shared-protocol';
import type {
  ServerOutputEvent,
  ServerStateChangedEvent,
  ServerCrashedEvent,
  ServerHealthEvent,
  TerminalCommandEvent,
  FileTaskCreatedEvent,
  FileTaskStateChangedEvent,
  ControlPlaneAgentRegisteredEvent,
  ControlPlaneAgentHeartbeatEvent,
} from '../event-bus/events.js';

/**
 * EventGateway – unified WebSocket gateway for all server events.
 *
 * Listens to internal event bus events and broadcasts them to
 * connected WebSocket clients organized in rooms.
 *
 * Room conventions:
 *   server:<serverId>  – per-server events
 *   servers:status     – all server status changes
 *   control-plane:agents – agent registration/heartbeat
 *   file-tasks         – file task events
 */
@Injectable()
@WebSocketGateway({ path: '/ws/events' })
export class EventGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(EventGateway.name);

  @WebSocketServer()
  server!: Server;

  private readonly rooms = new Map<string, Set<WebSocket>>();
  private readonly clientRooms = new Map<WebSocket, Set<string>>();

  handleConnection(client: WebSocket): void {
    this.logger.log('Event WS client connected');
    this.clientRooms.set(client, new Set());
  }

  handleDisconnect(client: WebSocket): void {
    this.logger.log('Event WS client disconnected');
    this.removeFromAllRooms(client);
    this.clientRooms.delete(client);
  }

  onModuleDestroy(): void {
    // Clean up all rooms
    this.rooms.clear();
    this.clientRooms.clear();
  }

  // ── Subscription management ──

  @SubscribeMessage('event:subscribe')
  handleSubscribe(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: WebSocket,
  ): void {
    if (data.room) {
      this.joinRoom(client, data.room);
    }
  }

  @SubscribeMessage('event:unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: WebSocket,
  ): void {
    if (data.room) {
      this.leaveRoom(client, data.room);
    }
  }

  // ── Room management ──

  private joinRoom(ws: WebSocket, room: string): void {
    let members = this.rooms.get(room);
    if (!members) {
      members = new Set();
      this.rooms.set(room, members);
    }
    members.add(ws);

    let clientRooms = this.clientRooms.get(ws);
    if (!clientRooms) {
      clientRooms = new Set();
      this.clientRooms.set(ws, clientRooms);
    }
    clientRooms.add(room);
  }

  private leaveRoom(ws: WebSocket, room: string): void {
    this.rooms.get(room)?.delete(ws);
    this.clientRooms.get(ws)?.delete(room);
  }

  private removeFromAllRooms(ws: WebSocket): void {
    const clientRooms = this.clientRooms.get(ws);
    if (clientRooms) {
      for (const room of clientRooms) {
        this.rooms.get(room)?.delete(ws);
      }
      clientRooms.clear();
    }
  }

  private broadcastToRoom(room: string, message: unknown): void {
    const members = this.rooms.get(room);
    if (!members || members.size === 0) return;

    const data = JSON.stringify(message);
    for (const client of members) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (err) {
          this.logger.warn(`Failed to send to client in room ${room}: ${err}`);
        }
      }
    }
  }

  private broadcastToAll(message: unknown): void {
    if (!this.server) return;
    const data = JSON.stringify(message);
    for (const client of this.server.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (err) {
          this.logger.warn(`Failed to broadcast to client: ${err}`);
        }
      }
    }
  }

  // ── Server events ──

  @OnEvent('server.output')
  handleServerOutput(event: ServerOutputEvent): void {
    const payload = createWsMessage(WsChannel.RESOURCE_SERVER_OUTPUT as any, event);
    this.broadcastToRoom(`server:${event.serverId}`, payload);
  }

  @OnEvent('server.state-changed')
  handleServerStateChanged(event: ServerStateChangedEvent): void {
    const payload = createWsMessage(WsChannel.RESOURCE_SERVER_STATUS, event);
    this.broadcastToRoom(`server:${event.serverId}`, payload);
    this.broadcastToRoom('servers:status', payload);
  }

  @OnEvent('server.crashed')
  handleServerCrashed(event: ServerCrashedEvent): void {
    const payload = createWsMessage(WsChannel.RESOURCE_SERVER_CRASHED as any, event);
    this.broadcastToRoom(`server:${event.serverId}`, payload);
    this.broadcastToRoom('servers:status', payload);
  }

  @OnEvent('server.health')
  handleServerHealth(event: ServerHealthEvent): void {
    const payload = createWsMessage(WsChannel.RESOURCE_SERVER_HEALTH as any, event);
    this.broadcastToRoom(`server:${event.serverId}`, payload);
  }

  // ── Terminal command events ──

  @OnEvent('terminal.command')
  handleTerminalCommand(event: TerminalCommandEvent): void {
    // Use MC console channel for terminal command events
    const payload = createWsMessage(WsChannel.TERMINAL_SESSION_MC_CONSOLE as any, {
      type: 'terminal-command',
      ...event,
    });
    this.broadcastToRoom(`server:${event.serverId}`, payload);
  }

  // ── File task events ──

  @OnEvent('file-task.created')
  handleFileTaskCreated(event: FileTaskCreatedEvent): void {
    const payload = createWsMessage(WsChannel.TASK_FILE_TASK_CREATED as any, event);
    this.broadcastToRoom(`server:${event.serverId}`, payload);
    this.broadcastToRoom('file-tasks', payload);
  }

  @OnEvent('file-task.state-changed')
  handleFileTaskStateChanged(event: FileTaskStateChangedEvent): void {
    const payload = createWsMessage(WsChannel.TASK_FILE_TASK_STATE_CHANGED as any, event);
    this.broadcastToRoom(`server:${event.serverId}`, payload);
    this.broadcastToRoom('file-tasks', payload);
  }

  // ── Control plane events ──

  @OnEvent('control-plane.agent.registered')
  handleControlPlaneAgentRegistered(event: ControlPlaneAgentRegisteredEvent): void {
    const payload = createWsMessage(WsChannel.TASK_CONTROL_PLANE_AGENT_REGISTERED as any, event);
    this.broadcastToRoom('control-plane:agents', payload);
  }

  @OnEvent('control-plane.agent.heartbeat')
  handleControlPlaneAgentHeartbeat(event: ControlPlaneAgentHeartbeatEvent): void {
    const payload = createWsMessage(WsChannel.TASK_CONTROL_PLANE_AGENT_HEARTBEAT as any, event);
    this.broadcastToRoom('control-plane:agents', payload);
  }

  // ── Utility methods ──

  /** Get the number of clients in a specific room */
  getRoomSize(room: string): number {
    return this.rooms.get(room)?.size ?? 0;
  }

  /** Get all active room names */
  getActiveRooms(): string[] {
    return Array.from(this.rooms.keys()).filter(room => (this.rooms.get(room)?.size ?? 0) > 0);
  }
}
