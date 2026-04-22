/**
 * Frontend Terminal Session State Types
 *
 * Provides type definitions for the headless terminal session layer.
 * Mirrors the server-side SessionType/SessionState enums but uses
 * frontend-friendly state machine for UI rendering.
 */

import type { TerminalSessionState } from '@jian-agent/shared-domain';

/** Supported session types for the frontend layer */
export type SessionType =
  | 'MC_CONSOLE'
  | 'SSH_SHELL'
  | 'PTY_SHELL'
  | 'ATTACH_SHELL';

/** Frontend connection status — extends shared-domain TerminalSessionState */
export type ConnectionStatus = TerminalSessionState;

/** Terminal dimensions */
export interface TerminalDimensions {
  readonly cols: number;
  readonly rows: number;
}

/** Configuration for creating a terminal session */
export interface TerminalSessionConfig {
  /** Session type discriminant */
  readonly sessionType: SessionType;
  /** Target server/resource identifier */
  readonly targetId: string;
  /** Optional initial terminal dimensions */
  readonly dimensions?: TerminalDimensions;
  /** Optional extra params (e.g., shell, cwd for PTY) */
  readonly params?: Record<string, string>;
  /** Auto-connect on mount (default: true) */
  readonly autoConnect?: boolean;
}

/** Snapshot of a single terminal session's state */
export interface TerminalSessionSnapshot {
  /** Unique session identifier (from server) */
  readonly sessionId: string;
  /** Session type */
  readonly sessionType: SessionType;
  /** Target server/resource id */
  readonly targetId: string;
  /** Current connection status */
  readonly status: ConnectionStatus;
  /** Error message if status is ERROR */
  readonly error: string | null;
  /** Current terminal dimensions */
  readonly dimensions: TerminalDimensions;
  /** Number of output history lines buffered */
  readonly historyLineCount: number;
  /** Whether session is currently reconnecting */
  readonly isReconnecting: boolean;
  /** Number of reconnection attempts made */
  readonly reconnectAttempts: number;
  /** ISO timestamp of last data received */
  readonly lastActivityAt: string | null;
}

/** Options for the useTerminalSession hook */
export interface UseTerminalSessionOptions {
  /** Session configuration */
  readonly config: TerminalSessionConfig;
  /** Maximum lines to buffer in history (default: 10000) */
  readonly maxHistoryLines?: number;
  /** Enable auto-reconnect on disconnect (default: true) */
  readonly autoReconnect?: boolean;
  /** Max reconnection attempts before giving up (default: 10) */
  readonly maxReconnectAttempts?: number;
  /** Reconnect delay base in ms (doubles each attempt, default: 1000) */
  readonly reconnectBaseDelay?: number;
  /** Called when session status changes */
  readonly onStatusChange?: (status: ConnectionStatus) => void;
  /** Called on output data */
  readonly onData?: (data: string) => void;
  /** Called on fatal error */
  readonly onError?: (error: string) => void;
}

/** Return value of the useTerminalSession hook */
export interface UseTerminalSessionReturn {
  /** Current session snapshot */
  readonly snapshot: TerminalSessionSnapshot;
  /** Connect to the session */
  readonly connect: () => Promise<void>;
  /** Disconnect from the session */
  readonly disconnect: () => Promise<void>;
  /** Send input data to the session */
  readonly sendInput: (data: string) => void;
  /** Resize the terminal */
  readonly resize: (cols: number, rows: number) => void;
  /** Clear output history buffer */
  readonly clearHistory: () => void;
  /** Manually trigger reconnection */
  readonly reconnect: () => void;
}
