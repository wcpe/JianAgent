/**
 * Unified Terminal Session Types
 *
 * Centralises session type definitions for MC console, SSH shell, PTY shell,
 * and attach-shell sessions. All session-related modules should reference
 * these shared types rather than defining their own.
 */

/** Session type discriminant */
export enum SessionType {
  MC_CONSOLE = 'MC_CONSOLE',
  SSH_SHELL = 'SSH_SHELL',
  PTY_SHELL = 'PTY_SHELL',
  ATTACH_SHELL = 'ATTACH_SHELL',
}

/** Session lifecycle state machine */
export enum SessionState {
  /** Just created, not yet connected to a backend */
  CREATED = 'CREATED',
  /** Backend connection established, I/O active */
  ACTIVE = 'ACTIVE',
  /** Temporarily paused (e.g. idle timeout warning) */
  PAUSED = 'PAUSED',
  /** Terminal foreground lost but session still alive */
  DETACHED = 'DETACHED',
  /** Session terminated (exit code or explicit close) */
  CLOSED = 'CLOSED',
  /** Session ended due to an error */
  ERROR = 'ERROR',
}

/** Minimal unified session contract */
export interface TerminalSession {
  /** Globally unique session identifier */
  readonly sessionId: string;
  /** Discriminated type */
  readonly type: SessionType;
  /** Associated server or remote host identifier */
  readonly serverId: string;
  /** Current lifecycle state */
  state: SessionState;
  /** ISO-8601 creation timestamp */
  readonly createdAt: string;
  /** ISO-8601 last I/O activity timestamp */
  lastActivityAt: string;

  /** Write raw data to the session's stdin */
  write(data: string): void;
  /** Resize the terminal */
  resize(cols: number, rows: number): void;
  /** Gracefully close the session */
  close(): void;
  /** Whether the underlying transport is alive */
  isAlive(): boolean;

  /** Subscribe to session output */
  on(event: 'data', listener: (output: string) => void): this;
  on(event: 'exit', listener: (info: { exitCode: number; signal?: number }) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'stateChange', listener: (state: SessionState) => void): this;

  /** Unsubscribe from session output */
  removeListener(event: 'data', listener: (output: string) => void): this;
}

/** Payload for creating a new session */
export interface CreateSessionOptions {
  type: SessionType;
  serverId: string;
  /** Optional client-provided session id (generated if omitted) */
  sessionId?: string;
  /** Initial terminal dimensions */
  cols?: number;
  rows?: number;
  /** Shell command for PTY sessions */
  shell?: string;
  /** Working directory for PTY sessions */
  cwd?: string;
  /** Environment variables for PTY sessions */
  env?: Record<string, string>;
}

/** Lightweight session info for listing */
export interface SessionSummary {
  sessionId: string;
  type: SessionType;
  serverId: string;
  state: SessionState;
  createdAt: string;
  lastActivityAt: string;
  isAlive: boolean;
}
