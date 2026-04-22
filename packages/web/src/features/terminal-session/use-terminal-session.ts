/**
 * useTerminalSession — Headless terminal session hook
 *
 * Manages the full lifecycle of a terminal session:
 * - Connect/disconnect via API
 * - WebSocket data/resize subscriptions
 * - Output history buffering
 * - Auto-reconnect on unexpected disconnect
 * - Terminal resize propagation
 *
 * Usage:
 *   const session = useTerminalSession({ config: { sessionType: 'SSH_SHELL', targetId: '...' } });
 *   // In a xterm setup: session.sendInput(data)
 *   // On resize: session.resize(cols, rows)
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { WsChannel } from '@jian-agent/shared-protocol';
import { wsClient } from '../../ws/ws-client.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import { apiFetch } from '../../api/client.js';
import { useTerminalSessionStore } from './terminal-session.store.js';
import type {
  TerminalSessionConfig,
  UseTerminalSessionOptions,
  UseTerminalSessionReturn,
  TerminalSessionSnapshot,
  ConnectionStatus,
  TerminalDimensions,
} from './terminal-session.types.js';

/** API response shape for session creation */
interface SessionCreateResponse {
  readonly success: boolean;
  readonly sessionId: string;
}

/** Default options */
const DEFAULT_MAX_HISTORY = 10_000;
const DEFAULT_MAX_RECONNECT = 10;
const DEFAULT_RECONNECT_DELAY = 1000;

/**
 * Maps session type to the API endpoint for creating a session.
 */
function getCreateEndpoint(config: TerminalSessionConfig): { method: string; path: string; body?: string } | null {
  switch (config.sessionType) {
    case 'SSH_SHELL':
      return {
        method: 'POST',
        path: `/servers/${encodeURIComponent(config.targetId)}/ssh/connect`,
      };
    case 'MC_CONSOLE':
      return null;
    case 'PTY_SHELL':
      return {
        method: 'POST',
        path: `/servers/${encodeURIComponent(config.targetId)}/pty/shell`,
        body: JSON.stringify(config.params ?? {}),
      };
    case 'ATTACH_SHELL':
      return {
        method: 'POST',
        path: `/servers/${encodeURIComponent(config.targetId)}/attach`,
        body: JSON.stringify(config.params ?? {}),
      };
    default:
      throw new Error(`Unknown session type: ${config.sessionType}`);
  }
}

/**
 * Maps session type to the API endpoint for disconnecting.
 */
function getDisconnectEndpoint(config: TerminalSessionConfig, sessionId: string): { method: string; path: string } | null {
  switch (config.sessionType) {
    case 'SSH_SHELL':
      return {
        method: 'DELETE',
        path: `/servers/${encodeURIComponent(config.targetId)}/ssh/disconnect?sessionId=${encodeURIComponent(sessionId)}`,
      };
    case 'MC_CONSOLE':
      return null;
    case 'PTY_SHELL':
      return {
        method: 'DELETE',
        path: `/servers/${encodeURIComponent(config.targetId)}/pty/shell?sessionId=${encodeURIComponent(sessionId)}`,
      };
    case 'ATTACH_SHELL':
      return {
        method: 'DELETE',
        path: `/servers/${encodeURIComponent(config.targetId)}/detach?sessionId=${encodeURIComponent(sessionId)}`,
      };
    default:
      throw new Error(`Unknown session type: ${config.sessionType}`);
  }
}



