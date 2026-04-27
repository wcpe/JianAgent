import { useEffect, useCallback, useState } from 'react';
import { ErrorAlert } from '../components/ui/ErrorAlert.js';
import { useProbeStore } from '../stores/probe.store.js';
import type { ProbeResultEntry } from '../stores/probe.store.js';
import { ProbeStatusBadge } from '../components/ProbeStatusBadge.js';
import { SnapshotCard } from '../components/SnapshotCard.js';
import { CommandPanel } from '../components/CommandPanel.js';
import { ProbeConsolePanel } from '../components/ProbeConsolePanel.js';
import { ProbeScriptEditor } from '../components/ProbeScriptEditor.js';
import { useJavaHelperStore } from '../stores/java-helper.store.js';
import { javaHelperApi } from '../api/java-helper.api.js';
import type { JarScanResult, JvmRecommendation } from '../api/java-helper.api.js';
import { useWsChannel } from '../ws/use-ws-channel.js';
import type { JavaHelperStatusDto, ThreadSampleDto, HeapSampleDto, ProbeSnapshotDto } from '@jian-agent/shared-domain';

export function DiagnosticsPage() {
  const {
    connections, snapshots, selectedServerId,
    loading, error,
    fetchConnections, fetchSnapshots, selectServer,
    pushSnapshot, pushConsoleResult, pushEvalResult,
  } = useProbeStore();

  const {
    status: helperStatus,
    lastThreadSample,
    lastHeapSample,
    loading: helperLoading,
    error: helperError,
    fetchStatus: fetchHelperStatus,
    setStatus: setHelperStatus,
    setThreadSample,
    setHeapSample,
  } = useJavaHelperStore();

  const [resolveResult, setResolveResult] = useState<any>(null);
  const [jarPath, setJarPath] = useState('');
  const [scanResult, setScanResult] = useState<JarScanResult | null>(null);
  const [jvmRec, setJvmRec] = useState<JvmRecommendation | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<ReadonlySet<number>>(new Set());
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      fetchConnections();
      fetchSnapshots();
      fetchHelperStatus();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchConnections, fetchSnapshots, fetchHelperStatus]);

  const handleWsStatus = useCallback(
    (payload: JavaHelperStatusDto) => setHelperStatus(payload),
    [setHelperStatus],
  );
  useWsChannel('resource:java-helper:status', handleWsStatus);

  const handleWsSnapshot = useCallback(
    (payload: ProbeSnapshotDto & { serverId?: string }) => {
      const sid = payload.serverId ?? selectedServerId;
      if (sid) pushSnapshot(sid, payload);
    },
    [pushSnapshot, selectedServerId],
  );
  useWsChannel('resource:plugin:snapshot', handleWsSnapshot);

  const handleWsPluginStatus = useCallback(
    (payload: Record<string, unknown>) => {
      const channel = payload.channel as string | undefined;
      const entry: ProbeResultEntry = {
        requestId: (payload.requestId as string) ?? 'unknown',
        success: (payload.success as boolean) ?? false,
        message: (payload.message as string) ?? '',
        timestamp: new Date().toISOString(),
      };
      if (channel === 'plugin:console-result') {
        pushConsoleResult(entry);
      } else if (channel === 'plugin:eval-result') {
        pushEvalResult(entry);
      }
    },
    [pushConsoleResult, pushEvalResult],
  );
  useWsChannel('resource:plugin:status', handleWsPluginStatus);

  const handleStart = useCallback(async () => {
    try {
      setPageError(null);
      await javaHelperApi.start();
      await fetchHelperStatus();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchHelperStatus]);

  const handleResolve = useCallback(async () => {
    try {
      setPageError(null);
      const res = await javaHelperApi.resolve();
      setResolveResult(res.data);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleAttach = useCallback(async (pid: string) => {
    try {
      setPageError(null);
      await javaHelperApi.attach(pid);
      await fetchHelperStatus();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchHelperStatus]);

  const handleSampleThreads = useCallback(async () => {
    try {
      setPageError(null);
      const res = await javaHelperApi.sample('thread');
      setThreadSample(res.data as ThreadSampleDto);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : String(err));
    }
  }, [setThreadSample]);

  const handleSampleHeap = useCallback(async () => {
    try {
      setPageError(null);
      const res = await javaHelperApi.sample('heap');
      setHeapSample(res.data as HeapSampleDto);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : String(err));
    }
  }, [setHeapSample]);

  const handleDetach = useCallback(async () => {
    try {
      setPageError(null);
      await javaHelperApi.detach();
      await fetchHelperStatus();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchHelperStatus]);

  const handleScanJar = useCallback(async () => {
    if (!jarPath.trim()) return;
    setScanLoading(true);
    setPageError(null);
    try {
      const res = await javaHelperApi.scanJar(jarPath.trim());
      setScanResult(res.data);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanLoading(false);
    }
  }, [jarPath]);

  const handleRecommendJvm = useCallback(async () => {
    if (!jarPath.trim()) return;
    setScanLoading(true);
    setPageError(null);
    try {
      const res = await javaHelperApi.recommendJvmArgs(jarPath.trim());
      setJvmRec(res.data);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanLoading(false);
    }
  }, [jarPath]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">插件探针诊断</h1>

      {error && <ErrorAlert message={error} className="mb-4" />}
      {pageError && <ErrorAlert message={pageError} onDismiss={() => setPageError(null)} className="mb-4" />}
      {loading && <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">加载中…</p>}

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">已连接服务器</h2>
        {Array.isArray(connections) && connections.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {connections.map((c) => (
              <button
                key={c.id}
                onClick={() => selectServer(c.serverId)}
                className={`border border-gray-200 dark:border-gray-700 rounded p-3 text-left bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                  selectedServerId === c.serverId ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{c.serverId}</span>
                  <ProbeStatusBadge connected={true} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  协议 v{c.protocolVersion} · {new Date(c.connectedAt).toLocaleTimeString()}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 dark:text-gray-500 text-sm">暂无已连接的服务器</p>
        )}
      </section>

      {selectedServerId && (
        <section className="space-y-4">
          <SnapshotCard serverId={selectedServerId} snapshot={snapshots.get(selectedServerId)} />
          <CommandPanel serverId={selectedServerId} />
          <ProbeConsolePanel serverId={selectedServerId} />
          <ProbeScriptEditor serverId={selectedServerId} />
        </section>
      )}

      {/* Java Helper Section */}
      <section className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Java Helper 深度诊断</h2>
        {helperError && <p className="text-danger-500 text-sm mb-2">{helperError}</p>}

        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            状态:{' '}
            <span className={`font-medium ${
              helperStatus?.state === 'ATTACHED' ? 'text-success-600 dark:text-success-400' :
              helperStatus?.state === 'FAILED' ? 'text-danger-600 dark:text-danger-400' : 'text-gray-600 dark:text-gray-400'
            }`}>
              {helperStatus?.state ?? 'IDLE'}
            </span>
          </span>
          {helperStatus?.attachedPid && (
            <span className="text-sm text-gray-500 dark:text-gray-400">PID: {helperStatus.attachedPid}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={handleStart} disabled={helperLoading} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">启动 Helper</button>
          <button onClick={handleResolve} disabled={helperLoading} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">发现 JVM</button>
          <button onClick={handleSampleThreads} disabled={helperLoading || helperStatus?.state !== 'ATTACHED'} className="px-3 py-1 bg-warning-600 text-white rounded text-sm hover:bg-warning-700 disabled:opacity-50">线程采样</button>
          <button onClick={handleSampleHeap} disabled={helperLoading || helperStatus?.state !== 'ATTACHED'} className="px-3 py-1 bg-warning-600 text-white rounded text-sm hover:bg-warning-700 disabled:opacity-50">堆采样</button>
          <button onClick={handleDetach} disabled={helperLoading || helperStatus?.state !== 'ATTACHED'} className="px-3 py-1 bg-danger-600 text-white rounded text-sm hover:bg-danger-700 disabled:opacity-50">断开</button>
        </div>

        {/* Resolve results */}
        {resolveResult && Array.isArray(resolveResult.data) && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">发现的 JVM 进程</h3>
            <div className="space-y-1">
              {resolveResult.data.map((p: any) => (
                <div key={p.pid} className="flex items-center gap-2 text-sm border border-gray-200 dark:border-gray-700 rounded p-2 bg-white dark:bg-gray-800/50">
                  <span className="font-mono text-gray-700 dark:text-gray-300">{p.pid}</span>
                  <span className="text-gray-600 dark:text-gray-400 flex-1 truncate">{p.displayName}</span>
                  {p.isMinecraft && <span className="text-success-600 dark:text-success-400 text-xs">[MC]</span>}
                  <button
                    onClick={() => handleAttach(p.pid)}
                    className="px-2 py-0.5 bg-success-600 text-white rounded text-xs hover:bg-success-700"
                  >
                    附着
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Thread sample */}
        {lastThreadSample && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                线程采样 ({lastThreadSample.threadCount} 线程)
              </h3>
              <span className="text-xs text-gray-400">{new Date(lastThreadSample.sampledAt).toLocaleTimeString()}</span>
            </div>
            <div className="overflow-auto max-h-80 border border-gray-200 dark:border-gray-700 rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900/40 sticky top-0">
                  <tr>
                    <th className="p-1.5 text-left text-gray-700 dark:text-gray-300">ID</th>
                    <th className="p-1.5 text-left text-gray-700 dark:text-gray-300">名称</th>
                    <th className="p-1.5 text-left text-gray-700 dark:text-gray-300">状态</th>
                    <th className="p-1.5 text-left text-gray-700 dark:text-gray-300">栈顶</th>
                  </tr>
                </thead>
                <tbody>
                  {lastThreadSample.threads.map((t) => {
                    const isExpanded = expandedThreads.has(t.id);
                    return (
                      <tr key={t.id}
                        className="border-t border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        onClick={() => setExpandedThreads((prev) => {
                          const next = new Set(prev);
                          if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                          return next;
                        })}
                      >
                        <td className="p-1.5 font-mono text-gray-700 dark:text-gray-300">{t.id}</td>
                        <td className="p-1.5 text-gray-700 dark:text-gray-300">{t.name}</td>
                        <td className="p-1.5">
                          <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${
                            t.state === 'RUNNABLE' ? 'bg-success-100 text-success-700 dark:bg-success-700/40 dark:text-success-400' :
                            t.state === 'BLOCKED' ? 'bg-danger-100 text-danger-700 dark:bg-danger-700/40 dark:text-danger-400' :
                            t.state === 'WAITING' || t.state === 'TIMED_WAITING' ? 'bg-warning-100 text-warning-700 dark:bg-warning-700/40 dark:text-warning-400' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>{t.state}</span>
                        </td>
                        <td className="p-1.5">
                          <span className="font-mono text-gray-500 dark:text-gray-400 truncate block max-w-xs">
                            {isExpanded ? '▼' : '▶'} {t.stackTrace[0] ?? '-'}
                          </span>
                          {isExpanded && t.stackTrace.length > 1 && (
                            <div className="mt-1 pl-4 text-[10px] text-gray-400 dark:text-gray-500 font-mono space-y-0.5">
                              {t.stackTrace.slice(1, 20).map((frame, i) => (
                                <div key={i} className="truncate">{frame}</div>
                              ))}
                              {t.stackTrace.length > 20 && (
                                <div className="text-gray-300 dark:text-gray-600">... 还有 {t.stackTrace.length - 20} 帧</div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Heap sample */}
        {lastHeapSample && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">堆内存采样</h3>
              <span className="text-xs text-gray-400">{new Date(lastHeapSample.sampledAt).toLocaleTimeString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-800/50">
                <p className="text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">堆内存</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded h-4 mb-1">
                  <div className="bg-blue-600 h-4 rounded" style={{ width: `${Math.min(lastHeapSample.heapUsage.usagePercent ?? 0, 100)}%` }} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {lastHeapSample.heapUsage.used != null ? (lastHeapSample.heapUsage.used / 1024 / 1024).toFixed(0) : '—'} MB / {lastHeapSample.heapUsage.max != null ? (lastHeapSample.heapUsage.max / 1024 / 1024).toFixed(0) : '—'} MB ({lastHeapSample.heapUsage.usagePercent != null ? lastHeapSample.heapUsage.usagePercent.toFixed(1) : '—'}%)
                </p>
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-800/50">
                <p className="text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">非堆内存</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded h-4 mb-1">
                  <div className="bg-purple-600 h-4 rounded" style={{ width: `${Math.min(lastHeapSample.nonHeapUsage.usagePercent ?? 0, 100)}%` }} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {lastHeapSample.nonHeapUsage.used != null ? (lastHeapSample.nonHeapUsage.used / 1024 / 1024).toFixed(0) : '—'} MB / {lastHeapSample.nonHeapUsage.max != null ? (lastHeapSample.nonHeapUsage.max / 1024 / 1024).toFixed(0) : '—'} MB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Jar Scanning & JVM Recommendation */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h3 className="text-md font-semibold mb-3 text-gray-800 dark:text-gray-200">Jar 扫描与启动参数推荐</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={jarPath}
              onChange={(e) => setJarPath(e.target.value)}
              placeholder="输入 server.jar 路径"
              className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded px-3 py-1 text-sm"
            />
            <button onClick={handleScanJar} disabled={scanLoading || !jarPath.trim()} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              扫描入口类
            </button>
            <button onClick={handleRecommendJvm} disabled={scanLoading || !jarPath.trim()} className="px-3 py-1 bg-success-600 text-white rounded text-sm hover:bg-success-700 disabled:opacity-50">
              推荐 JVM 参数
            </button>
          </div>

          {scanResult && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">共 {scanResult.totalClasses} 个类</p>
              {scanResult.entryClasses.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">未发现入口类</p>
              ) : (
                <div className="space-y-1">
                  {scanResult.entryClasses.map((ec) => (
                    <div key={ec.className} className="flex items-center gap-2 text-sm border border-gray-200 dark:border-gray-700 rounded p-2 bg-white dark:bg-gray-800/50">
                      <span className="font-mono flex-1 text-gray-700 dark:text-gray-300">{ec.className}</span>
                      {ec.isMainClass && <span className="text-success-600 dark:text-success-400 text-xs font-medium">[Main]</span>}
                      <span className="text-gray-400 dark:text-gray-500 text-xs">{ec.source}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {jvmRec && (
            <div className="mb-3">
              <h4 className="text-sm font-semibold mb-1 text-gray-800 dark:text-gray-200">推荐启动参数</h4>
              <pre className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs font-mono whitespace-pre-wrap mb-2 text-gray-700 dark:text-gray-300">
                {jvmRec.recommended.join(' ')}
              </pre>
              <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                {jvmRec.explanation.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
