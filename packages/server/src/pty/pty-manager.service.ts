import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PtySession } from './pty-session.js';
import { TerminalSessionService } from '../terminal-session/terminal-session.service.js';
import { SessionType } from '../terminal-session/terminal-session.types.js';

@Injectable()
export class PtyManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(PtyManagerService.name);
  private readonly sessions = new Map<string, PtySession>();

  constructor(
    private readonly terminalSessionService: TerminalSessionService,
  ) {}

  createSession(sessionId: string, shell: string, args: string[], options: { cwd?: string; env?: Record<string, string> }): PtySession {
    if (this.sessions.has(sessionId)) {
      throw new Error(`PTY session already exists: ${sessionId}`);
    }

    const session = new PtySession(sessionId);
    session.start(shell, args, options);

    // Register in unified session registry
    const unifiedSession = this.terminalSessionService.create({
      type: SessionType.PTY_SHELL,
      serverId: sessionId,
      sessionId,
    });

    // Wire PTY output → unified session emitOutput
    session.on('data', (data: string) => {
      unifiedSession.emitOutput(data);
    });

    // Wire unified session input → PTY write
    unifiedSession.on('input', (data: string) => {
      session.write(data);
    });

    // Wire PTY resize from unified session
    unifiedSession.on('resize', (cols: number, rows: number) => {
      session.resize(cols, rows);
    });

    session.on('exit', () => {
      this.sessions.delete(sessionId);
      unifiedSession.emitExit({ exitCode: 0 });
      this.logger.log(`PTY session ended: ${sessionId}`);
    });

    unifiedSession.activate();
    this.sessions.set(sessionId, session);
    this.logger.log(`PTY session created: ${sessionId}`);
    return session;
  }

  getSession(sessionId: string): PtySession | undefined {
    return this.sessions.get(sessionId);
  }

  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.kill();
      this.sessions.delete(sessionId);
      this.terminalSessionService.close(sessionId);
    }
  }

  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  onModuleDestroy(): void {
    for (const session of this.sessions.values()) {
      session.kill();
    }
    this.sessions.clear();
  }
}
