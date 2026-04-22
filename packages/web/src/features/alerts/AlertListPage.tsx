import { type FC, useEffect, useMemo } from 'react';
import { useAlertsStore } from './alerts.store.js';
import { useAlertWs } from './useAlertWs.js';
import AlertBadge from './AlertBadge.js';
import type { AlertDto } from '@jian-agent/shared-domain';

const LEVEL_BAR_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  WARNING: '#eab308',
  INFO: '#3b82f6',
};

function buildHourlyBuckets(alerts: readonly AlertDto[]): { hour: string; count: number; color: string }[] {
  const now = Date.now();
  const buckets: Map<number, { count: number; maxLevel: string }> = new Map();
  for (let i = 0; i < 24; i++) buckets.set(i, { count: 0, maxLevel: 'INFO' });

  const LEVEL_PRIORITY: Record<string, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 };

  for (const a of alerts) {
    const age = now - new Date(a.timestamp).getTime();
    if (age > 24 * 60 * 60 * 1000 || age < 0) continue;
    const hoursAgo = Math.floor(age / (60 * 60 * 1000));
    const bucket = buckets.get(hoursAgo);
    if (!bucket) continue;
    const updated = {
      count: bucket.count + 1,
      maxLevel: (LEVEL_PRIORITY[a.level] ?? 0) > (LEVEL_PRIORITY[bucket.maxLevel] ?? 0) ? a.level : bucket.maxLevel,
    };
    buckets.set(hoursAgo, updated);
  }

  return Array.from({ length: 24 }, (_, i) => {
    const b = buckets.get(23 - i)!;
    const d = new Date(now - (23 - i) * 60 * 60 * 1000);
    return { hour: `${d.getHours()}:00`, count: b.count, color: LEVEL_BAR_COLORS[b.maxLevel] ?? '#3b82f6' };
  });
}

const AlertTrendChart: FC<{ readonly alerts: readonly AlertDto[] }> = ({ alerts }) => {
  const buckets = useMemo(() => buildHourlyBuckets(alerts), [alerts]);
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const barWidth = 100 / 24;

  return (
    <div className="bg-white/80 dark:bg-slate-900/60 shadow-xl dark:shadow-none rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl p-4">
      <h3 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">24小时告警趋势</h3>
      <svg viewBox="0 0 240 100" className="w-full" style={{ height: 100 }} preserveAspectRatio="none">
        {buckets.map((b, i) => {
          const barH = b.count > 0 ? Math.max(4, (b.count / maxCount) * 88) : 0;
          return (
            <rect
              key={i}
              x={i * (barWidth * 2.4) + 1}
              y={92 - barH}
              width={barWidth * 2.4 - 2}
              height={barH}
              rx={1}
              fill={b.count > 0 ? b.color : 'transparent'}
              opacity={0.85}
            />
          );
        })}
        <line x1="0" y1="92" x2="240" y2="92" stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth="0.5" />
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
        <span>{buckets[0]?.hour}</span>
        <span>{buckets[12]?.hour}</span>
        <span>现在</span>
      </div>
    </div>
  );
};

const AlertListPage: FC = () => {
  const { alerts, summary, loading, fetchAlerts, fetchSummary, acknowledgeAlert } = useAlertsStore();

  useAlertWs();

  useEffect(() => {
    fetchAlerts();
    fetchSummary();
  }, [fetchAlerts, fetchSummary]);

  return (
    <div className="bg-gradient-to-br from-primary-50 to-teal-50 dark:from-slate-950 dark:to-slate-900 min-h-screen p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">告警面板</h1>

      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/80 dark:bg-slate-900/60 rounded-2xl shadow-xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.totalActive}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">活跃告警</p>
          </div>
          <div className="bg-red-500/10 dark:bg-red-900/20 rounded-2xl shadow-xl border border-red-300/30 dark:border-red-400/20 backdrop-blur-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.criticalCount}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">严重</p>
          </div>
          <div className="bg-yellow-500/10 dark:bg-yellow-900/20 rounded-2xl shadow-xl border border-yellow-300/30 dark:border-yellow-400/20 backdrop-blur-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{summary.warningCount}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">警告</p>
          </div>
          <div className="bg-blue-500/10 dark:bg-primary-900/20 rounded-2xl shadow-xl border border-blue-300/30 dark:border-primary-400/20 backdrop-blur-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-primary-400">{summary.infoCount}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">信息</p>
          </div>
        </div>
      )}

      <AlertTrendChart alerts={alerts} />

      <div className="bg-white/80 dark:bg-slate-900/60 rounded-2xl shadow-xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/40 dark:bg-slate-800/40 border-b border-white/40 dark:border-primary-300/10">
            <tr>
              <th className="text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-semibold">时间</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-semibold">级别</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-semibold">规则</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-semibold">消息</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-semibold">状态</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400 dark:text-gray-500">加载中...</td></tr>
            ) : alerts.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400 dark:text-gray-500">暂无告警</td></tr>
            ) : (
              alerts.map((alert, idx) => (
                <tr key={alert.id} className={`border-t border-white/30 dark:border-primary-300/10 transition-colors ${
                  idx % 2 === 0
                    ? 'hover:bg-white/50 dark:hover:bg-slate-800/50'
                    : 'bg-white/20 dark:bg-slate-800/10 hover:bg-white/60 dark:hover:bg-slate-800/60'
                }`}>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(alert.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-2"><AlertBadge level={alert.level} /></td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{alert.ruleName}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-sm truncate">{alert.message}</td>
                  <td className="px-3 py-2">
                    {alert.acknowledged ? (
                      <span className="text-xs text-green-600 dark:text-green-400">已确认</span>
                    ) : (
                      <span className="text-xs text-red-600 dark:text-red-400">未确认</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {!alert.acknowledged && (
                      <button
                        className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline transition-colors"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        确认
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AlertListPage;
