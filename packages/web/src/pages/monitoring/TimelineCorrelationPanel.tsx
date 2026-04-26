import { useEffect, useState } from 'react';
import { metricsApi } from '../../api/metrics.api.js';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';
import type { CorrelatedTimelineDto } from '@jian-agent/shared-domain';
import { X, AlertTriangle, FileWarning, Activity } from 'lucide-react';

interface TimelineCorrelationPanelProps {
  readonly serverId: string;
  readonly selectedTimestamp: string | null;
  readonly onClose: () => void;
}

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString();
}

function logLevelBg(level: string): string {
  switch (level.toUpperCase()) {
    case 'ERROR':
    case 'FATAL':
      return 'bg-red-100 dark:bg-red-900/40 border-l-4 border-red-500';
    case 'WARN':
    case 'WARNING':
      return 'bg-orange-100 dark:bg-orange-900/30 border-l-4 border-orange-500';
    default:
      return 'bg-gray-50 dark:bg-gray-800/40 border-l-4 border-gray-300';
  }
}

function logLevelBadge(level: string): string {
  switch (level.toUpperCase()) {
    case 'ERROR':
    case 'FATAL':
      return 'bg-red-600 text-white';
    case 'WARN':
    case 'WARNING':
      return 'bg-orange-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

export function TimelineCorrelationPanel({ serverId, selectedTimestamp, onClose }: TimelineCorrelationPanelProps) {
  const [data, setData] = useState<CorrelatedTimelineDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = selectedTimestamp !== null;

  useEffect(() => {
    if (!selectedTimestamp || !serverId) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const ts = new Date(selectedTimestamp).getTime();
    const startTime = new Date(ts - WINDOW_MS).toISOString();
    const endTime = new Date(ts + WINDOW_MS).toISOString();

    metricsApi
      .getCorrelatedTimeline({ serverId, startTime, endTime })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message ?? '加载关联数据失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTimestamp, serverId]);

  // Metric snapshot summary for the selected point
  const metricSummary = data?.metrics?.length
    ? data.metrics[Math.floor(data.metrics.length / 2)]
    : null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="h-[300px] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-white/55 dark:border-primary-300/20 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-blue-500" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              时间轴关联分析
            </span>
            {selectedTimestamp && (
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                — {formatTs(selectedTimestamp)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {loading && (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mr-2" />
              加载中...
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center">
              <ErrorAlert message={error} />
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Left column: Error Logs */}
              <div className="flex-1 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 shrink-0 flex items-center gap-1.5">
                  <FileWarning size={12} />
                  错误日志 ({data.errorLogs.length})
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
                  {data.errorLogs.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 py-4 text-center">
                      该时间窗口内无错误日志
                    </p>
                  )}
                  {data.errorLogs.map((log, i) => (
                    <div
                      key={`log-${i}`}
                      className={`rounded px-2 py-1.5 text-xs ${logLevelBg(log.level)}`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${logLevelBadge(log.level)}`}>
                          {log.level}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 font-mono text-[10px]">
                          {formatTs(log.timestamp)}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500 text-[10px]">
                          {log.hostName}
                        </span>
                      </div>
                      <p className="text-gray-800 dark:text-gray-200 font-mono break-all leading-relaxed">
                        {log.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column: Alerts + Metric Snapshot */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Alerts */}
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 shrink-0 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  告警事件 ({data.alerts.length})
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
                  {data.alerts.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 py-2 text-center">
                      该时间窗口内无告警
                    </p>
                  )}
                  {data.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded px-2 py-1.5 text-xs bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="px-1 py-0.5 rounded text-[10px] font-bold bg-yellow-500 text-white">
                          {alert.level}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 font-mono text-[10px]">
                          {formatTs(alert.timestamp)}
                        </span>
                      </div>
                      <p className="text-gray-800 dark:text-gray-200 font-medium">
                        {alert.ruleName}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">{alert.message}</p>
                    </div>
                  ))}
                </div>

                {/* Metric Snapshot Summary */}
                {metricSummary && (
                  <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 shrink-0">
                    <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      关键指标快照
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">TPS: </span>
                        <span className="font-mono text-gray-900 dark:text-gray-100">
                          {metricSummary.tps?.toFixed(1) ?? '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">CPU: </span>
                        <span className="font-mono text-gray-900 dark:text-gray-100">
                          {metricSummary.cpuUsage != null ? `${metricSummary.cpuUsage.toFixed(1)}%` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">内存: </span>
                        <span className="font-mono text-gray-900 dark:text-gray-100">
                          {metricSummary.memoryUsageMb != null ? `${metricSummary.memoryUsageMb.toFixed(0)} MB` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">玩家: </span>
                        <span className="font-mono text-gray-900 dark:text-gray-100">
                          {metricSummary.onlinePlayers ?? '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">实体: </span>
                        <span className="font-mono text-gray-900 dark:text-gray-100">
                          {metricSummary.entityCount ?? '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">MSPT: </span>
                        <span className="font-mono text-gray-900 dark:text-gray-100">
                          {metricSummary.mspt?.toFixed(1) ?? '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && !error && !data && isOpen && (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
              点击图表上的数据点以查看关联分析
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
