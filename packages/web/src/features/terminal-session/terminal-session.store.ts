/**
 * Terminal Session Store
 *
 * Zustand store for managing multiple terminal sessions' state.
 * Each session is keyed by its sessionId and tracks connection status,
  dimensions, history metadata, and error state.
 */

import { create } from 'zustand';
import type {
  TerminalSessionSnapshot,
  ConnectionStatus,
  TerminalDimensions,
  SessionType,
} from './terminal-session.types.js';

interface TerminalSessionState {
  /** Map of sessionId → session snapshot */
  readonly sessions: Record<string, TerminalSessionSnapshot>;
}

interface TerminalSessionActions {
  /** Register a new session entry */
  addSession: (
    sessionId: string,
    sessionType: SessionType,
    targetId: string,
    dimensions?: TerminalDimensions,
  ) => void;
  /** Remove a session entry */
  removeSession: (sessionId: string) => void;
  /** Update session status */
  setStatus: (sessionId: string, status: ConnectionStatus, error?: string | null) => void;
  /** Update session dimensions */
  setDimensions: (sessionId: string, dimensions: TerminalDimensions) => void;
  /** Increment history line count */
  incrementHistory: (sessionId: string, count?: number) => void;
  /** Reset history line count */
  resetHistory: (sessionId: string) => void;
  /** Update reconnect state */
  setReconnecting: (sessionId: string, isReconnecting: boolean, attempts: number) => void;
  /** Update last activity timestamp */
  touchActivity: (sessionId: string) => void;
  /** Get a session snapshot by id */
  getSession: (sessionId: string) => TerminalSessionSnapshot | undefined;
}

const DEFAULT_DIMENSIONS: TerminalDimensions = { cols: 80, rows: 24 };

export const useTerminalSessionStore = create<
  TerminalSessionState & TerminalSessionActions
>((set, get) => ({
  sessions: {},

  addSession: (sessionId, sessionType, targetId, dimensions) => {
    const now = new Date().toISOString();
    set((s) => ({
      sessions: {
        ...s.sessions,
        [sessionId]: {
          sessionId,
          sessionType,
          targetId,
          status: 'CONNECTING' as ConnectionStatus,
          error: null,
          dimensions: dimensions ?? DEFAULT_DIMENSIONS,
          historyLineCount: 0,
          isReconnecting: false,
          reconnectAttempts: 0,
          lastActivityAt: now,
        },
      },
    }));
  },

  removeSession: (sessionId) => {
    set((s) => {
      const { [sessionId]: _, ...rest } = s.sessions;
      return { sessions: rest };
    });
  },

  setStatus: (sessionId, status, error) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: { ...session, status, error: error ?? null },
        },
      };
    });
  },

  setDimensions: (sessionId, dimensions) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: { ...session, dimensions },
        },
      };
    });
  },

  incrementHistory: (sessionId, count = 1) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            historyLineCount: session.historyLineCount + count,
          },
        },
      };
    });
  },

  resetHistory: (sessionId) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: { ...session, historyLineCount: 0 },
        },
      };
    });
  },

  setReconnecting: (sessionId, isReconnecting, attempts) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: { ...session, isReconnecting, reconnectAttempts: attempts },
        },
      };
    });
  },

  touchActivity: (sessionId) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            lastActivityAt: new Date().toISOString(),
          },
        },
      };
    });
  },

  getSession: (sessionId) => {
    return get().sessions[sessionId];
  },
}));
