/**
 * TerminalSessionPanel — Unified terminal panel shell component
 *
 * Composes XTerminal (from components/terminal) with:
 *   - Status bar (connection indicator + error display)
 *   - Toolbar (connect/disconnect, clear, copy selection, quick commands)
 *   - useTerminalSession hook for full headless session management
 *
 * Pages only need to pass sessionType/targetId as thin parameters.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { Zap, Copy, Trash2, RotateCcw } from 'lucide-react';
import { XTerminal } from '../../components/terminal/XTerminal.js';
import type { XTerminalHandle } from '../../components/terminal/XTerminal.js';
import { useTerminalSession } from './use-terminal-session.js';
import { apiFetch } from '../../api/client.js';
import type {
  TerminalSessionConfig,
  SessionType,
  TerminalDimensions,
} from './terminal-session.types.js';

/** Quick command definitions per session type */
const QUICK_COMMANDS_MAP: Record<SessionType, readonly { readonly label: string; readonly cmd: string }[]> = {
  SSH_SHELL: [
    { label: 'htop', cmd: 'htop\n' },
    { label: 'df -h', cmd: 'df -h\n' },
    { label: 'free -h', cmd: 'free -h\n' },
    { label: 'top', cmd: 'top -bn1 | head -20\n' },
    { label: 'ls -la', cmd: 'ls -la\n' },
  ],
  MC_CONSOLE: [
    { label: 'list', cmd: 'list\n' },
    { label: 'tps', cmd: 'tps\n' },
    { label: 'stop', cmd: 'stop\n' },
    { label: 'reload', cmd: 'reload\n' },
  ],
  PTY_SHELL: [
    { label: 'htop', cmd: 'htop\n' },
    { label: 'ls', cmd: 'ls -la\n' },
    { label: 'top', cmd: 'top -bn1 | head -20\n' },
  ],
  ATTACH_SHELL: [
    { label: 'ls', cmd: 'ls -la\n' },
  ],
};

interface TerminalSessionPanelProps {
  /** Session type (MC_CONSOLE, SSH_SHELL, PTY_SHELL, ATTACH_SHELL) */
  readonly sessionType: SessionType;
  /** Target server/resource id */
  readonly targetId: string;
  /** Optional initial dimensions */
  readonly dimensions?: TerminalDimensions;
  /** Optional extra params for PTY/attach sessions */
  readonly params?: Record<string, string>;
  /** Auto-connect on mount (default: true) */
  readonly autoConnect?: boolean;
  /** Show toolbar (default: true) */
  readonly showToolbar?: boolean;
  /** Custom quick commands (overrides type defaults) */
  readonly quickCommands?: readonly { readonly label: string; readonly cmd: string }[];
  /** Custom className */
  readonly className?: string;
}

