import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { ClientChannel } from 'ssh2';
import { SshPoolService } from './ssh-pool.service.js';
import type { SshConnectConfig } from '@jian-agent/shared-domain';
import { TerminalSessionService } from '../terminal-session/terminal-session.service.js';
import { SessionType } from '../terminal-session/terminal-session.types.js';
import type { UnifiedTerminalSession } from '../terminal-session/terminal-session.service.js';

export interface SshTerminalSession extends EventEmitter {
  readonly sessionId: string;
  readonly serverId: string;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  close(): void;
  isAlive(): boolean;
}

export interface SshSessionObservabilitySnapshot {
  readonly totalActiveSessions: number;
  readonly perServerQuota: number;
  readonly activeSessionsForServer: number;
  readonly remainingSessionsForServer: number;
  readonly activeSessionIds: readonly string[];
  readonly activeSessionBriefIds: readonly string[];
}

export interface SshSessionLiveView {
  readonly sessionId: string;
  readonly sessionBriefId: string;
  readonly serverId: string;
  readonly openedAt: string;
  readonly lastActivityAt: string;
  readonly idleForMs: number;
  readonly idleTimeoutMs: number;
}

class SshTerminalSessionImpl extends EventEmitter implements SshTerminalSession {
  private readonly logger = new Logger(SshTerminalSessionImpl.name);
  private channel: ClientChannel | null = null;
  private _alive = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimeoutMs = 10 * 60_000;
  private readonly openedAtMs = Date.now();
  private lastActivityAtMs = this.openedAtMs;

  constructor(
    public readonly sessionId: string,
    public readonly serverId: string,
  ) {
    super();
  }

  setIdleTimeout(timeoutMs: number): void {
    this.idleTimeoutMs = timeoutMs;
    this.touch();
  }

  private touch(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (!this._alive) return;
    this.lastActivityAtMs = Date.now();
    this.idleTimer = setTimeout(() => {
      if (!this._alive) return;
      this.emit('timeout');
      this.close();
    }, this.idleTimeoutMs);
  }

  attach(channel: ClientChannel): void {
    this.channel = channel;
    this._alive = true;
    this.touch();

    channel.on('data', (data: Buffer) => {
      this.touch();
      this.emit('data', data.toString('utf-8'));
    });

    channel.stderr.on('data', (data: Buffer) => {
      this.touch();
      this.emit('data', data.toString('utf-8'));
    });

    channel.on('close', () => {
      this._alive = false;
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.emit('exit', { exitCode: 0 });
      this.channel = null;
    });

    channel.on('error', (err: Error) => {
      this._alive = false;
      this.emit('error', err);
      this.channel = null;
    });
  }

  write(data: string): void {
    this.touch();
    this.channel?.write(data);
  }

  resize(cols: number, rows: number): void {
    if (this.channel) {
      this.touch();
      (this.channel as any).setWindow?.(rows, cols, 0, 0);
    }
  }

  close(): void {
    this._alive = false;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    try { this.channel?.close(); } catch (err) { this.logger.debug(`SSH channel close error: ${err}`); }
    this.channel = null;
  }

  isAlive(): boolean {
    return this._alive;
  }

  getOpenedAtMs(): number {
    return this.openedAtMs;
  }

  getLastActivityAtMs(): number {
    return this.lastActivityAtMs;
  }

  getIdleTimeoutMs(): number {
    return this.idleTimeoutMs;
  }
}

@Injectable()
export class SshTerminalService {
  private readonly logger = new Logger(SshTerminalService.name);
  private readonly sessions = new Map<string, SshTerminalSessionImpl>();
  private readonly maxSessionsPerServer: number;
  private readonly sessionIdleTimeoutMs: number;

  constructor(
    private readonly pool: SshPoolService,
    private readonly terminalSessionService: TerminalSessionService,
  ) {
    this.maxSessionsPerServer = 3;
    this.sessionIdleTimeoutMs = 10 * 60_000;
  }

