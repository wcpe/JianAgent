import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebSocketServer, type WebSocket } from 'ws';
import { URL } from 'node:url';
import type { Server as HttpServer } from 'node:http';
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
import { AuthService } from '../auth/auth.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { readRealtimeConfig } from '../common/network-config.js';
import type { RealtimeConfig } from '../common/network-config.js';

import { TerminalSessionService } from '../terminal-session/terminal-session.service.js';
import type { TerminalCommandEvent } from '../event-bus/events.js';

@Injectable()
export class RealtimeGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeGateway.name);
  private wss: WebSocketServer | null = null;
  private readonly config: RealtimeConfig;
  private readonly rooms = new Map<string, Set<WebSocket>>();
  private readonly tailHandles = new Map<WebSocket, TailHandle>();
  private readonly clientSubscriptions = new Map<WebSocket, Map<string, () => void>>();
  private readonly clientUsers = new Map<WebSocket, JwtPayload>();
  private readonly outputBuffers = new Map<string, RealtimeOutputBuffer>();
  private readonly outputDedup = new Map<string, string>();
  private readonly outputDedupTs = new Map<string, number>();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private dedupCleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly clientAlive = new Map<WebSocket, boolean>();

  constructor(
    private readonly eventBus: EventEmitter2,
    private readonly logFileService: LogFileService,
    private readonly sessionService: TerminalSessionService,
    private readonly authService: AuthService,
  ) {
    this.config = readRealtimeConfig();
  }

  onModuleInit(): void {
    // The WS server will be attached to the HTTP server in main.ts
  }

  onModuleDestroy(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.dedupCleanupInterval !== null) {
      clearInterval(this.dedupCleanupInterval);
      this.dedupCleanupInterval = null;
    }
  }

  attachToServer(httpServer: HttpServer): void {
    this.wss = new WebSocketServer({
      noServer: true,
      perMessageDeflate: {
        zlibDeflateOptions: { level: 6 },
        threshold: 1024, // Only compress messages > 1KB
      },
    });
    this.wss.on('connection', (ws: WebSocket, req) => {
      if (this.wss!.clients.size > this.config.maxConnections) {
        ws.close(1013, 'Try Again Later');
        return;
      }

      const requestUrl = new URL(req.url ?? '', 'ws://localhost');
      const token = requestUrl.searchParams.get('token')!;
      const user = this.authService.verifyToken(token);
      this.clientUsers.set(ws, user);
      this.clientAlive.set(ws, true);

      this.logger.log(`Realtime WS client connected: ${user.username}`);
      this.clientSubscriptions.set(ws, new Map());

      ws.on('pong', () => {
        this.clientAlive.set(ws, true);
      });

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
        } catch (err) {
          this.logger.debug('Ignoring malformed WebSocket message', err);
        }
      });

      ws.on('close', () => {
        const user = this.clientUsers.get(ws);
        this.handleLogTailStop(ws);
        this.removeFromAllRooms(ws);
        const subs = this.clientSubscriptions.get(ws);
        if (subs) {
          for (const unsub of subs.values()) unsub();
          this.clientSubscriptions.delete(ws);
        }
        this.clientUsers.delete(ws);
        this.clientAlive.delete(ws);
        this.logger.log(`Realtime WS client disconnected: ${user?.username ?? 'unknown'}`);
      });
    });

    this.pingInterval = setInterval(() => {
      for (const client of this.wss!.clients) {
        if (!this.clientAlive.get(client)) {
          client.terminate();
          continue;
        }
        this.clientAlive.set(client, false);
        client.ping();
      }
    }, 30_000);

    this.dedupCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, ts] of this.outputDedupTs) {
        if (now - ts > this.config.outputDedupTtlMs) {
          this.outputDedupTs.delete(key);
          this.outputDedup.delete(key);
        }
      }
    }, this.config.dedupCleanupIntervalMs);
  }

  handleUpgrade(request: any, socket: any, head: any): void {
    try {
      const requestUrl = new URL(request.url ?? '', 'ws://localhost');
      const token = requestUrl.searchParams.get('token');
      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      this.authService.verifyToken(token);

      this.wss!.handleUpgrade(request, socket, head, (ws) => {
        this.wss!.emit('connection', ws, request);
      });
    } catch (err) {
      this.logger.debug('WebSocket upgrade auth failed', err);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
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
          const payload = createWsMessage(WsChannel.RESOURCE_LOG_TAIL, { line }, serverId);
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

  private handleTerminalInput(ws: WebSocket, data: Record<string, unknown> | undefined): void {
    this.logger.log(`Received terminal input: ${JSON.stringify(data)}`);
    if (!data?.sessionId || typeof data.data !== 'string') return;
    const sessionId = data.sessionId as string;
    const inputData = data.data;
    this.sessionService.write(sessionId, inputData);

    // Emit command audit event
    const command = inputData.replace(/\r?\n$/, '').trim();
    if (command.length > 0) {
      const lower = command.toLowerCase();
      const isDanger =
        /\brm\s+-rf\b/.test(lower) ||
        /\bmkfs\b/.test(lower) ||
        /\bshutdown\b/.test(lower) ||
        /\breboot\b/.test(lower) ||
        command.includes(':(){:|:&};:');

      const event: TerminalCommandEvent = {
        serverId: (data.serverId as string) ?? 'unknown',
        userId: (data.userId as string) ?? 'anonymous',
        username: (data.username as string) ?? 'anonymous',
        command,
        isDanger,
        timestamp: Date.now(),
      };
      this.eventBus.emit('terminal.command', event);
    }
  }

  private handleTerminalResize(data: Record<string, unknown> | undefined): void {
    if (!data?.sessionId || typeof data.cols !== 'number' || typeof data.rows !== 'number') return;
    this.sessionService.resize(data.sessionId as string, data.cols, data.rows);
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
        const msg = createWsMessage(WsChannel.TERMINAL_SESSION_DATA, { sessionId, data: output }, sessionId);
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
    this.enqueueServerOutput(event);
  }

  @OnEvent('server.state-changed')
  handleStateChanged(event: ServerStateChangedEvent): void {
    const payload = createWsMessage(WsChannel.RESOURCE_SERVER_STATUS, event);
    this.broadcastToRoom(`server:${event.serverId}`, payload);
    this.broadcastToRoom('servers:status', payload);
  }

  @OnEvent('server.crashed')
  handleServerCrashed(event: ServerCrashedEvent): void {
    const payload = createWsMessage(WsChannel.RESOURCE_SERVER_CRASHED, event);
    this.broadcastToRoom(`server:${event.serverId}`, payload);
    this.broadcastToRoom('servers:status', payload);
  }

  @OnEvent('server.health')
  handleServerHealth(event: ServerHealthEvent): void {
    const payload = createWsMessage(WsChannel.RESOURCE_SERVER_HEALTH, event);
    this.broadcastToRoom(`server:${event.serverId}`, payload);
  }

  @OnEvent('control-plane.agent.registered')
  handleControlPlaneAgentRegistered(event: ControlPlaneAgentRegisteredEvent): void {
    const payload = createWsMessage(WsChannel.TASK_CONTROL_PLANE_AGENT_REGISTERED, event);
    this.broadcastToRoom('control-plane:agents', payload);
  }

  @OnEvent('control-plane.agent.heartbeat')
  handleControlPlaneAgentHeartbeat(event: ControlPlaneAgentHeartbeatEvent): void {
    const payload = createWsMessage(WsChannel.TASK_CONTROL_PLANE_AGENT_HEARTBEAT, event);
    this.broadcastToRoom('control-plane:agents', payload);
  }

  @OnEvent('file-task.created')
  handleFileTaskCreated(event: FileTaskCreatedEvent): void {
    const payload = createWsMessage(WsChannel.TASK_FILE_TASK_CREATED, event);
    this.broadcastToRoom(`server:${event.serverId}`, payload);
    this.broadcastToRoom('file-tasks', payload);
  }

  @OnEvent('file-task.state-changed')
  handleFileTaskStateChanged(event: FileTaskStateChangedEvent): void {
    const payload = createWsMessage(WsChannel.TASK_FILE_TASK_STATE_CHANGED, event);
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
    if (this.rooms.get(room)?.size === 0) {
      this.rooms.delete(room);
      // Clean up output buffer for empty rooms
      const buffer = this.outputBuffers.get(room);
      if (buffer?.flushTimer) clearTimeout(buffer.flushTimer);
      this.outputBuffers.delete(room);
      this.outputDedup.delete(room);
      this.outputDedupTs.delete(room);
    }
  }

  private removeFromAllRooms(ws: WebSocket): void {
    for (const members of this.rooms.values()) {
      members.delete(ws);
    }
    for (const [room, members] of this.rooms) {
      if (members.size === 0) {
        this.rooms.delete(room);
        // Clean up output buffer for empty rooms
        const buffer = this.outputBuffers.get(room);
        if (buffer?.flushTimer) clearTimeout(buffer.flushTimer);
        this.outputBuffers.delete(room);
        this.outputDedup.delete(room);
        this.outputDedupTs.delete(room);
      }
    }
  }

  private broadcastToRoom(room: string, message: unknown): void {
    const members = this.rooms.get(room);
    if (!members) return;
    const data = JSON.stringify(message);
    for (const client of members) {
      if (client.readyState !== 1) {
        continue;
      }
      try {
        client.send(data);
      } catch (error) {
        this.logger.warn(`Failed to send to room ${room}: ${error}`);
      }
    }
  }

  private broadcast(message: unknown): void {
    if (!this.wss) return;
    const data = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState !== 1) {
        continue;
      }
      try {
        client.send(data);
      } catch (error) {
        this.logger.warn(`Failed to broadcast message: ${error}`);
      }
    }
  }

  private enqueueServerOutput(event: ServerOutputEvent): void {
    const room = `server:${event.serverId}`;
    const dedupeKey = `${event.stream}:${event.chunk}`;
    const now = Date.now();

    const previousTs = this.outputDedupTs.get(room);
    const previousChunk = this.outputDedup.get(room);
    if (previousChunk === dedupeKey && previousTs && now - previousTs <= this.config.outputDedupWindowMs) {
      return;
    }

    this.outputDedup.set(room, dedupeKey);
    this.outputDedupTs.set(room, now);

    const buffer = this.getOrCreateOutputBuffer(room);
    buffer.chunksByStream[event.stream].push(event.chunk);
    buffer.lastEventByStream[event.stream] = event;

    if (!buffer.flushTimer) {
      buffer.flushTimer = setTimeout(() => {
        this.flushServerOutput(room);
      }, this.config.outputAggregateWindowMs);
    }
  }

  private flushServerOutput(room: string): void {
    const buffer = this.outputBuffers.get(room);
    if (!buffer) return;

    const timestamp = Date.now();
    const { chunksByStream } = buffer;
    this.outputBuffers.delete(room);

    if (buffer.flushTimer) {
      clearTimeout(buffer.flushTimer);
      buffer.flushTimer = undefined;
    }

    const streamTypes: Array<ServerOutputEvent['stream']> = ['stdout', 'stderr'];
    for (const stream of streamTypes) {
      const latestEvent = buffer.lastEventByStream[stream];
      const chunks = chunksByStream[stream];
      if (!latestEvent || chunks.length === 0) {
        continue;
      }

      const payload = createWsMessage(
        WsChannel.RESOURCE_SERVER_OUTPUT,
        {
          ...latestEvent,
          chunk: chunks.join(''),
          timestamp,
        },
      );
      this.broadcastToRoom(room, payload);
    }
  }

  private getOrCreateOutputBuffer(room: string): RealtimeOutputBuffer {
    const existing = this.outputBuffers.get(room);
    if (existing) return existing;

    const created: RealtimeOutputBuffer = {
      chunksByStream: {
        stdout: [],
        stderr: [],
      },
      lastEventByStream: {
        stdout: undefined,
        stderr: undefined,
      },
      flushTimer: undefined,
    };
    this.outputBuffers.set(room, created);
    return created;
  }
}

interface RealtimeOutputBuffer {
  readonly chunksByStream: {
    stdout: string[];
    stderr: string[];
  };
  lastEventByStream: {
    stdout: ServerOutputEvent | undefined;
    stderr: ServerOutputEvent | undefined;
  };
  flushTimer: ReturnType<typeof setTimeout> | undefined;
}
