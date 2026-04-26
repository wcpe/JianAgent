import { useEffect, useCallback, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useJavaHelperStore } from '../../stores/java-helper.store.js';
import { javaHelperApi } from '../../api/java-helper.api.js';
import { metricsApi } from '../../api/metrics.api.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import type { JavaHelperStatusDto } from '@jian-agent/shared-domain';
import { ThreadDumpPanel } from './ThreadDumpPanel.js';
import { HeapAnalysisPanel } from './HeapAnalysisPanel.js';
import { JfrRecordingPanel } from './JfrRecordingPanel.js';
import { SystemPropertiesPanel } from './SystemPropertiesPanel.js';

export function JvmDiagnosticsPage() {
  const { id: serverId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    status: helperStatus,
    loading: helperLoading,
    error: helperError,
    fetchStatus: fetchHelperStatus,
    setStatus: setHelperStatus,
  } = useJavaHelperStore();

  const [jmxLatest, setJmxLatest] = useState<any>(null);
  const [jmxLoading, setJmxLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'threads' | 'heap' | 'jfr' | 'sysprops'>('threads');

  const attached = helperStatus?.state === 'ATTACHED';
  const pid = helperStatus?.attachedPid ?? '';

  useEffect(() => {
    fetchHelperStatus().catch(() => {});
  }, [fetchHelperStatus]);

  useEffect(() => {
    if (!serverId || !attached) return;
    setJmxLoading(true);
    metricsApi.getJmxLatest(serverId)
      .then(setJmxLatest)
      .catch(() => {})
      .finally(() => setJmxLoading(false));
  }, [serverId, attached]);

  const handleWsStatus = useCallback(
    (payload: JavaHelperStatusDto) => setHelperStatus(payload),
    [setHelperStatus],
  );
  useWsChannel('resource:java-helper:status', handleWsStatus);

  const handleStart = useCallback(async () => {
    try {
      setPageError(null);
      await javaHelperApi.start();
      await fetchHelperStatus();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchHelperStatus]);

  const handleDetach = useCallback(async () => {
    try {
      setPageError(null);
      await javaHelperApi.detach();
      await fetchHelperStatus();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchHelperStatus]);

  if (!serverId) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        缺少 serverId 参数
      </div>
    );
  }

  const tabs = [
    { key: 'threads' as const, label: '线程堆栈' },
    { key: 'heap' as const, label: '堆分析' },
    { key: 'jfr' as const, label: 'JFR 录制' },
    { key: 'sysprops' as const, label: '系统属性' },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/servers/${serverId}/jvm`)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ← 返回
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">JVM 深度钻取</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Server: <span className="font-mono">{serverId}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/servers/${serverId}/terminal`)}
            className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700"
          >
            跳转到终端
          </button>
          <button
            onClick={() => navigate(`/logs?serverId=${serverId}&query=JVM`)}
            className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700"
          >
            跳转到日志
          </button>
        </div>
      </div>

      {/* Error alerts */}
      {pageError && (
        <div className="flex items-start gap-2 rounded border border-danger-200 dark:border-danger-700 bg-danger-50 dark:bg-danger-700/30 p-3 text-sm text-danger-700 dark:text-danger-200">
          <span>⚠</span>
          <span className="flex-1">{pageError}</span>
          <button onClick={() => setPageError(null)} className="text-danger-400 hover:text-danger-600">✕</button>
        </div>
      )}
      {helperError && (
        <div className="text-sm text-danger-500 dark:text-danger-400">{helperError}</div>
      )}

      {/* Status Bar */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-gray-400 dark:text-gray-500 block">Helper 状态</span>
              <span className={`text-sm font-semibold ${
                attached ? 'text-success-600 dark:text-success-400' :
                helperStatus?.state === 'FAILED' ? 'text-danger-600 dark:text-danger-400' :
                'text-gray-600 dark:text-gray-400'
              }`}>
                {helperStatus?.state ?? 'IDLE'}
              </span>
            </div>
            {pid && (
              <div>
                <span className="text-xs text-gray-400 dark:text-gray-500 block">PID</span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{pid}</span>
              </div>
            )}
            {attached && jmxLatest && (
              <div>
                <span className="text-xs text-gray-400 dark:text-gray-500 block">Heap</span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {jmxLatest.heapUsedMb?.toFixed(0) ?? '?'} MB
                </span>
              </div>
            )}
            {attached && jmxLatest && (
              <div>
                <span className="text-xs text-gray-400 dark:text-gray-500 block">Threads</span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {jmxLatest.threadCount ?? '?'}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {!attached && (
              <button
                onClick={handleStart}
                disabled={helperLoading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                启动 Helper
              </button>
            )}
            {attached && (
              <button
                onClick={handleDetach}
                disabled={helperLoading}
                className="px-3 py-1.5 bg-danger-600 text-white text-sm rounded-lg hover:bg-danger-700 disabled:opacity-50"
              >
                断开 JVM
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 border-b-white dark:border-b-gray-800/50 text-primary-600 dark:text-primary-400 -mb-px'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'threads' && (
          <ThreadDumpPanel serverId={serverId} attached={attached} />
        )}
        {activeTab === 'heap' && (
          <HeapAnalysisPanel serverId={serverId} attached={attached} />
        )}
        {activeTab === 'jfr' && (
          <JfrRecordingPanel serverId={serverId} pid={pid} attached={attached} />
        )}
        {activeTab === 'sysprops' && (
          <SystemPropertiesPanel serverId={serverId} helperStatus={helperStatus} />
        )}
      </div>
    </div>
  );
}