export function useTerminalSession(
  options: UseTerminalSessionOptions,
): UseTerminalSessionReturn {
  const {
    config,
    maxHistoryLines = DEFAULT_MAX_HISTORY,
    autoReconnect = true,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT,
    reconnectBaseDelay = DEFAULT_RECONNECT_DELAY,
    onStatusChange,
    onData,
    onError,
  } = options;

  const store = useTerminalSessionStore();
  const sessionIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const historyBufferRef = useRef<string[]>([]);

  const callbacksRef = useRef({ onStatusChange, onData, onError });
  callbacksRef.current = { onStatusChange, onData, onError };

  // Generate a unique store key (config-driven, not sessionId-driven since it may not exist yet)
  const storeKey = sessionIdRef.current ?? '__pending__';
  const snapshot: TerminalSessionSnapshot = store.sessions[storeKey] ?? {
    sessionId: '',
    sessionType: config.sessionType,
    targetId: config.targetId,
    status: 'DISCONNECTED',
    error: null,
    dimensions: config.dimensions ?? { cols: 80, rows: 24 },
    historyLineCount: 0,
    isReconnecting: false,
    reconnectAttempts: 0,
    lastActivityAt: null,
  };

  // ── Connect ──
  const connect = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (sid) {
      // Already connected or connecting
      const existing = store.sessions[sid];
      if (existing && (existing.status === 'ACTIVE' || existing.status === 'CONNECTING')) {
        return;
      }
    }

    intentionalCloseRef.current = false;
    clearReconnectTimer();

    const tmpId = `__pending__`;
    store.addSession(tmpId, config.sessionType, config.targetId, config.dimensions);
    store.setStatus(tmpId, 'CONNECTING');

    try {
      let realSessionId = '';
      if (config.sessionType === 'MC_CONSOLE') {
        // MC_CONSOLE is managed by ProcessManagerService automatically.
        realSessionId = `mc:${config.targetId}`;
      } else {
        const endpoint = getCreateEndpoint(config);
        if (endpoint) {
          const res = await apiFetch<SessionCreateResponse>(endpoint.path, {
            method: endpoint.method,
            ...(endpoint.body ? { body: endpoint.body } : {}),
          });
          realSessionId = res.sessionId;
        } else {
          realSessionId = `mc:${config.targetId}`;
        }
      }
      // Remove temp entry, add real one
      store.removeSession(tmpId);
      sessionIdRef.current = realSessionId;
      reconnectCountRef.current = 0;

      store.addSession(realSessionId, config.sessionType, config.targetId, config.dimensions);
      store.setStatus(realSessionId, 'ACTIVE');

      // Subscribe to session output via WS
      wsClient.send({
        channel: 'terminal-session:subscribe',
        sessionId: realSessionId,
        payload: { sessionId: realSessionId },
      });

      callbacksRef.current.onStatusChange?.('ACTIVE');
    } catch (err: unknown) {
      store.removeSession(tmpId);
      const msg = err instanceof Error ? err.message : '连接失败';
      store.setStatus('__pending__', 'ERROR', msg);
      callbacksRef.current.onStatusChange?.('ERROR');
      callbacksRef.current.onError?.(msg);
    }
  }, [config, store]);

  // ── Disconnect ──
  const disconnect = useCallback(async () => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();

    const sid = sessionIdRef.current;
    if (!sid) return;

    try {
      if (config.sessionType !== 'MC_CONSOLE') {
        const endpoint = getDisconnectEndpoint(config, sid);
        if (endpoint) {
          await apiFetch<{ success: boolean }>(endpoint.path, {
            method: endpoint.method,
          });
        }
      }
    } catch {
      // Best-effort disconnect
    }

    // Unsubscribe from WS
    wsClient.send({
      channel: 'terminal-session:unsubscribe',
      sessionId: sid,
      payload: { sessionId: sid },
    });

    store.setStatus(sid, 'DISCONNECTED');
    callbacksRef.current.onStatusChange?.('DISCONNECTED');
    sessionIdRef.current = null;
  }, [config, store]);

  // ── Send input ──
  const sendInput = useCallback((data: string) => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    wsClient.send({
      channel: WsChannel.TERMINAL_SESSION_INPUT,
      sessionId: sid,
      payload: { sessionId: sid, serverId: config.targetId, data },
    });
  }, [config.targetId]);

  // ── Resize ──
  const resize = useCallback((cols: number, rows: number) => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    store.setDimensions(sid, { cols, rows });

    wsClient.send({
      channel: WsChannel.TERMINAL_SESSION_RESIZE,
      sessionId: sid,
      payload: { sessionId: sid, cols, rows },
    });
  }, [store]);

  // ── Clear history ──
  const clearHistory = useCallback(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    historyBufferRef.current = [];
    store.resetHistory(sid);
  }, [store]);

  // ── Reconnect ──
  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const scheduleReconnect = useCallback(() => {
    if (!autoReconnect || intentionalCloseRef.current) return;
    if (reconnectCountRef.current >= maxReconnectAttempts) {
      const sid = sessionIdRef.current;
      if (sid) {
        store.setStatus(sid, 'ERROR', '重连次数已达上限');
        store.setReconnecting(sid, false, reconnectCountRef.current);
      }
      callbacksRef.current.onError?.('重连次数已达上限');
      return;
    }

    const delay = Math.min(
      reconnectBaseDelay * 2 ** reconnectCountRef.current,
      30_000,
    );
    reconnectCountRef.current++;

    const sid = sessionIdRef.current;
    if (sid) {
      store.setReconnecting(sid, true, reconnectCountRef.current);
    }

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      // Re-use connect which handles the full lifecycle
      connect().catch(() => {
        // connect will call scheduleReconnect on failure via status change
      });
    }, delay);
  }, [autoReconnect, maxReconnectAttempts, reconnectBaseDelay, connect, store]);

  const reconnect = useCallback(() => {
    reconnectCountRef.current = 0;
    clearReconnectTimer();
    disconnect().then(() => connect());
  }, [disconnect, connect]);

  // ── WS data subscription ──
  const handleData = useCallback((payload: { sessionId?: string; data?: string }) => {
    const sid = sessionIdRef.current;
    if (!sid || !payload.data) return;

    // Only handle data for our session
    if (payload.sessionId && payload.sessionId !== sid) return;

    // Buffer history
    historyBufferRef.current.push(payload.data);
    if (historyBufferRef.current.length > maxHistoryLines) {
      historyBufferRef.current = historyBufferRef.current.slice(-maxHistoryLines);
    }
    useTerminalSessionStore.getState().incrementHistory(sid);
    useTerminalSessionStore.getState().touchActivity(sid);
    callbacksRef.current.onData?.(payload.data);
  }, [maxHistoryLines]);

  useWsChannel(WsChannel.TERMINAL_SESSION_DATA, handleData);

  // ── Auto-reconnect on unexpected disconnect ──
  const handleStatusData = useCallback((payload: { sessionId?: string; state?: string }) => {
    const sid = sessionIdRef.current;
    if (!sid || !payload.state) return;
    if (payload.sessionId && payload.sessionId !== sid) return;

    if (payload.state === 'DISCONNECTED' || payload.state === 'CLOSED' || payload.state === 'ERROR') {
      if (!intentionalCloseRef.current) {
        scheduleReconnect();
      }
    }
  }, [scheduleReconnect]);

  useWsChannel('resource:session:state', handleStatusData);

  // ── Auto-connect on mount ──
  useEffect(() => {
    if (config.autoConnect !== false) {
      connect();
    }

    return () => {
      // Cleanup: intentional disconnect on unmount
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      const sid = sessionIdRef.current;
      if (sid) {
        // Best-effort server-side cleanup
        if (config.sessionType !== 'MC_CONSOLE') {
          const endpoint = getDisconnectEndpoint(config, sid);
          if (endpoint) {
            apiFetch(endpoint.path, { method: endpoint.method }).catch(() => {});
          }
        }
        store.removeSession(sid);
      }
      sessionIdRef.current = null;
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Snapshot ──
  const liveSnapshot = useMemo((): TerminalSessionSnapshot => {
    const sid = sessionIdRef.current;
    if (sid && store.sessions[sid]) {
      return store.sessions[sid];
    }
    return snapshot;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.sessions, sessionIdRef.current]);

  return {
    snapshot: liveSnapshot,
    connect,
    disconnect,
    sendInput,
    resize,
    clearHistory,
    reconnect,
  };
}