  async createSession(config: SshConnectConfig, sessionId: string, cols = 120, rows = 30): Promise<SshTerminalSession> {
    if (this.sessions.has(sessionId)) {
      const existing = this.sessions.get(sessionId)!;
      if (existing.isAlive()) return existing;
      this.sessions.delete(sessionId);
    }

    const activeForServer = [...this.sessions.values()]
      .filter((item) => item.serverId === config.id && item.isAlive())
      .length;
    if (activeForServer >= this.maxSessionsPerServer) {
      throw new Error(`SSH session quota exceeded for server ${config.id}`);
    }

    const client = await this.pool.getConnection(config);
    const session = new SshTerminalSessionImpl(sessionId, config.id);
    session.setIdleTimeout(this.sessionIdleTimeoutMs);

    // Register in unified session registry
    const unifiedSession = this.terminalSessionService.create({
      type: SessionType.SSH_SHELL,
      serverId: config.id,
      sessionId,
      cols,
      rows,
    });

    return new Promise<SshTerminalSession>((resolve, reject) => {
      client.shell({ term: 'xterm-256color', cols, rows }, (err, channel) => {
        if (err) {
          reject(new Error(`Failed to open SSH shell: ${err.message}`));
          return;
        }
        session.attach(channel);
        this.sessions.set(sessionId, session);

        // Wire SSH session data → unified session emitOutput
        session.on('data', (output: string) => {
          unifiedSession.emitOutput(output);
        });

        // Wire unified session input → SSH session write
        unifiedSession.on('input', (data: string) => {
          session.write(data);
        });

        // Wire unified session resize → SSH session resize
        unifiedSession.on('resize', (c: number, r: number) => {
          session.resize(c, r);
        });

        let cleaned = false;
        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;
          this.sessions.delete(sessionId);
          this.terminalSessionService.close(sessionId);
          this.pool.release(config.id, client);
        };

        session.on('exit', cleanup);
        session.on('error', cleanup);
        session.on('timeout', cleanup);

        unifiedSession.activate();
        this.logger.log(`SSH terminal session ${sessionId} opened for ${config.host}`);
        resolve(session);
      });
    });
  }

  getSession(sessionId: string): SshTerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.close();
      this.sessions.delete(sessionId);
      this.terminalSessionService.close(sessionId);
    }
  }

  closeAllForServer(serverId: string): void {
    for (const [id, session] of this.sessions) {
      if (session.serverId === serverId) {
        session.close();
        this.sessions.delete(id);
        this.terminalSessionService.close(id);
      }
    }
  }

  getObservabilitySnapshot(serverId: string): SshSessionObservabilitySnapshot {
    const activeSessions = [...this.sessions.values()]
      .filter((session) => session.isAlive());
    const activeForServer = activeSessions
      .filter((session) => session.serverId === serverId)
      .map((session) => session.sessionId)
      .sort();

    return {
      totalActiveSessions: activeSessions.length,
      perServerQuota: this.maxSessionsPerServer,
      activeSessionsForServer: activeForServer.length,
      remainingSessionsForServer: Math.max(this.maxSessionsPerServer - activeForServer.length, 0),
      activeSessionIds: activeForServer,
      activeSessionBriefIds: activeForServer.map((sessionId) => this.toBriefSessionId(sessionId)),
    };
  }

  listActiveSessions(serverId?: string): readonly SshSessionLiveView[] {
    const now = Date.now();
    return [...this.sessions.values()]
      .filter((session) => session.isAlive())
      .filter((session) => (serverId ? session.serverId === serverId : true))
      .map((session) => {
        const lastActivityAtMs = session.getLastActivityAtMs();
        return {
          sessionId: session.sessionId,
          sessionBriefId: this.toBriefSessionId(session.sessionId),
          serverId: session.serverId,
          openedAt: new Date(session.getOpenedAtMs()).toISOString(),
          lastActivityAt: new Date(lastActivityAtMs).toISOString(),
          idleForMs: Math.max(now - lastActivityAtMs, 0),
          idleTimeoutMs: session.getIdleTimeoutMs(),
        };
      })
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  }

  private toBriefSessionId(sessionId: string): string {
    if (sessionId.length <= 16) return sessionId;
    return `${sessionId.slice(0, 9)}...${sessionId.slice(-4)}`;
  }
}
