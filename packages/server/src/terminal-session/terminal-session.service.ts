import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { SessionRegistry } from './session-registry.js';
import {
  SessionType,
  SessionState,
  TerminalSession,
  CreateSessionOptions,
  SessionSummary,
} from './terminal-session.types.js';

/**
 * UnifiedTerminalSession – concrete session implementation backed by
 * an EventEmitter. The actual transport (node-pty, ssh2 channel, docker
 * attach) is attached via the `attach()` method from outside this module,
 * keeping the session lifecycle generic.
 */
/** Exported for use by transport backends (PTY, SSH, etc.) */
export class UnifiedTerminalSession extends EventEmitter implements TerminalSession {
  public state: SessionState = SessionState.CREATED;
  public lastActivityAt: string;
  private alive = true;
  private readonly createdAtMs = Date.now();

  public readonly sessionId: string;
  public readonly type: SessionType;
  public readonly serverId: string;

  constructor(sessionId: string, type: SessionType, serverId: string) {
    super();
    this.sessionId = sessionId;
    this.type = type;
    this.serverId = serverId;
    this.lastActivityAt = new Date(this.createdAtMs).toISOString();
  }

  get createdAt(): string {
    return new Date(this.createdAtMs).toISOString();
  }

  write(data: string): void {
    this.touch();
    this.emit('input', data);
  }

  resize(cols: number, rows: number): void {
    this.touch();
    this.emit('resize', cols, rows);
  }

  close(): void {
    this.alive = false;
    this.setState(SessionState.CLOSED);
    this.emit('exit', { exitCode: 0 });
  }

  isAlive(): boolean {
    return this.alive;
  }

  /** Emit output data to all listeners */
  emitOutput(data: string): void {
    this.touch();
    this.emit('data', data);
  }

  /** Mark as active and update timestamps */
  activate(): void {
    this.alive = true;
    this.setState(SessionState.ACTIVE);
  }

  /** Mark as errored */
  markError(err: Error): void {
    this.alive = false;
    this.setState(SessionState.ERROR);
    this.emit('error', err);
  }

  /** Fire session exit from external transport close */
  emitExit(info: { exitCode: number; signal?: number }): void {
    this.alive = false;
    this.setState(SessionState.CLOSED);
    this.emit('exit', info);
  }

  private touch(): void {
    this.lastActivityAt = new Date().toISOString();
  }

  private setState(state: SessionState): void {
    if (this.state === state) return;
    const prev = this.state;
    this.state = state;
    this.emit('stateChange', state);
  }
}

/**
 * TerminalSessionService – core session lifecycle manager.
 *
 * Provides a unified API for creating sessions of any type, writing input,
 * resizing, closing, and subscribing to output.
 */
@Injectable()
export class TerminalSessionService {
  private readonly logger = new Logger(TerminalSessionService.name);

  constructor(private readonly registry: SessionRegistry) {}

  /** Create a new unified session (does NOT start a transport). */
  create(options: CreateSessionOptions): UnifiedTerminalSession {
    const sessionId = options.sessionId ?? this.registry.generateId();

    const session = new UnifiedTerminalSession(sessionId, options.type, options.serverId);
    this.registry.register(session);

    this.logger.log(
      `Created ${options.type} session ${sessionId} for server ${options.serverId}`,
    );
    return session;
  }

  /** Retrieve a session by id */
  get(sessionId: string): TerminalSession | undefined {
    return this.registry.get(sessionId);
  }

  /** Retrieve a strongly-typed UnifiedTerminalSession (for gateway wiring) */
  getInternal(sessionId: string): UnifiedTerminalSession | undefined {
    const session = this.registry.get(sessionId);
    return session instanceof UnifiedTerminalSession ? session : undefined;
  }

  /** Write data to a session's stdin */
  write(sessionId: string, data: string): boolean {
    const session = this.registry.get(sessionId);
    if (!session) return false;
    session.write(data);
    return true;
  }

  /** Resize a session */
  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.registry.get(sessionId);
    if (!session) return false;
    session.resize(cols, rows);
    return true;
  }

  /** Close and deregister a session */
  close(sessionId: string): boolean {
    return this.registry.close(sessionId);
  }

  /** List all sessions */
  list(): SessionSummary[] {
    return this.registry.list();
  }

  /** Close all sessions for a given server */
  closeAllForServer(serverId: string): void {
    for (const session of this.registry.list()) {
      if (session.serverId === serverId) {
        this.close(session.sessionId);
      }
    }
  }
}
