import { useState, useRef, useCallback, useEffect } from 'react';
import type { ServerWithStatusDto } from '@jian-agent/shared-domain';
import { ServerStatusPill } from '../../components/ServerStatusPill.js';
import { MotdRenderer, PingBars } from '../../components/MotdRenderer.js';
import { ServerCardActions } from './ServerCardActions.js';
import { ServerLogPreview } from './ServerLogPreview.js';
import { populationApi, type PopulationRecord } from '../../api/population.api.js';
import { formatServerAddress } from '../../constants/server-defaults.js';

interface ServerCardProps {
  readonly server: ServerWithStatusDto;
  readonly index?: number;
  readonly onEdit: () => void;
  readonly onTerminal: () => void;
  readonly isSelected?: boolean;
  readonly onToggleSelect?: () => void;
}

function formatUptime(ms?: number): string {
  if (!ms) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

function McServerBanner({ server }: { readonly server: ServerWithStatusDto }) {
  const isOnline = server.runtimeStatus === 'running';
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    tooltipTimer.current = setTimeout(() => setShowTooltip(true), 300);
  }, []);
  const handleLeave = useCallback(() => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setShowTooltip(false);
  }, []);

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <div className="bg-[#2b2b2b] rounded-md p-3 flex gap-3 items-center font-mono text-sm border border-[#3a3a3a]">
        {/* Favicon / Default Icon */}
        <div className="w-12 h-12 flex-shrink-0 rounded bg-[#1a1a1a] flex items-center justify-center overflow-hidden">
          {server.favicon ? (
            <img src={server.favicon} alt="icon" className="w-full h-full object-cover pixelated" />
          ) : (
            <span className="text-2xl text-gray-500">⬛</span>
          )}
        </div>

        {/* Name + MOTD */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold truncate">{server.name}</div>
          <div className="truncate leading-snug mt-0.5">
            <MotdRenderer
              motdRaw={server.motdRaw}
              fallback={server.motd}
              className="text-gray-300"
            />
          </div>
        </div>

        {/* Players + Ping */}
        <div className="flex-shrink-0 text-right space-y-1">
          <div className={`text-xs ${isOnline ? 'text-gray-300' : 'text-danger-400'}`}>
            {isOnline
              ? `${server.onlinePlayers ?? 0}/${server.maxPlayers ?? 0}`
              : '离线'}
          </div>
          <div className="flex justify-end">
            <PingBars latencyMs={server.latencyMs} />
          </div>
        </div>
      </div>

      {/* MC-style hover tooltip */}
      {showTooltip && (
        <div className="absolute z-50 left-0 top-full mt-1 bg-[#100010] border-2 border-[#5020d0] rounded p-3 font-mono text-xs shadow-xl min-w-[260px] max-w-[360px]">
          <div className="text-white font-bold mb-1">{server.name}</div>
          <div className="mb-1">
            <MotdRenderer motdRaw={server.motdRaw} fallback={server.motd} className="text-gray-300" />
          </div>
          <div className="border-t border-[#5020d0]/30 my-1.5" />
          <div className="text-gray-400 space-y-0.5">
            <p>地址: <span className="text-gray-200">{formatServerAddress(server.host, server.port)}</span></p>
            {server.version && <p>版本: <span className="text-gray-200">{server.version}</span></p>}
            <p>玩家: <span className="text-gray-200">{server.onlinePlayers ?? 0} / {server.maxPlayers ?? 0}</span></p>
            {server.latencyMs != null && <p>延迟: <span className={server.latencyMs < 100 ? 'text-success-400' : server.latencyMs < 300 ? 'text-warning-400' : 'text-danger-400'}>{server.latencyMs}ms</span></p>}
            {server.serverType === 'external' && <p className="text-blue-400">外置服务器</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function PopulationMiniChart({ serverId }: { readonly serverId: string }) {
  const [show, setShow] = useState(false);
  const [data, setData] = useState<PopulationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetched = useRef(false);

  const handleEnter = useCallback(() => {
    timer.current = setTimeout(() => {
      setShow(true);
      if (!fetched.current) {
        fetched.current = true;
        setLoading(true);
        const start = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        populationApi.getHistory({ serverId, startTime: start, limit: 120 })
          .then((r) => setData(r))
          .catch(() => setData([]))
          .finally(() => setLoading(false));
      }
    }, 300);
  }, [serverId]);

  const handleLeave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setShow(false);
  }, []);

  const max = data.length > 0 ? Math.max(...data.map((d) => d.onlinePlayers), 1) : 1;

  return (
    <span className="relative inline-block" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <span className="text-primary-500 dark:text-primary-400 cursor-pointer hover:underline">历史人数</span>
      {show && (
        <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a2e] border border-[#5020d0] rounded-lg p-3 shadow-xl min-w-[260px]">
          <div className="text-xs text-gray-300 font-bold mb-1.5">最近 1 小时在线人数</div>
          {loading ? (
            <div className="text-xs text-gray-500 text-center py-4">加载中...</div>
          ) : data.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-4">暂无数据</div>
          ) : (
            <div className="flex items-end gap-px h-12">
              {data.map((d, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary-500/70 rounded-t-sm min-w-[2px] transition-all"
                  style={{ height: `${(d.onlinePlayers / max) * 100}%` }}
                  title={`${new Date(d.timestamp).toLocaleTimeString()}: ${d.onlinePlayers}人`}
                />
              ))}
            </div>
          )}
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>{data.length > 0 ? new Date(data[0].timestamp).toLocaleTimeString() : ''}</span>
            <span>{data.length > 0 ? new Date(data[data.length - 1].timestamp).toLocaleTimeString() : ''}</span>
          </div>
        </div>
      )}
    </span>
  );
}

export function ServerCard({ server, index = 0, onEdit, onTerminal, isSelected, onToggleSelect }: ServerCardProps) {
  const status = (server.runtimeStatus ?? 'unknown') as
    'running' | 'starting' | 'stopping' | 'stopped' | 'error' | 'unknown';
  const isExternal = server.serverType === 'external';

  return (
    <div
      className={`relative rounded-xl transition-all duration-300 animate-card-enter cursor-pointer
        ${isSelected ? 'scale-[1.01] shadow-lg' : 'hover:scale-[1.01] hover:shadow-md'}`}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={(e) => {
        // Prevent click when clicking buttons inside the card
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
          return;
        }
        // Also check if we are clicking on some text that is being selected
        if (window.getSelection()?.toString().length) {
          return;
        }
        onToggleSelect?.();
      }}
      onDoubleClick={(e) => {
        // Prevent double click when interacting with action buttons
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
          return;
        }
        // clear selection so we enter cleanly
        if (window.getSelection) {
          window.getSelection()?.removeAllRanges();
        }
        
        // Prevent triggering the onClick again
        e.preventDefault();
        e.stopPropagation();
        
        onTerminal();
      }}
    >
      {/* Gradient Selection Border */}
      <div
        className={`absolute inset-[-3px] rounded-[14px] bg-gradient-to-r from-primary-400 via-emerald-400 to-primary-600 animate-gradient-flow opacity-0 transition-opacity duration-300 pointer-events-none ${
          isSelected ? 'opacity-100' : ''
        }`}
      />

      {/* Main Card Container */}
      <div className="relative h-full bg-white dark:bg-gray-800 rounded-xl flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{server.name}</h3>
        <ServerStatusPill status={status} />
      </div>

      {/* Group and Tags */}
      {(server.serverGroup || (server.tags && server.tags.length > 0)) && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {server.serverGroup && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
              {server.serverGroup}
            </span>
          )}
          {server.tags?.map((tag) => (
            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* MC-style banner for running servers (both external and managed) */}
      {(isExternal || status === 'running') && server.motdRaw && (
        <div className="px-4 pb-2">
          <McServerBanner server={server} />
        </div>
      )}

      {/* Info */}
      <div className="px-4 pb-2 text-xs text-gray-500 dark:text-gray-400">
        {isExternal ? (
          <div className="space-y-1">
            <p className="text-blue-500 dark:text-blue-400 font-medium">外置服务器</p>
            <p>{formatServerAddress(server.host, server.port)}</p>
            {server.version && <p>版本: {server.version}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <span className="text-gray-400 dark:text-gray-500">地址</span>
            <span className="text-gray-700 dark:text-gray-300">{formatServerAddress(server.host, server.port)}</span>
            <span className="text-gray-400 dark:text-gray-500">Jar</span>
            <span className="truncate text-gray-700 dark:text-gray-300" title={server.jarPath ?? '—'}>{server.jarPath ?? '—'}</span>
            <span className="text-gray-400 dark:text-gray-500">目录</span>
            <span className="truncate text-gray-700 dark:text-gray-300" title={server.workDir ?? '—'}>{server.workDir ?? '—'}</span>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
        {isExternal ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>在线: {server.onlinePlayers ?? '?'}/{server.maxPlayers ?? '?'}</span>
            {server.latencyMs != null && <span>延迟: {server.latencyMs}ms</span>}
            <PopulationMiniChart serverId={server.id} />
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>PID: {server.pid ?? '—'}</span>
            <span>运行: {formatUptime(server.uptime)}</span>
            <span>重启: {server.restartCount ?? 0}</span>
            {status === 'running' && <PopulationMiniChart serverId={server.id} />}
          </div>
        )}
      </div>

      {/* Log Preview */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
        <ServerLogPreview serverId={server.id} />
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 mt-auto">
        <ServerCardActions
          server={server}
          onEdit={onEdit}
          onTerminal={onTerminal}
        />
      </div>
      </div>
    </div>
  );
}
