import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebSocketServer, type WebSocket } from 'ws';
import { createWsMessage, WsChannel } from '@jian-agent/shared-protocol';
import type { AlertPayload, ServerStatusPayload } from '@jian-agent/shared-protocol';
import type {
  ControlPlaneAgentHeartbeatEvent,
  ControlPlaneAgentRegisteredEvent,
  ServerOutputEvent,
  ServerStateChangedEvent,
  ServerCrashedEvent,
  ServerHealthEvent,
  FileTaskCreatedEvent,
  FileTaskStateChangedEvent,
  LocalValidationAssertionEvent,
  LocalValidationEvidenceEvent,
  LocalValidationRunEvent,
  LocalValidationStageEvent,
} from '../event-bus/events.js';
import { LogFileService } from '../log-file/log-file.service.js';
import type { TailHandle } from '../log-file/log-file.service.js';

import { TerminalSessionService } from '../terminal-session/terminal-session.service.js';
import type { TerminalCommandEvent } from '../event-bus/events.js';

@Injectable()
export class RealtimeGateway implements OnModuleInit {
  private readonly logger = new Logger(RealtimeGateway.name);
  private wss: WebSocketServer | null = null;
  private readonly rooms = new Map<string, Set<WebSocket>>();
  private readonly tailHandles = new Map<WebSocket, TailHandle>();
  private readonly clientSubscriptions = new Map<WebSocket, Map<string, () => void>>();

  constructor(
    private readonly eventBus: EventEmitter2,
    private readonly logFileService: LogFileService,
    private readonly sessionService: TerminalSessionService,
  ) {}

  onModuleInit(): void {
    // The WS server will be attached to the HTTP server in main.ts
  }

