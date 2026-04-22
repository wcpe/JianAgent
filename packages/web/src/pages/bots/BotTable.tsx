import { useState, useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { RotateCcw, Skull } from 'lucide-react';
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

interface BotTableProps {
  readonly bots: readonly BotSnapshot[];
  readonly onStop: (name: string) => void;
  readonly onSelect: (name: string) => void;
  readonly onConsole?: (name: string) => void;
  readonly selectedBots?: ReadonlySet<string>;
  readonly onToggleSelect?: (name: string) => void;
}

export const BotTable = memo(function BotTable({ bots, onStop, onSelect, onConsole, selectedBots, onToggleSelect }: BotTableProps) {
  const showToast = useDialogStore((s) => s.showToast);
  const [respawningBots, setRespawningBots] = useState<Set<string>>(new Set());
  const [batchRespawning, setBatchRespawning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const deadBots = bots.filter((b) => b.isDead || b.state === 'DEAD');
  const deadCount = deadBots.length;

  const rowVirtualizer = useVirtualizer({
    count: bots.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const handleRespawn = async (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRespawningBots((prev) => new Set([...prev, name]));
    try {
      await botApi.respawn(name);
      showToast(`${name} 已发送复活指令`, 'success');
    } catch { showToast(`${name} 复活失败`, 'error'); }
    finally { setRespawningBots((prev) => { const next = new Set(prev); next.delete(name); return next; }); }
  };

  const handleBatchRespawn = async () => {
    setBatchRespawning(true);
    try {
      const res = await botApi.batchRespawn(deadBots.map((b) => b.name));
      const ok = res.data?.filter((r) => r.success).length ?? 0;
      const fail = (res.data?.length ?? 0) - ok;
      showToast(`批量复活: ${ok} 成功${fail > 0 ? `, ${fail} 失败` : ''}`, fail > 0 ? 'error' : 'success');
    } catch { showToast('批量复活失败', 'error'); }
    finally { setBatchRespawning(false); }
  };

  if (bots.length === 0) {
    return <p className="text-center text-gray-500 py-8">暂无机器人</p>;
  }

  return (
    <div className="space-y-2">
      {/* Batch respawn banner */}
      {deadCount > 1 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 dark:bg-red-900/20 border border-red-400/30 dark:border-red-500/30 rounded-xl backdrop-blur-xl">
          <Skull className="w-4 h-4 text-red-400 animate-pulse" />
          <span className="text-xs text-red-400 dark:text-red-300">{deadCount} 个机器人已死亡</span>
          <button
            type="button"
            disabled={batchRespawning}
            onClick={handleBatchRespawn}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
          >
            <RotateCcw className={`w-3 h-3 ${batchRespawning ? 'animate-spin' : ''}`} />
            {batchRespawning ? '复活中...' : '全部复活'}
          </button>
        </div>
      )}
    <div className="overflow-x-auto">
      <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl bg-white/80 dark:bg-slate-900/60">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-600 dark:text-gray-300 uppercase bg-white/40 dark:bg-slate-800/40 sticky top-0 z-10 border-b border-white/40 dark:border-primary-300/10 font-semibold">
          <tr>
            {onToggleSelect && <th className="px-3 py-2 w-8"></th>}
            <th className="px-3 py-2">名称</th>
            <th className="px-3 py-2">状态</th>
            <th className="px-3 py-2">行为</th>
            <th className="px-3 py-2">HP</th>
            <th className="px-3 py-2">🍖</th>
            <th className="px-3 py-2">延迟</th>
            <th className="px-3 py-2">世界</th>
            <th className="px-3 py-2">坐标</th>
            <th className="px-3 py-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {rowVirtualizer.getVirtualItems().length > 0 && (
            <tr style={{ height: rowVirtualizer.getVirtualItems()[0].start }}>
              <td colSpan={99} />
            </tr>
          )}
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const bot = bots[virtualRow.index];
            const isOnline = bot.state !== 'STOPPED' && bot.state !== 'FAILED' && bot.state !== 'DISCONNECTED';
            const isDead = bot.isDead || bot.state === 'DEAD';
            return (
              <tr
                key={bot.name}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={`border-b border-white/30 dark:border-primary-300/10 cursor-pointer transition-colors ${
                  isDead 
                    ? 'bg-red-500/10 dark:bg-red-900/15 hover:bg-red-500/20 dark:hover:bg-red-900/25'
                    : virtualRow.index % 2 === 0 
                    ? 'hover:bg-white/50 dark:hover:bg-slate-800/50'
                    : 'bg-white/20 dark:bg-slate-800/10 hover:bg-white/60 dark:hover:bg-slate-800/60'
                }`}
                onClick={() => onSelect(bot.name)}
              >
                {onToggleSelect && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedBots?.has(bot.name) ?? false}
                      onChange={() => onToggleSelect(bot.name)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3.5 h-3.5 accent-blue-600"
                    />
                  </td>
                )}
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-200">{bot.name}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${stateColors[bot.state] ?? 'bg-yellow-500'}`} />
                    <span className="text-xs">{isDead ? '已死亡' : bot.state}</span>
                    {bot.deathCount > 0 && (
                      <span className="text-[9px] text-red-400">({bot.deathCount}死)</span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{bot.currentBehavior || 'idle'}</td>
                <td className="px-3 py-2 text-xs text-red-400">{isOnline ? bot.health?.toFixed(0) : '—'}</td>
                <td className="px-3 py-2 text-xs text-orange-400">{isOnline ? bot.food : '—'}</td>
                <td className="px-3 py-2 text-xs text-blue-400">{isOnline && bot.latencyMs ? `${bot.latencyMs}ms` : '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-[100px] truncate" title={bot.world}>{isOnline ? (bot.world || '—') : '—'}</td>
                <td className="px-3 py-2 text-xs font-mono text-gray-500 dark:text-gray-400">
                  {isOnline && bot.x !== undefined
                    ? `${bot.x.toFixed(0)},${bot.y.toFixed(0)},${bot.z.toFixed(0)}`
                    : '—'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {isDead && (
                      <button
                        type="button"
                        disabled={respawningBots.has(bot.name)}
                        className="flex items-center gap-0.5 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-50 text-xs transition-colors"
                        onClick={(e) => handleRespawn(bot.name, e)}
                      >
                        <RotateCcw className={`w-3 h-3 ${respawningBots.has(bot.name) ? 'animate-spin' : ''}`} />
                        {respawningBots.has(bot.name) ? '复活中' : '复活'}
                      </button>
                    )}
                    {onConsole && (
                      <button
                        type="button"
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-xs transition-colors"
                        onClick={(e) => { e.stopPropagation(); onConsole(bot.name); }}
                      >
                        控制台
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs transition-colors"
                      onClick={(e) => { e.stopPropagation(); onStop(bot.name); }}
                    >
                      停止
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {rowVirtualizer.getVirtualItems().length > 0 && (
            <tr style={{ height: rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems().at(-1)?.end ?? 0) }}>
              <td colSpan={99} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </div>
    </div>
  );
});
