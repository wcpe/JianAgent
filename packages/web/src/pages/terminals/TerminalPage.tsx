import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { McConsoleTerm } from './McConsoleTerm.js';
import { PtyShellTerm } from './PtyShellTerm.js';
import { LogReplayTab } from '../servers/LogReplayTab.js';
import { AuditTab } from '../servers/AuditTab.js';
import { PlayerListTab } from '../servers/PlayerListTab.js';
import { useServerStore } from '../../stores/server.store.js';
import { useServerContext } from '../../stores/server-context.store.js';
import { serverApi, type SshSessionsResponse, type SshStatusResponse } from '../../api/server.api.js';

const TABS = [
  { id: 'mc-console', label: 'MC Console' },
  { id: 'log-replay', label: '日志回放' },
  { id: 'audit', label: '命令审计' },
  { id: 'players', label: '在线玩家' },
] as const;

const STATUS_DOT: Record<string, string> = {
  running: 'bg-success-500',
  stopped: 'bg-gray-400',
  error: 'bg-danger-500',
};

export function TerminalPage() {
  const [params, setParams] = useSearchParams();
  const qsServerId = params.get('serverId');
  const contextServerId = useServerContext((s) => s.activeServerId);
  const allServers = useServerStore((s) => s.servers);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const servers = allServers.filter((s) => s.serverType !== 'external');

  const [serverId, setServerIdRaw] = useState(qsServerId ?? contextServerId ?? '');
  const [activeTab, setActiveTab] = useState<string>(params.get('tab') ?? 'mc-console');
  const [fontSize, setFontSize] = useState(14);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sshStatus, setSshStatus] = useState<SshStatusResponse | null>(null);
  const [sshSessions, setSshSessions] = useState<SshSessionsResponse['sessions']>([]);
  const [disconnectingSessionId, setDisconnectingSessionId] = useState<string | null>(null);
  const [sshHint, setSshHint] = useState('');

  const setServerId = useCallback(
    (id: string) => { setServerIdRaw(id); setParams((p) => { p.set('serverId', id); return p; }); },
    [setParams],
  );

  useEffect(() => { fetchServers(); }, [fetchServers]);
  useEffect(() => {
    if (qsServerId) { setServerIdRaw(qsServerId); return; }
    if (contextServerId) { setServerIdRaw(contextServerId); return; }
    const first = servers.find((s) => s.runtimeStatus === 'running') ?? servers[0];
    if (first && !serverId) setServerId(first.id);
  }, [qsServerId, contextServerId, servers, serverId, setServerId]);

  useEffect(() => {
    if (!serverId) {
      setSshStatus(null);
      setSshSessions([]);
      setSshHint('');
      return;
    }

    let cancelled = false;
    const loadSshStatus = async () => {
      try {
        const [status, sessionData] = await Promise.all([
          serverApi.sshStatus(serverId),
          serverApi.sshSessions(serverId),
        ]);
        if (cancelled) return;
        setSshStatus(status);
        setSshSessions(sessionData.sessions);
        if (status.observability.activeSessionsForServer >= status.observability.perServerQuota) {
          setSshHint('当前服务器 SSH 会话已达到配额上限，可能无法再新建会话。');
          return;
        }
        if (!status.connected && status.observability.activeSessionsForServer === 0) {
          setSshHint('当前未建立 SSH 连接，若需远程维护请先在服务器工作台发起连接。');
          return;
        }
        setSshHint('');
      } catch {
        if (!cancelled) {
          setSshStatus(null);
          setSshSessions([]);
          setSshHint('SSH 状态暂时不可用，请稍后重试。');
        }
      }
    };

    loadSshStatus();
    const timer = setInterval(loadSshStatus, 10_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [serverId]);

  const handleDisconnectSession = useCallback(async (sessionId: string) => {
    if (!serverId || disconnectingSessionId) return;
    setDisconnectingSessionId(sessionId);
    try {
      await serverApi.sshDisconnect(serverId, sessionId);
      setSshSessions((prev) => prev.filter((session) => session.sessionId !== sessionId));
      setSshHint('已断开指定 SSH 会话。');
    } catch {
      setSshHint('断开 SSH 会话失败，请稍后重试。');
    } finally {
      setDisconnectingSessionId(null);
    }
  }, [disconnectingSessionId, serverId]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
    setIsFullscreen((v) => !v);
  }, []);

  /* ── Empty state ── */
  if (servers.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-800">
        <p className="text-gray-500 dark:text-gray-400">暂无服务器，请先在服务器工作台添加</p>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-3 p-3">
      {/* ── Left: Server list panel ── */}
      <aside className="w-[200px] shrink-0 flex flex-col rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-gray-900/60 backdrop-blur-xl shadow-xl">
        <h2 className="px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700">
          服务器
        </h2>
        <ul className="flex-1 overflow-y-auto py-1">
          {servers.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setServerId(s.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  serverId === s.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500 text-gray-900 dark:text-gray-100'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className={`inline-block w-2 h-2 shrink-0 rounded-full ${STATUS_DOT[s.runtimeStatus] ?? 'bg-gray-400'}`} />
                <span className="truncate">{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Right: Tabs + Toolbar + Terminal ── */}
      <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-gray-900/60 backdrop-blur-xl shadow-xl overflow-hidden relative z-0">
        {/* Tab bar & Toolbar */}
        <div className="flex shrink-0 items-center gap-4 px-4 py-2 border-b border-white/55 dark:border-primary-300/20 bg-white/65 dark:bg-gray-900/50">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Toolbar */}
          <div className="ml-auto flex items-center gap-2 px-2 py-1">
            <div className="flex items-center gap-1 bg-white/50 dark:bg-gray-800/50 rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
              <button onClick={() => setFontSize((v) => Math.max(10, v - 1))} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors" title="缩小字体">A−</button>
              <span className="text-xs text-gray-600 dark:text-gray-300 min-w-[2rem] text-center font-mono">{fontSize}px</span>
              <button onClick={() => setFontSize((v) => Math.min(24, v + 1))} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors" title="放大字体">A+</button>
            </div>
            <button onClick={toggleFullscreen} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200" title="全屏">
              {isFullscreen ? '⊡' : '⊞'}
            </button>
          </div>
        </div>

        {sshStatus && (
          <div className="flex shrink-0 items-center gap-4 border-b border-white/55 dark:border-primary-300/20 bg-gray-50/90 dark:bg-gray-950/70 px-3 py-2 text-xs text-gray-700 dark:text-gray-200">
            <span>
              SSH 会话: <strong>{sshStatus.observability.activeSessionsForServer}</strong> / {sshStatus.observability.perServerQuota}
            </span>
            <span>
              平台总会话: <strong>{sshStatus.observability.totalActiveSessions}</strong>
            </span>
            <span className="truncate">
              活跃会话ID: {sshStatus.observability.activeSessionBriefIds.length > 0 ? sshStatus.observability.activeSessionBriefIds.join(', ') : '无'}
            </span>
          </div>
        )}

        {sshHint && (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
            {sshHint}
          </div>
        )}

        {sshSessions.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/55 dark:border-primary-300/20 bg-gray-100/90 dark:bg-gray-900/70 px-3 py-2 text-xs text-gray-700 dark:text-gray-200">
            <span className="font-medium">会话明细</span>
            {sshSessions.map((session) => {
              const idleSeconds = Math.floor(session.idleForMs / 1000);
              return (
                <div key={session.sessionId} className="inline-flex items-center gap-2 rounded-full border border-gray-300/80 bg-white/80 px-2 py-1 dark:border-gray-700 dark:bg-gray-800/80">
                  <span>{session.sessionBriefId}</span>
                  <span className="text-gray-500 dark:text-gray-400">空闲 {idleSeconds}s</span>
                  <button
                    type="button"
                    onClick={() => handleDisconnectSession(session.sessionId)}
                    disabled={disconnectingSessionId !== null}
                    className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rose-900/40 dark:text-rose-300"
                  >
                    {disconnectingSessionId === session.sessionId ? '断开中' : '断开'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Terminal area (always dark) */}
        <div className="flex-1 relative bg-[var(--terminal-bg)] p-1.5 min-h-0 z-0" style={{ fontSize }}>
            <div className={`h-full w-full rounded-xl overflow-hidden relative ${activeTab === 'mc-console' ? 'block' : 'hidden'}`}>
              <McConsoleTerm serverId={serverId || undefined} />
            </div>
            <div className={`h-full w-full rounded-xl overflow-hidden relative ${activeTab === 'pty-shell' ? 'block' : 'hidden'}`}>
              <PtyShellTerm serverId={serverId || undefined} />
            </div>
            {activeTab === 'log-replay' && serverId && (
              <div className="h-full w-full rounded-xl overflow-auto relative z-0">
                <LogReplayTab serverId={serverId} />
              </div>
            )}
            {activeTab === 'audit' && serverId && (
              <div className="h-full w-full rounded-xl overflow-auto relative z-0">
                <AuditTab serverId={serverId} />
              </div>
            )}
            {activeTab === 'players' && serverId && (
              <div className="h-full w-full rounded-xl overflow-auto relative z-0">
                <PlayerListTab serverId={serverId} />
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
