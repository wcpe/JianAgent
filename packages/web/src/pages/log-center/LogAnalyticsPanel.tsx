import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, AlertTriangle } from 'lucide-react';
import type { LogAnalyticsResult } from '@jian-agent/shared-domain';

interface LogAnalyticsPanelProps {
  readonly analytics: LogAnalyticsResult | null;
  readonly loading: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: '#9CA3AF',
  INFO: '#3B82F6',
  WARN: '#F59E0B',
  ERROR: '#EF4444',
};

const PIE_COLORS = ['#9CA3AF', '#3B82F6', '#F59E0B', '#EF4444', '#A855F7', '#06B6D4'];

const TOOLTIP_STYLE = { backgroundColor: '#1F2937', border: 'none', borderRadius: 8, color: '#F3F4F6', fontSize: 12 };

function formatBucketTime(time: string): string {
  if (time.length <= 5) return time;
  try {
    const d = new Date(time);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return time.slice(-5);
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[120px]">
      <p className="text-xs text-gray-400 dark:text-gray-500">{message}</p>
    </div>
  );
}

export function LogAnalyticsPanel({ analytics, loading }: LogAnalyticsPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">加载分析数据...</span>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <p className="text-sm text-gray-400 dark:text-gray-500">执行搜索后显示分析面板</p>
      </div>
    );
  }

  const levelData = Object.entries(analytics.levelDistribution).map(([name, value]) => ({
    name,
    value,
    fill: LEVEL_COLORS[name] ?? '#A855F7',
  }));

  const timelineData = analytics.timelineBuckets.map((b) => ({
    time: formatBucketTime(b.time),
    count: b.count,
  }));

  const totalLogs = levelData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        {levelData.map((d) => (
          <div key={d.name} className="rounded-xl border border-white/55 dark:border-primary-300/20 bg-white/60 dark:bg-gray-900/40 px-3 py-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">{d.name}</p>
            <p className="text-lg font-bold" style={{ color: d.fill }}>{d.value}</p>
          </div>
        ))}
      </div>

      {/* Level distribution pie chart */}
      <div className="rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/60 dark:bg-gray-900/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <PieChartIcon size={14} className="text-primary-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">级别分布</span>
          <span className="ml-auto text-xs text-gray-400">共 {totalLogs} 条</span>
        </div>
        {levelData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={levelData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {levelData.map((entry, idx) => (
                  <Cell key={entry.name} fill={entry.fill ?? PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend
                verticalAlign="bottom"
                height={24}
                formatter={(value: string) => <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="无级别数据" />
        )}
      </div>

      {/* Timeline bar chart */}
      <div className="rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/60 dark:bg-gray-900/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={14} className="text-primary-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">时间线分布</span>
        </div>
        {timelineData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
              <YAxis tick={{ fontSize: 10 }} stroke="#9CA3AF" allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" name="日志数" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="无时间线数据" />
        )}
      </div>

      {/* Error trend area chart */}
      {analytics.errorTrend && analytics.errorTrend.length > 0 && (
        <div className="rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/60 dark:bg-gray-900/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-danger-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ERROR 趋势</span>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={analytics.errorTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
              <YAxis tick={{ fontSize: 10 }} stroke="#9CA3AF" allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="count" stroke="#ef4444" fill="#ef444433" name="ERROR 数" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top keywords */}
      <div className="rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/60 dark:bg-gray-900/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-primary-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">热词 Top 10</span>
        </div>
        {analytics.topKeywords.length > 0 ? (
          <div className="space-y-1.5">
            {analytics.topKeywords.slice(0, 10).map((kw, idx) => {
              const maxCount = analytics.topKeywords[0]?.count ?? 1;
              const pct = (kw.count / maxCount) * 100;
              return (
                <div key={kw.word} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4 text-right shrink-0">{idx + 1}</span>
                  <div className="flex-1 relative h-6 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary-100 dark:bg-primary-900/40 rounded"
                      style={{ width: `${pct}%` }}
                    />
                    <span className="relative z-10 px-2 text-xs leading-6 font-mono text-gray-700 dark:text-gray-300 truncate block">
                      {kw.word}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 tabular-nums w-10 text-right shrink-0">{kw.count}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState message="无热词数据" />
        )}
      </div>
    </div>
  );
}
