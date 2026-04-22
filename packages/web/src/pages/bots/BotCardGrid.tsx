import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Heart, MapPin, Wifi, Send, Terminal, Square, ChevronDown, ChevronRight, Skull, RotateCcw, AlertTriangle } from 'lucide-react';
import { botApi, type BotSnapshot } from '../../api/bot.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';

const stateColors: Record<string, string> = {
  CREATED: 'bg-yellow-500',
  CONNECTING: 'bg-yellow-500 animate-pulse',
  SPAWNED: 'bg-green-500',
  READY: 'bg-green-500',
  RUNNING_PHASE: 'bg-green-500',
  DEBUGGING: 'bg-purple-500',
  DEAD: 'bg-red-600',
  DISCONNECTED: 'bg-gray-500',
  FAILED: 'bg-red-500',
  STOPPED: 'bg-gray-500',
};

const stateLabels: Record<string, string> = {
  CREATED: '已创建',
  CONNECTING: '连接中',
  SPAWNED: '已生成',
  READY: '就绪',
  RUNNING_PHASE: '运行中',
  DEBUGGING: '调试中',
  DEAD: '已死亡',
  DISCONNECTED: '已断开',
  FAILED: '失败',
  STOPPED: '已停止',
};

interface BotCardGridProps {
  readonly bots: readonly BotSnapshot[];
  readonly onStop: (name: string) => void;
  readonly onSelect: (name: string) => void;
  readonly onConsole: (name: string) => void;
  readonly selectedBots?: ReadonlySet<string>;
  readonly onToggleSelect?: (name: string) => void;
}