export function TerminalSessionPanel({
  sessionType,
  targetId,
  dimensions,
  params,
  autoConnect,
  showToolbar = true,
  quickCommands,
  className,
}: TerminalSessionPanelProps) {
  const termRef = useRef<XTerminalHandle>(null);
  const resizeRef = useRef<{ cols: number; rows: number } | null>(null);
  const [initialLines, setInitialLines] = useState<readonly string[]>([]);
  const lineBufferRef = useRef('');

  const config: TerminalSessionConfig = {
    sessionType,
    targetId,
    dimensions,
    params,
    autoConnect: autoConnect ?? true,
  };

  const session = useTerminalSession({
    config,
    onData: useCallback((data: string) => {
      termRef.current?.write(data);
    }, []),
    onError: useCallback((error: string) => {
      termRef.current?.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
    }, []),
  });

  const { snapshot, connect, disconnect, sendInput, resize, clearHistory, reconnect } = session;

  useEffect(() => {
    if (sessionType !== 'MC_CONSOLE') return;
    apiFetch<{ lines: string[] }>(`/servers/${encodeURIComponent(targetId)}/output`)
      .then((res) => setInitialLines(res.lines ?? []))
      .catch(() => {});
  }, [sessionType, targetId]);

  // Terminal input handler
  const handleTerminalData = useCallback((data: string) => {
    if (sessionType === 'MC_CONSOLE') {
      for (const ch of data) {
        if (ch === '\r') {
          // Send the accumulated line + newline to the server
          const line = lineBufferRef.current;
          lineBufferRef.current = '';
          sendInput(line + '\n');
        } else if (ch === '\x7f' || ch === '\b') {
          // Backspace: remove last character from buffer
          if (lineBufferRef.current.length > 0) {
            lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          }
        } else if (ch >= ' ') {
          // Printable character: add to buffer
          lineBufferRef.current += ch;
        }
      }
    } else {
      sendInput(data);
    }
  }, [sendInput, sessionType]);

  // Terminal resize handler
  const handleTerminalReady = useCallback(() => {
    // Dimensions are handled by XTerminal internally; we just sync to server
  }, []);

  // Watch for dimension changes from XTerminal's ResizeObserver
  // We need to capture the fit dimensions and propagate to server
  useEffect(() => {
    const container = document.querySelector('[data-terminal-session-panel]');
    if (!container) return;

    const observer = new ResizeObserver(() => {
      // XTerminal handles its own fit; we read the terminal's cols/rows
      // This is a fallback — the XTerminal's onData doesn't expose resize
      // So we use the ResizeObserver to detect container size changes
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const commands = quickCommands ?? QUICK_COMMANDS_MAP[sessionType] ?? [];

  const isConnected = snapshot.status === 'ACTIVE';
  const isConnecting = snapshot.status === 'CONNECTING';
  const isError = snapshot.status === 'ERROR';
  const isDisconnected = snapshot.status === 'DISCONNECTED';

  const statusColor =
    isConnected ? 'bg-success-400' :
    isConnecting ? 'bg-warning-400' :
    isError ? 'bg-danger-400' :
    'bg-gray-400';

  const statusText =
    isConnected ? '已连接' :
    isConnecting ? '连接中...' :
    isError ? (snapshot.error ?? '连接错误') :
    isDisconnected ? '已断开' :
    snapshot.status;

  return (
    <div
      data-terminal-session-panel
      className={`flex flex-col h-full rounded-2xl overflow-hidden border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-gray-900/60 backdrop-blur-xl shadow-xl relative z-0 ${className ?? ''}`}
    >
      {/* Status bar + toolbar */}
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-white/55 dark:border-primary-300/20 bg-white/65 dark:bg-gray-900/50 shrink-0">
          {/* Status indicator */}
          <span className={`w-2 h-2 rounded-full ${statusColor} shadow-sm`} />
          <span className={`text-xs font-medium ${isError ? 'text-danger-500 dark:text-danger-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {statusText}
          </span>

          {/* Connect / Disconnect / Reconnect buttons */}
          {(isDisconnected || isError) && !snapshot.isReconnecting && (
            <button
              onClick={isError ? reconnect : connect}
              className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:scale-95 transition-all shadow-sm font-medium ml-1"
            >
              {isError ? '重连' : '连接'}
            </button>
          )}

          {snapshot.isReconnecting && (
            <span className="text-xs text-warning-500 dark:text-warning-400 flex items-center gap-1 font-medium ml-1">
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              重连中 ({snapshot.reconnectAttempts})
            </span>
          )}

          {isConnected && (
            <button
              onClick={disconnect}
              className="px-3 py-1 text-xs bg-danger-600 text-white rounded-lg hover:bg-danger-700 active:scale-95 transition-all shadow-sm font-medium ml-1"
            >
              断开
            </button>
          )}

          {/* Separator */}
          {isConnected && <span className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />}

          {/* Quick commands */}
          {isConnected && commands.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              {commands.map((q) => (
                <button
                  key={q.label}
                  onClick={() => sendInput(q.cmd)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all shadow-sm"
                  title={q.cmd.trim()}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 min-w-[1rem]" />

          {/* History line count */}
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-2 font-medium">
            {snapshot.historyLineCount > 0 && `${snapshot.historyLineCount} 行`}
          </span>

          {/* Action buttons */}
          {isConnected && (
            <div className="flex items-center gap-1 bg-white/50 dark:bg-gray-800/50 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => termRef.current?.clear()}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="清屏"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const selection = window.getSelection()?.toString();
                  if (selection) {
                    navigator.clipboard.writeText(selection);
                  }
                }}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="复制选中"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Terminal area */}
      <div className="flex-1 min-h-0 relative p-1.5 bg-[var(--terminal-bg)] rounded-b-2xl z-0">
        <XTerminal
          ref={termRef}
          readonly={isDisconnected || isError || isConnecting}
          localEcho={sessionType === 'MC_CONSOLE'}
          initialLines={initialLines}
          onData={handleTerminalData}
          onReady={handleTerminalReady}
          className="h-full w-full rounded-xl overflow-hidden"
        />
      </div>
    </div>
  );
}
