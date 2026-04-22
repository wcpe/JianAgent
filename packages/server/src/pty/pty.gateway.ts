import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PtyManagerService } from './pty-manager.service.js';
import { ProcessManagerService } from '../server-process/process-manager.service.js';
import { SshTerminalService } from '../ssh/ssh-terminal.service.js';
import { WsChannel, createWsMessage } from '@jian-agent/shared-protocol';
import type { TerminalCommandEvent } from '../event-bus/events.js';

@WebSocketGateway({ path: '/ws' })
export class PtyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PtyGateway.name);
  private readonly mcConsoleClients = new Set<WebSocket>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly ptyManager: PtyManagerService,
    private readonly processManager: ProcessManagerService,
    private readonly sshTerminal: SshTerminalService,
    private readonly eventBus: EventEmitter2,
  ) {}

  handleConnection(client: WebSocket): void {
    this.logger.log('WS client connected for PTY');
    this.mcConsoleClients.add(client);
  }

  handleDisconnect(client: WebSocket): void {
    this.logger.log('WS client disconnected from PTY');
    this.mcConsoleClients.delete(client);
  }

  @SubscribeMessage(WsChannel.TERMINAL_SESSION_DATA)
  handleTerminalInput(@MessageBody() data: { sessionId: string; data: string }, @ConnectedSocket() client: WebSocket): void {
    const session = this.ptyManager.getSession(data.sessionId);
    if (session) {
      session.write(data.data);
    }
  }

  @SubscribeMessage(WsChannel.TERMINAL_SESSION_RESIZE)
  handleTerminalResize(@MessageBody() data: { sessionId: string; cols: number; rows: number }): void {
    const session = this.ptyManager.getSession(data.sessionId);
    if (session) {
      session.resize(data.cols, data.rows);
    }
  }

  @SubscribeMessage(WsChannel.TERMINAL_SESSION_MC_CONSOLE)
  handleMcConsoleInput(
    @MessageBody() data: { serverId?: string; data: string; userId?: string; username?: string },
  ): void {
    const serverId = data.serverId ?? 'default';
    const command = data.data;

    this.processManager.writeStdin(serverId, command);

    const event: TerminalCommandEvent = {
      serverId,
      userId: data.userId ?? 'anonymous',
      username: data.username ?? 'anonymous',
      command: command.replace(/\n$/, ''),
      isDanger: false,
      timestamp: Date.now(),
    };
    this.eventBus.emit('terminal.command', event);
  }

  sendToClient(client: WebSocket, sessionId: string, output: string): void {
    const msg = createWsMessage(WsChannel.TERMINAL_SESSION_DATA, { data: output }, sessionId);
    client.send(JSON.stringify(msg));
  }

  /** @deprecated Output now pushed via RealtimeGateway server.output event */
  broadcastMcConsole(output: string): void {
    const msg = createWsMessage(WsChannel.TERMINAL_SESSION_MC_CONSOLE, { data: output });
    const payload = JSON.stringify(msg);
    for (const client of this.mcConsoleClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  broadcastNodeLog(logLine: string): void {
    const msg = createWsMessage(WsChannel.TERMINAL_SESSION_NODE_LOG, { data: logLine });
    const payload = JSON.stringify(msg);
    for (const client of this.mcConsoleClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  // ── SSH Terminal ──

  @SubscribeMessage(WsChannel.TERMINAL_SESSION_SSH_DATA)
  handleSshTerminalInput(
    @MessageBody() data: { serverId: string; sessionId: string; data: string },
    @ConnectedSocket() client: WebSocket,
  ): void {
    const session = this.sshTerminal.getSession(data.sessionId);
    if (session) {
      session.write(data.data);

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
          serverId: data.serverId,
          userId: 'anonymous',
          username: 'anonymous',
          command,
          isDanger,
          timestamp: Date.now(),
        };
        this.eventBus.emit('terminal.command', event);
      }
    }
  }

  @SubscribeMessage(WsChannel.TERMINAL_SESSION_SSH_RESIZE)
  handleSshTerminalResize(
    @MessageBody() data: { serverId: string; sessionId: string; cols: number; rows: number },
  ): void {
    const session = this.sshTerminal.getSession(data.sessionId);
    if (session) {
      session.resize(data.cols, data.rows);
    }
  }

  /** Subscribe a WS client to SSH terminal output for a session. */
  subscribeSshTerminal(client: WebSocket, sessionId: string): void {
    const session = this.sshTerminal.getSession(sessionId);
    if (!session) return;

    const handler = (output: string) => {
      if (client.readyState === WebSocket.OPEN) {
        const msg = createWsMessage(WsChannel.TERMINAL_SESSION_SSH_DATA, {
          sessionId,
          data: output,
        });
        client.send(JSON.stringify(msg));
      }
    };

    session.on('data', handler);

    // Clean up when client disconnects
    client.on('close', () => {
      session.removeListener('data', handler);
    });
  }
}
