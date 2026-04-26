import type { MetricSnapshotDto } from '@jian-agent/shared-domain';

interface StatsBarProps {
  readonly lastPoint: MetricSnapshotDto | null;
  readonly maxMem: number | null | undefined;
  readonly worldSummaryCount: number;
}

export function StatsBar({ lastPoint, maxMem, worldSummaryCount }: StatsBarProps) {
  const items = [
    { label: 'TPS', value: lastPoint?.tps?.toFixed(1) ?? '---', color: (lastPoint?.tps ?? 20) >= 18 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400' },
    { label: 'MSPT', value: lastPoint?.mspt?.toFixed(1) ?? '---', color: (lastPoint?.mspt ?? 0) <= 50 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400' },
    { label: 'CPU', value: lastPoint?.cpuUsage != null ? `${lastPoint.cpuUsage.toFixed(1)}%` : '---', color: (lastPoint?.cpuUsage ?? 0) < 80 ? 'text-info-600 dark:text-info-400' : 'text-danger-600 dark:text-danger-400' },
    { label: '在线玩家', value: `${lastPoint?.onlinePlayers ?? 0}/${lastPoint?.maxPlayers ?? '?'}`, color: 'text-info-600 dark:text-info-400' },
    { label: '内存 (MB)', value: lastPoint?.memoryUsageMb != null ? `${lastPoint.memoryUsageMb.toFixed(0)}/${maxMem?.toFixed(0) ?? '?'}` : '---', color: 'text-purple-600 dark:text-purple-400' },
    { label: '世界数', value: String(lastPoint?.worldCount ?? (worldSummaryCount || '---')), color: 'text-teal-600 dark:text-teal-400' },
    { label: '插件数', value: String(lastPoint?.pluginCount ?? '---'), color: 'text-warning-600 dark:text-warning-400' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
      {items.map((m) => (
        <div key={m.label} className="bg-white/80 dark:bg-gray-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">{m.label}</p>
          <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}
