import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OnEvent } from '@nestjs/event-emitter';
import { WsChannel, createWsMessage } from '@jian-agent/shared-protocol';
import { TerminalSessionService } from './terminal-session.service.js';
import { SessionType } from './terminal-session.types.js';
import type { TerminalCommandEvent, ServerOutputEvent } from '../event-bus/events.js';

/**
 * TerminalSessionGateway – unified WebSocket gateway for all terminal
 * session interactions.
 *
 * Handles the following WsChannel messages:
 *   terminal-session:input    → write data to session stdin
 *   terminal-session:resize   → resize session terminal
 *   terminal-session:data     → (outbound) session output
 *
 * Clients subscribe to session output by sending a join message and
 * the gateway wires up a listener on the session's 'data' event.
 */
@WebSocketGateway({ path: '/ws' })
export class TerminalSessionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TerminalSessionGateway.name);

  @WebSocketServer()
  server!: Server;

  /** Per-client → session subscriptions */
  private readonly clientSubscriptions = new Map<WebSocket, Map<string, () => void>>();

  constructor(
    private readonly sessionService: TerminalSessionService,
    private readonly eventBus: EventEmitter2,
  ) {}

  handleConnection(client: WebSocket): void {
    this.logger.log('TerminalSession WS client connected');
    this.clientSubscriptions.set(client, new Map());
  }

  handleDisconnect(client: WebSocket): void {
    this.logger.log('TerminalSession WS client disconnected');
    // Clean up all subscriptions for this client
    const subs = this.clientSubscriptions.get(client);
    if (subs) {
      for (const unsub of subs.values()) unsub();
      this.clientSubscriptions.delete(client);
    }
  }

  // ── Inbound: Input ──

  @SubscribeMessage(WsChannel.TERMINAL_SESSION_INPUT)
  handleInput(
    @MessageBody() data: { sessionId: string; data: string; serverId?: string; userId?: string; username?: string },
    @ConnectedSocket() client: WebSocket,
  ): void {
    this.sessionService.write(data.sessionId, data.data);

    // Emit command audit event
    const command = data.data.replace(/\r?\n$/, '').trim();
    if (command.length > 0) {
      const lower = command.toLowerCase();
      const isDanger =
        /\brm\s+-rf\b/.test(lower) ||
        /\bmkfs\b/.test(lower) ||
        /\bshutdown\b/.test(lower) ||
        /\breboot\b/.test(lower) ||
        command.includes(':(){:|:&};:');

      const event: TerminalCommandEvent = {
        serverId: data.serverId ?? 'unknown',
        userId: data.userId ?? 'anonymous',
        username: data.username ?? 'anonymous',
        command,
        isDanger,
        timestamp: Date.now(),
      };
      this.eventBus.emit('terminal.command', event);
    }
  }

  // ── Inbound: Resize ──

  @SubscribeMessage(WsChannel.TERMINAL_SESSION_RESIZE)
  handleResize(@MessageBody() data: { sessionId: string; cols: number; rows: number }): void {
    this.sessionService.resize(data.sessionId, data.cols, data.rows);
  }

  // ── Inbound: MC Console Input (legacy path) ──

  @SubscribeMessage(WsChannel.TERMINAL_SESSION_MC_CONSOLE)
  handleMcConsoleInput(
    @MessageBody() data: { serverId?: string; data: string; userId?: string; username?: string },
  ): void {
    const serverId = data.serverId ?? 'default';
    // Normalize line endings to \n for Java process stdin
    const command = data.data.replace(/\r\n?/g, '\n');

    // Forward to MC console session if one exists
    const session = this.sessionService.get(`mc:${serverId}`);
    if (session) {
      session.write(command);
    }

    // Emit command audit event
    const trimmed = command.replace(/\n$/, '');
    if (trimmed.length > 0) {
      const event: TerminalCommandEvent = {
        serverId,
        userId: data.userId ?? 'anonymous',
        username: data.username ?? 'anonymous',
        command: trimmed,
        isDanger: false,
        timestamp: Date.now(),
      };
      this.eventBus.emit('terminal.command', event);
    }
  }

  // ── Inbound: Subscribe to session output ──

  @SubscribeMessage('terminal-session:subscribe')
  handleSubscribe(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: WebSocket,
  ): void {
    this.subscribeToSession(client, data.sessionId);
  }

  // ── Inbound: Unsubscribe from session output ──

  @SubscribeMessage('terminal-session:unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: WebSocket,
  ): void {
    const subs = this.clientSubscriptions.get(client);
    const unsub = subs?.get(data.sessionId);
    if (unsub) {
      unsub();
      subs!.delete(data.sessionId);
    }
  }

  /**
   * Subscribe a WS client to receive output from a session.
   */
  subscribeToSession(client: WebSocket, sessionId: string): void {
    const session = this.sessionService.get(sessionId);
    if (!session) {
      this.logger.warn(`Cannot subscribe to unknown session: ${sessionId}`);
      return;
    }

    // Already subscribed?
    const subs = this.clientSubscriptions.get(client);
    if (subs?.has(sessionId)) return;

    const handler = (output: string) => {
      if (client.readyState === WebSocket.OPEN) {
        const msg = createWsMessage(WsChannel.TERMINAL_SESSION_DATA, { sessionId, data: output }, sessionId);
        client.send(JSON.stringify(msg));
      }
    };

    session.on('data', handler);

    const unsub = () => {
      session.removeListener('data', handler);
    };

    subs?.set(sessionId, unsub);

    // Auto-unsub when client closes
    client.on('close', () => {
      subs?.delete(sessionId);
      unsub();
    });
  }

  /** Broadcast output to all connected clients (e.g. for MC console). */
  broadcast(channel: string, payload: unknown): void {
    const msg = createWsMessage(channel as any, payload);
    const data = JSON.stringify(msg);
    for (const client of this.server?.clients ?? []) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  // ── Event bus consumers ──

  @OnEvent('server.output')
  handleServerOutput(event: ServerOutputEvent): void {
    // Broadcast MC console output to all connected clients
    this.broadcast(
      WsChannel.TERMINAL_SESSION_MC_CONSOLE,
      { data: event.chunk },
    );
  }
}
