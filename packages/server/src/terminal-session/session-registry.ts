import { Logger, Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TerminalSession, CreateSessionOptions, SessionSummary } from './terminal-session.types.js';
import { SessionState } from './terminal-session.types.js';

/**
 * SessionRegistry – in-memory Map<sessionId, session> store.
 *
 * Responsibilities:
 *   • Generate unique session IDs
 *   • Register / lookup / close / list sessions
 *   • Enforce one-session-per-id uniqueness
 *   • Clean up all sessions on module destroy
 */
@Injectable()
export class SessionRegistry implements OnModuleDestroy {
  private readonly logger = new Logger(SessionRegistry.name);
  private readonly sessions = new Map<string, TerminalSession>();

  /** Create and register a session. The actual backend attachment happens
   *  outside this registry – call this first to obtain an id, then start the
   *  backend, then call {@link register}. */
  generateId(): string {
    return randomUUID();
  }

  /** Register an already-constructed session in the registry. */
  register(session: TerminalSession): void {
    if (this.sessions.has(session.sessionId)) {
      throw new Error(`Session already registered: ${session.sessionId}`);
    }
    this.sessions.set(session.sessionId, session);
    this.logger.log(`Registered ${session.type} session ${session.sessionId} (server=${session.serverId})`);

    // Auto-deregister on close
    const remove = () => {
      this.sessions.delete(session.sessionId);
      this.logger.log(`Deregistered session ${session.sessionId}`);
    };
    session.on('exit', remove);
  }

  /** Lookup by id */
  get(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /** Check existence */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /** Close and deregister a session */
  close(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.close();
    this.sessions.delete(sessionId);
    return true;
  }

  /** Get all active session ids */
  ids(): string[] {
    return Array.from(this.sessions.keys());
  }

  /** Summarised list for API / debugging */
  list(): SessionSummary[] {
    return Array.from(this.sessions.values()).map((s) => ({
      sessionId: s.sessionId,
      type: s.type,
      serverId: s.serverId,
      state: s.state,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
      isAlive: s.isAlive(),
    }));
  }

  /** Number of tracked sessions */
  get size(): number {
    return this.sessions.size;
  }

  /** Close all sessions on shutdown */
  onModuleDestroy(): void {
    for (const session of this.sessions.values()) {
      try {
        session.close();
      } catch (err) {
        this.logger.debug(`Failed to close session during shutdown: ${session.sessionId}`, err);
      }
    }
    this.sessions.clear();
  }
}