  attachToServer(httpServer: any): void {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws/realtime' });
    this.wss.on('connection', (ws: WebSocket) => {
      this.logger.log('Realtime WS client connected');
      this.clientSubscriptions.set(ws, new Map());

      ws.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'subscribe' && typeof msg.room === 'string') {
            this.joinRoom(ws, msg.room);
          } else if (msg.type === 'unsubscribe' && typeof msg.room === 'string') {
            this.leaveRoom(ws, msg.room);
          } else if (msg.channel === WsChannel.RESOURCE_LOG_TAIL_START) {
            this.handleLogTailStart(ws, msg);
          } else if (msg.channel === WsChannel.RESOURCE_LOG_TAIL_STOP) {
            this.handleLogTailStop(ws);
          } else if (msg.channel === WsChannel.TERMINAL_SESSION_INPUT) {
            this.handleTerminalInput(ws, msg.payload);
          } else if (msg.channel === WsChannel.TERMINAL_SESSION_RESIZE) {
            this.handleTerminalResize(msg.payload);
          } else if (msg.channel === 'terminal-session:subscribe') {
            this.subscribeToSession(ws, msg.payload?.sessionId);
          } else if (msg.channel === 'terminal-session:unsubscribe') {
            this.unsubscribeFromSession(ws, msg.payload?.sessionId);
          }
        } catch {
          // ignore malformed messages
        }
      });

      ws.on('close', () => {
        this.handleLogTailStop(ws);
        this.removeFromAllRooms(ws);
        const subs = this.clientSubscriptions.get(ws);
        if (subs) {
          for (const unsub of subs.values()) unsub();
          this.clientSubscriptions.delete(ws);
        }
        this.logger.log('Realtime WS client disconnected');
      });
    });
  }

  // ── Log tail handlers ──

  private async handleLogTailStart(
    ws: WebSocket,
    msg: { sessionId?: string; payload?: { filename?: string } },
  ): Promise<void> {
    // Stop any existing tail for this client
    this.handleLogTailStop(ws);

    const serverId = msg.sessionId;
    const filename = msg.payload?.filename;
    if (!serverId || !filename) return;

    try {
      const logsDir = await this.logFileService.resolveLogsDir(serverId);
      const handle = this.logFileService.startTail(logsDir, filename);
      this.tailHandles.set(ws, handle);

      handle.onLine((line) => {
        if (ws.readyState === 1) {
          const payload = createWsMessage(WsChannel.RESOURCE_LOG_TAIL as any, { line }, serverId);
          ws.send(JSON.stringify(payload));
        }
      });

      this.logger.log(`Log tail started: ${serverId}/${filename}`);
    } catch (err) {
      this.logger.warn(`Log tail failed: ${err}`);
    }
  }

  private handleLogTailStop(ws: WebSocket): void {
    const handle = this.tailHandles.get(ws);
    if (handle) {
      handle.close();
      this.tailHandles.delete(ws);
    }
  }

  // ── Terminal Session Handlers ──

  private handleTerminalInput(ws: WebSocket, data: any): void {
    this.logger.log(`Received terminal input: ${JSON.stringify(data)}`);
    if (!data?.sessionId || typeof data.data !== 'string') return;
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

  private handleTerminalResize(data: any): void {
    if (!data?.sessionId || typeof data.cols !== 'number' || typeof data.rows !== 'number') return;
    this.sessionService.resize(data.sessionId, data.cols, data.rows);
  }

  private subscribeToSession(client: WebSocket, sessionId?: string): void {
    if (!sessionId) return;
    const session = this.sessionService.get(sessionId);
    if (!session) {
      this.logger.warn(`Cannot subscribe to unknown session: ${sessionId}`);
      return;
    }

    const subs = this.clientSubscriptions.get(client);
    if (subs?.has(sessionId)) return;

    const handler = (output: string) => {
      if (client.readyState === 1) {
        const msg = createWsMessage(WsChannel.TERMINAL_SESSION_DATA as any, { sessionId, data: output }, sessionId);
        client.send(JSON.stringify(msg));
      }
    };

    session.on('data', handler);

    const unsub = () => {
      session.removeListener('data', handler);
    };

    subs?.set(sessionId, unsub);
  }

  private unsubscribeFromSession(client: WebSocket, sessionId?: string): void {
    if (!sessionId) return;
    const subs = this.clientSubscriptions.get(client);
    const unsub = subs?.get(sessionId);
    if (unsub) {
      unsub();
      subs!.delete(sessionId);
    }
  }

  // ── Event bus consumers ──

  @OnEvent('server.output')
  handleServerOutput(event: ServerOutputEvent): void {
    const payload = createWsMessage(WsChannel.RESOURCE_SERVER_OUTPUT as any, event);
    this.broadcastToRoom(`server:${event.serverId}`, payload);
  }

  @OnEvent('server.state-changed')
  handleStateChanged(event: ServerStateChangedEvent): void {
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

  @OnEvent('local-validation.run')
  handleLocalValidationRun(event: LocalValidationRunEvent): void {
    const payload = createWsMessage(WsChannel.RESOURCE_LOCAL_VALIDATION_RUN, event);
    this.broadcastToRoom(`local-validation:${event.runId}`, payload);
    this.broadcastToRoom('local-validation:runs', payload);
  }

  @OnEvent('local-validation.stage')
  handleLocalValidationStage(event: LocalValidationStageEvent): void {
    const payload = createWsMessage(WsChannel.RESOURCE_LOCAL_VALIDATION_STAGE, event);
    this.broadcastToRoom(`local-validation:${event.runId}`, payload);
    this.broadcastToRoom('local-validation:runs', payload);
  }

  @OnEvent('local-validation.assertion')
  handleLocalValidationAssertion(event: LocalValidationAssertionEvent): void {
    const payload = createWsMessage(WsChannel.RESOURCE_LOCAL_VALIDATION_ASSERTION, event);
    this.broadcastToRoom(`local-validation:${event.runId}`, payload);
    this.broadcastToRoom('local-validation:runs', payload);
  }

  @OnEvent('local-validation.evidence')
  handleLocalValidationEvidence(event: LocalValidationEvidenceEvent): void {
    const payload = createWsMessage(WsChannel.RESOURCE_LOCAL_VALIDATION_EVIDENCE, event);
    this.broadcastToRoom(`local-validation:${event.runId}`, payload);
    this.broadcastToRoom('local-validation:runs', payload);
  }

  // ── Legacy broadcast methods (deprecated, kept for compatibility) ──

  /** @deprecated Use event bus instead */
  broadcastServerStatus(status: ServerStatusPayload): void {
    this.broadcast(createWsMessage(WsChannel.RESOURCE_SERVER_STATUS, status));
  }

  /** @deprecated Use event bus instead */
  broadcastAlert(alert: AlertPayload): void {
    this.broadcast(createWsMessage(WsChannel.ALERT_FIRED, alert));
  }

  /** @deprecated Use event bus instead */
  broadcastChannel(channel: WsChannel, payload: unknown): void {
    this.broadcast(createWsMessage(channel, payload));
  }

  /** @deprecated Use event bus instead */
  broadcastRaw(message: unknown): void {
    this.broadcast(message);
  }

  // ── Room management ──

  private joinRoom(ws: WebSocket, room: string): void {
    let members = this.rooms.get(room);
    if (!members) {
      members = new Set();
      this.rooms.set(room, members);
    }
    members.add(ws);
  }

  private leaveRoom(ws: WebSocket, room: string): void {
    this.rooms.get(room)?.delete(ws);
  }

  private removeFromAllRooms(ws: WebSocket): void {
    for (const members of this.rooms.values()) {
      members.delete(ws);
    }
  }

  private broadcastToRoom(room: string, message: unknown): void {
    const members = this.rooms.get(room);
    if (!members) return;
    const data = JSON.stringify(message);
    for (const client of members) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }

  private broadcast(message: unknown): void {
    if (!this.wss) return;
    const data = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }
}
