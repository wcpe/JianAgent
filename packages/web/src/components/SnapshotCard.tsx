import type { ProbeSnapshotDto } from '@jian-agent/shared-domain';

interface Props {
  readonly serverId: string;
  readonly snapshot: ProbeSnapshotDto | undefined;
}

function formatMb(mb: number): string {
  if (mb == null || isNaN(mb)) return '0 MB';
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

export function SnapshotCard({ serverId, snapshot }: Props) {
  if (!snapshot) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800/50">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">{serverId}</h3>
        <p className="text-gray-400 dark:text-gray-500 text-sm">暂无快照数据</p>
      </div>
    );
  }

  const tpsColor = snapshot.tps >= 18
    ? 'text-success-600 dark:text-success-400'
    : snapshot.tps >= 15
      ? 'text-warning-600 dark:text-warning-400'
      : 'text-danger-600 dark:text-danger-400';

  const memUsedMb = snapshot.totalMemoryMb - snapshot.freeMemoryMb;
  const memPercent = snapshot.totalMemoryMb > 0 ? (memUsedMb / snapshot.totalMemoryMb) * 100 : 0;
  const memColor = memPercent >= 85 ? 'bg-danger-500' : memPercent >= 70 ? 'bg-warning-500' : 'bg-success-500';

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">{serverId}</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {new Date(snapshot.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">TPS</p>
          <p className={`text-lg font-mono font-bold ${tpsColor}`}>{snapshot.tps != null ? snapshot.tps.toFixed(1) : '—'}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">MSPT</p>
          <p className="text-lg font-mono font-bold text-gray-700 dark:text-gray-300">{snapshot.mspt != null ? snapshot.mspt.toFixed(1) : '—'}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">玩家</p>
          <p className="text-lg font-mono font-bold text-gray-700 dark:text-gray-300">{snapshot.onlinePlayers}<span className="text-sm text-gray-400">/{snapshot.maxPlayers}</span></p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">实体</p>
          <p className="text-lg font-mono font-bold text-gray-700 dark:text-gray-300">{snapshot.entityCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
        <span className="text-gray-500 dark:text-gray-400">已加载区块</span>
        <span className="font-mono text-gray-700 dark:text-gray-300">{snapshot.loadedChunks}</span>

        <span className="text-gray-500 dark:text-gray-400">世界数</span>
        <span className="font-mono text-gray-700 dark:text-gray-300">{snapshot.worldCount}</span>

        <span className="text-gray-500 dark:text-gray-400">运行时长</span>
        <span className="font-mono text-gray-700 dark:text-gray-300">{snapshot.uptime}</span>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500 dark:text-gray-400">内存</span>
          <span className="font-mono text-gray-600 dark:text-gray-400">{formatMb(memUsedMb)} / {formatMb(snapshot.totalMemoryMb)}</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded h-2">
          <div className={`${memColor} h-2 rounded transition-all`} style={{ width: `${Math.min(memPercent, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