export const BotCardGrid = memo(function BotCardGrid({ bots, onStop, onSelect, onConsole, selectedBots, onToggleSelect }: BotCardGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);

  // Responsive column detection
  useEffect(() => {
    const el = scrollRef.current?.parentElement;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 800;
      if (width >= 1536) setColumns(4);
      else if (width >= 1280) setColumns(3);
      else if (width >= 768) setColumns(2);
      else setColumns(1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rowCount = Math.ceil(bots.length / columns);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 200,
    overscan: 3,
  });

  if (bots.length === 0) {
    return <p className="text-center text-gray-500 dark:text-gray-400 py-8">暂无机器人</p>;
  }

  return (
    <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * columns;
          const rowBots = bots.slice(startIdx, startIdx + columns);
          return (
            <div
              key={virtualRow.index}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="grid gap-3"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {rowBots.map((bot) => (
                <BotCard
                  key={bot.name}
                  bot={bot}
                  onStop={onStop}
                  onConsole={onConsole}
                  selected={selectedBots?.has(bot.name) ?? false}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
});

function BotCard({
  bot,
  onStop,
  onConsole,
  selected,
  onToggleSelect,
}: {
  readonly bot: BotSnapshot;
  readonly onStop: (name: string) => void;
  readonly onConsole: (name: string) => void;
  readonly selected: boolean;
  readonly onToggleSelect?: (name: string) => void;
}) {
  const color = stateColors[bot.state] ?? 'bg-yellow-500';
  const label = stateLabels[bot.state] ?? bot.state;
  const isOnline = bot.state !== 'STOPPED' && bot.state !== 'FAILED' && bot.state !== 'DISCONNECTED';
  const isDead = bot.isDead || bot.state === 'DEAD';
  const showToast = useDialogStore((s) => s.showToast);

  const [cmdInput, setCmdInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [respawning, setRespawning] = useState(false);
  const cmdRef = useRef<HTMLInputElement>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    try {
      if (text.startsWith('/')) {
        await botApi.debugCommand(bot.name, `.cmd ${text.slice(1)}`);
      } else {
        await botApi.debugCommand(bot.name, `.chat ${text}`);
      }
    } catch {
      showToast('发送失败', 'error');
    }
  }, [bot.name, showToast]);

  const handleCmdSubmit = useCallback(() => {
    sendMessage(cmdInput);
    setCmdInput('');
  }, [cmdInput, sendMessage]);

  useEffect(() => {
    if (expanded && isOnline) {
      botApi.debugStart(bot.name).catch(() => {});
    }
  }, [expanded, isOnline, bot.name]);

  return (
    <div className={`rounded-lg border shadow-sm hover:shadow-md transition-shadow ${isDead ? 'bg-red-950/30 dark:bg-red-950/40 border-red-500/50 ring-1 ring-red-500/20' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(bot.name)}
              className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0"
            />
          )}
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isDead ? 'bg-red-500 animate-pulse' : color}`} />
          <span className={`text-sm font-medium truncate ${isDead ? 'text-red-300' : 'text-gray-900 dark:text-gray-100'}`}>{bot.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {bot.currentBehavior || 'idle'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
        </div>
      </div>

      {/* Death banner */}
      {isDead && (
        <div className="mx-3 mb-1 space-y-1">
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-red-600/90 text-white rounded text-[10px]">
            <Skull className="w-3.5 h-3.5 animate-pulse" />
            <div className="flex-1 min-w-0">
              <span className="font-medium">已死亡</span>
              {bot.deathCount > 0 && <span className="ml-1 opacity-80">共 {bot.deathCount} 次</span>}
            </div>
            <button
              type="button"
              disabled={respawning}
              onClick={async (e) => {
                e.stopPropagation();
                setRespawning(true);
                try {
                  await botApi.respawn(bot.name);
                  showToast('已发送复活指令', 'success');
                } catch { showToast('复活失败', 'error'); }
                finally { setRespawning(false); }
              }}
              className="flex items-center gap-0.5 px-2 py-0.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded text-[10px] font-medium transition-colors"
            >
              <RotateCcw className={`w-2.5 h-2.5 ${respawning ? 'animate-spin' : ''}`} />
              {respawning ? '复活中...' : '复活'}
            </button>
          </div>
          {bot.lastError && (
            <div className="flex items-start gap-1 px-2 py-1 bg-red-900/30 rounded text-[9px] text-red-300">
              <AlertTriangle className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
              <span className="truncate" title={bot.lastError}>{bot.lastError}</span>
            </div>
          )}
        </div>
      )}

      {/* Game info grid */}
      {isOnline && (
        <div className="px-3 pb-1 grid grid-cols-4 gap-1.5 text-[10px]">
          <div className="bg-gray-50 dark:bg-gray-900 rounded px-1.5 py-1">
            <div className="flex items-center gap-0.5 text-red-400"><Heart className="w-2.5 h-2.5" />HP</div>
            <p className="font-semibold text-gray-800 dark:text-gray-200 text-xs">{bot.health?.toFixed(0) ?? '—'}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded px-1.5 py-1">
            <div className="text-orange-400">🍖</div>
            <p className="font-semibold text-gray-800 dark:text-gray-200 text-xs">{bot.food ?? '—'}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded px-1.5 py-1">
            <div className="flex items-center gap-0.5 text-blue-400"><Wifi className="w-2.5 h-2.5" />ms</div>
            <p className="font-semibold text-gray-800 dark:text-gray-200 text-xs">{bot.latencyMs ?? '—'}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded px-1.5 py-1">
            <div className="flex items-center gap-0.5 text-green-400"><MapPin className="w-2.5 h-2.5" />W</div>
            <p className="font-semibold text-gray-800 dark:text-gray-200 text-xs truncate" title={bot.world}>{bot.world || '—'}</p>
          </div>
        </div>
      )}

      {isOnline && bot.x !== undefined && (
        <div className="px-3 pb-1.5">
          <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate">
            {bot.x.toFixed(0)}, {bot.y.toFixed(0)}, {bot.z.toFixed(0)}
          </p>
        </div>
      )}

      {!isOnline && (
        <div className="px-3 pb-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
          {bot.serverId && <p className="truncate">服务器: {bot.serverId.slice(0, 8)}...</p>}
          {bot.lastError && <p className="text-red-400 truncate" title={bot.lastError}>错误: {bot.lastError}</p>}
        </div>
      )}

      {/* Expandable command area */}
      {isOnline && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-1 px-3 py-1.5 text-[10px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <Terminal className="w-3 h-3" />
            命令 / 聊天
          </button>

          {expanded && (
            <div className="px-3 pb-2 space-y-1.5">
              <div className="flex gap-1">
                <input
                  ref={cmdRef}
                  type="text"
                  value={cmdInput}
                  onChange={(e) => setCmdInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCmdSubmit()}
                  placeholder="聊天或 /命令"
                  className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={handleCmdSubmit}
                  className="p-1 bg-blue-600 text-white rounded hover:bg-blue-500 active:scale-90 transition-all duration-100"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[9px] text-gray-400">不带 / 发言，带 / 执行游戏命令</p>
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-700 flex gap-2">
        <button
          type="button"
          className="text-xs text-blue-500 hover:text-blue-400 active:scale-90 transition-all duration-100 flex items-center gap-0.5"
          onClick={(e) => { e.stopPropagation(); onConsole(bot.name); }}
        >
          <Terminal className="w-3 h-3" />
          控制台
        </button>
        <button
          type="button"
          className="text-xs text-red-400 hover:text-red-300 ml-auto flex items-center gap-0.5 active:scale-90 transition-all duration-100"
          onClick={(e) => { e.stopPropagation(); onStop(bot.name); }}
        >
          <Square className="w-3 h-3" />
          停止
        </button>
      </div>
    </div>
  );
}
