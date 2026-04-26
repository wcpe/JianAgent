import type { BotStats } from '../../api/bot.api.js';

const items = (s: BotStats) => [
  { label: '总计', value: s.total, color: 'text-gray-900 dark:text-gray-200' },
  { label: '在线', value: s.online, color: 'text-success-400' },
  { label: '离线', value: s.offline, color: 'text-gray-500 dark:text-gray-400' },
  { label: '异常', value: s.error, color: 'text-danger-400' },
];

export function BotStatsBar({ stats }: { readonly stats: BotStats | null }) {
  if (!stats) return null;
  return (
    <div className="flex gap-6 px-4 py-2 bg-white dark:bg-gray-800/50 shadow-sm dark:shadow-none rounded-lg text-sm">
      {items(stats).map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className="text-gray-500 dark:text-gray-400">{it.label}</span>
          <span className={`font-semibold ${it.color}`}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}
