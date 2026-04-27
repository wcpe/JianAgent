import { useState, useEffect, useCallback } from 'react';
import { serverLifecycleApi } from '../../api/server-lifecycle.api.js';
import type { ProcessMetrics } from '@jian-agent/shared-domain';
import { Cpu, HardDrive, Activity } from 'lucide-react';

interface ProcessMetricsPanelProps {
  readonly serverId: string;
}

function formatBytes(bytes: number): string {
  if (bytes == null || isNaN(bytes)) return '0B';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

export function ProcessMetricsPanel({ serverId }: ProcessMetricsPanelProps) {
  const [metrics, setMetrics] = useState<ProcessMetrics[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const loadMetrics = useCallback(async () => {
    try {
      const result = await serverLifecycleApi.getProcessMetrics(serverId);
      setMetrics(result.metrics);
      const summ = await serverLifecycleApi.getMetricsSummary(serverId);
      setSummary(summ);
    } catch { /* ignore */ }
  }, [serverId]);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  const latest = metrics[metrics.length - 1];

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">进程资源监控</h3>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Cpu className="w-4 h-4" /> CPU
          </div>
          <div className="text-2xl font-mono">{latest?.cpuPercent?.toFixed(1) ?? '—'}%</div>
          {summary && summary.peak?.cpuPercent != null && <div className="text-xs text-gray-400">峰值 {summary.peak.cpuPercent.toFixed(1)}%</div>}
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <HardDrive className="w-4 h-4" /> 内存
          </div>
          <div className="text-2xl font-mono">{latest ? formatBytes(latest.rssBytes) : '—'}</div>
          {summary && <div className="text-xs text-gray-400">峰值 {formatBytes(summary.peak.rssBytes)}</div>}
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Activity className="w-4 h-4" /> 线程
          </div>
          <div className="text-2xl font-mono">{latest?.threadCount ?? '—'}</div>
        </div>
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-500 mb-2">CPU 使用率（最近 1 小时）</p>
        <div className="h-32 flex items-end gap-0.5">
          {metrics.slice(-60).map((m, i) => (
            <div
              key={i}
              className="flex-1 bg-blue-500 rounded-t min-h-[2px]"
              style={{ height: `${Math.min(m.cpuPercent ?? 0, 100)}%` }}
              title={m.cpuPercent != null ? `${m.cpuPercent.toFixed(1)}%` : '—'}
            />
          ))}
        </div>
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-500 mb-2">内存使用（最近 1 小时）</p>
        <div className="h-32 flex items-end gap-0.5">
          {metrics.slice(-60).map((m, i) => {
            const maxRss = Math.max(...metrics.map(x => x.rssBytes), 1);
            return (
              <div
                key={i}
                className="flex-1 bg-green-500 rounded-t min-h-[2px]"
                style={{ height: `${(m.rssBytes / maxRss) * 100}%` }}
                title={formatBytes(m.rssBytes)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
