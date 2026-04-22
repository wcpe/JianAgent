import { useEffect, useMemo } from 'react';
import { useValidationStore } from './validation.store.js';
import type { ValidationMetricDto } from '@jian-agent/shared-domain';

const STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  running: '运行中',
  completed: '已完成',
  failed: '已失败',
  cancelled: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-500',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  cancelled: 'bg-yellow-500',
};

function formatTime(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleTimeString();
}

function formatElapsed(start?: string, end?: string): string {
  if (!start) return '-';
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.floor((endTime - startTime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m${s}s`;
}

function MetricCard({ metric }: { readonly metric: ValidationMetricDto }) {
  return (
    <div className={`rounded-lg p-3 border ${
      metric.passed
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">{metric.metric}</span>
        <span className={`text-xs font-medium ${metric.passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {metric.passed ? 'PASS' : 'FAIL'}
        </span>
      </div>
      <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        {metric.actualValue}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        阈值: {metric.threshold}
      </div>
    </div>
  );
}

export function ValidationRunPanel() {
  const { activeRun, cancelRun, refreshRun, observability } = useValidationStore();

  // Poll for run updates
  useEffect(() => {
    if (!activeRun || activeRun.status === 'completed' || activeRun.status === 'failed' || activeRun.status === 'cancelled') {
      return;
    }
    const id = setInterval(() => {
      refreshRun(activeRun.id);
    }, 3000);
    return () => clearInterval(id);
  }, [activeRun, refreshRun]);

  if (!activeRun) return null;

  const isRunning = activeRun.status === 'running' || activeRun.status === 'pending';
  const groupedMetrics = useMemo(() => {
    const groups: Record<string, ValidationMetricDto[]> = {};
    for (const m of activeRun.metrics) {
      if (!groups[m.phaseId]) groups[m.phaseId] = [];
      groups[m.phaseId].push(m);
    }
    return groups;
  }, [activeRun.metrics]);

  return (
    <div className="bg-white dark:bg-gray-800/50 shadow-sm dark:shadow-none rounded-lg p-5 space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[activeRun.status]}`} />
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {STATUS_LABELS[activeRun.status] ?? activeRun.status}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
          耗时: {formatElapsed(activeRun.startedAt, activeRun.completedAt)}
        </span>
      </div>

      {/* Run info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">Run ID</span>
          <p className="text-sm font-mono text-gray-800 dark:text-gray-200 truncate">{activeRun.id}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">开始时间</span>
          <p className="text-sm font-semibold text-blue-400">{formatTime(activeRun.startedAt)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">完成时间</span>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatTime(activeRun.completedAt)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">指标数</span>
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{activeRun.metrics.length}</p>
        </div>
      </div>

      {/* Alerts summary from observability */}
      {observability && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
            <span className="text-xs text-red-500 dark:text-red-400">Critical 告警</span>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{observability.alertCounts.critical}</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
            <span className="text-xs text-yellow-500 dark:text-yellow-400">Warning 告警</span>
            <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{observability.alertCounts.warning}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-3 text-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">异常数</span>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{observability.exceptionCount}</p>
          </div>
        </div>
      )}

      {/* Metric groups by phase */}
      {Object.keys(groupedMetrics).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">阶段指标</h3>
          {Object.entries(groupedMetrics).map(([phaseId, metrics]) => (
            <div key={phaseId} className="space-y-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{phaseId}</span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {metrics.map((m, i) => (
                  <MetricCard key={`${m.phaseId}-${m.criterionIndex}-${i}`} metric={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {activeRun.error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded p-3 text-sm text-red-600 dark:text-red-300">
          {activeRun.error}
        </div>
      )}

      {/* Actions */}
      {isRunning && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => cancelRun(activeRun.id)}
            className="bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded px-4 py-2"
          >
            取消验证
          </button>
        </div>
      )}
    </div>
  );
}
