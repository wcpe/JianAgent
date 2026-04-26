import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { JvmDiagnosticsSummaryDto, JvmHealthState, JvmRiskSignalDto } from '@jian-agent/shared-domain';
import { javaHelperApi } from '../../api/java-helper.api.js';
import { JvmQuickActions } from './JvmQuickActions.js';

interface JvmDiagnosticsTabProps {
  resourceId: string;
}

function HealthStateBadge({ state }: { state: JvmHealthState }) {
  const config: Record<JvmHealthState, { label: string; className: string }> = {
    healthy: { label: '健康', className: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' },
    degraded: { label: '降级', className: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400' },
    critical: { label: '严重', className: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400' },
    unknown: { label: '未知', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  };
  const { label, className } = config[state];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function RiskSignalCard({ signal }: { signal: JvmRiskSignalDto }) {
  const levelColors: Record<string, string> = {
    info: 'border-info-200 bg-info-50 dark:border-info-700 dark:bg-info-900/20',
    warning: 'border-warning-200 bg-warning-50 dark:border-warning-700 dark:bg-warning-900/20',
    error: 'border-danger-200 bg-danger-50 dark:border-danger-700 dark:bg-danger-900/20',
    critical: 'border-danger-500 bg-danger-100 dark:border-danger-600 dark:bg-danger-900/30',
  };

  const typeLabels: Record<string, string> = {
    'high-cpu': 'CPU 使用率过高',
    'high-memory': '内存使用率过高',
    'gc-pressure': 'GC 压力',
    'thread-contention': '线程竞争',
    'deadlock-detected': '死锁检测',
    'memory-leak-suspected': '疑似内存泄漏',
    'jfr-recording-failed': 'JFR 录制失败',
    'jmx-connection-lost': 'JMX 连接丢失',
  };

  return (
    <div className={`rounded border p-3 ${levelColors[signal.level] ?? levelColors.info}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {typeLabels[signal.type] ?? signal.type}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(signal.detectedAt).toLocaleTimeString()}
        </span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-300">{signal.message}</p>
      {signal.value != null && signal.threshold != null && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          当前值: {signal.value.toFixed(1)} / 阈值: {signal.threshold.toFixed(1)}
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value, unit }: { label: string; value: string | number | null; unit?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {value ?? '-'}{unit && value != null ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

export function JvmDiagnosticsTab({ resourceId }: JvmDiagnosticsTabProps) {
  const [summary, setSummary] = useState<JvmDiagnosticsSummaryDto | null>(null);
  const [pid, setPid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      // Note: This is a placeholder API call - the actual endpoint may differ
      // In a real implementation, there would be a dedicated JVM diagnostics summary endpoint
      const status = await javaHelperApi.getStatus();
      if (status.success && status.data) {
        // Construct a mock summary from available data
        // In production, this would be a dedicated API call
        const mockSummary: JvmDiagnosticsSummaryDto = {
          target: { kind: 'external-pid', pid: '0', hostId: 'unknown', mainClass: 'unknown' },
          generatedAt: new Date().toISOString(),
          healthState: status.data.state === 'ATTACHED' ? 'healthy' : 'unknown',
          latestJmx: null,
          activeJfrRecordings: [],
          riskSignals: [],
          recentActions: [],
          helperAttached: status.data.state === 'ATTACHED',
          jmxConnected: false,
          uptimeSeconds: null,
        };
        setSummary(mockSummary);
        setPid(status.data.attachedPid ?? null);
      }
    } catch (err: any) {
      setError(err.message ?? '加载 JVM 诊断信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [resourceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mr-2"></div>
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-danger-500 mb-2">{error}</p>
        <button onClick={loadSummary} className="text-sm text-blue-500 hover:underline">
          重试
        </button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        暂无 JVM 诊断数据
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header with health state */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">JVM 诊断</h3>
          <HealthStateBadge state={summary.healthState} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/servers/${resourceId}/jvm-drilldown`)}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            深度钻取
          </button>
          <button
            onClick={loadSummary}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            刷新
          </button>
        </div>
      </div>

      {/* Connection status */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Helper 连接</div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${summary.helperAttached ? 'bg-success-500' : 'bg-gray-400'}`}></span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {summary.helperAttached ? '已连接' : '未连接'}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">JMX 连接</div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${summary.jmxConnected ? 'bg-success-500' : 'bg-gray-400'}`}></span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {summary.jmxConnected ? '已连接' : '未连接'}
            </span>
          </div>
        </div>
      </div>

      {/* JMX Metrics */}
      {summary.latestJmx && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">JMX 指标</h4>
          <div className="space-y-0">
            <MetricRow label="Heap 使用" value={summary.latestJmx.heapUsedMb?.toFixed(1) ?? null} unit="MB" />
            <MetricRow label="Heap 最大" value={summary.latestJmx.heapMaxMb?.toFixed(1) ?? null} unit="MB" />
            <MetricRow label="Heap 提交" value={summary.latestJmx.heapCommittedMb?.toFixed(1) ?? null} unit="MB" />
            <MetricRow label="线程数" value={summary.latestJmx.threadCount ?? null} />
            <MetricRow label="GC Young 次数" value={summary.latestJmx.gcYoungCount ?? null} />
            <MetricRow label="GC Young 时间" value={summary.latestJmx.gcYoungTimeMs?.toFixed(0) ?? null} unit="ms" />
            <MetricRow label="GC Full 次数" value={summary.latestJmx.gcFullCount ?? null} />
            <MetricRow label="GC Full 时间" value={summary.latestJmx.gcFullTimeMs?.toFixed(0) ?? null} unit="ms" />
          </div>
        </div>
      )}

      {/* Risk Signals */}
      {(summary.riskSignals ?? []).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">风险信号</h4>
          <div className="space-y-2">
            {(summary.riskSignals ?? []).map((signal, idx) => (
              <RiskSignalCard key={idx} signal={signal} />
            ))}
          </div>
        </div>
      )}

      {/* JFR Recordings */}
      {(summary.activeJfrRecordings ?? []).length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">活动 JFR 录制</h4>
          <div className="space-y-1">
            {(summary.activeJfrRecordings ?? []).map((rec) => (
              <div key={rec.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-300">{rec.recordingName}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  rec.status === 'running' ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' :
                  rec.status === 'completed' ? 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-400' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {rec.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <JvmQuickActions resourceId={resourceId} helperAttached={summary.helperAttached} pid={pid ?? undefined} />
    </div>
  );
}