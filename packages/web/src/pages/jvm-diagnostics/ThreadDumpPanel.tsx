import { useState, useCallback } from 'react';
import { javaHelperApi } from '../../api/java-helper.api.js';
import type { ThreadSampleDto } from '@jian-agent/shared-domain';

interface ThreadDumpPanelProps {
  serverId: string;
  attached: boolean;
}

export function ThreadDumpPanel({ serverId, attached }: ThreadDumpPanelProps) {
  const [sample, setSample] = useState<ThreadSampleDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<ReadonlySet<number>>(new Set());
  const [stateFilter, setStateFilter] = useState<string>('ALL');

  const handleSample = useCallback(async () => {
    if (!attached) return;
    setLoading(true);
    setError(null);
    try {
      const res = await javaHelperApi.sample('thread');
      setSample(res.data as ThreadSampleDto);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [attached]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const filteredThreads = sample?.threads.filter(
    (t) => stateFilter === 'ALL' || t.state === stateFilter,
  ) ?? [];

  const stateCounts = sample
    ? Object.entries(
        sample.threads.reduce<Record<string, number>>((acc, t) => {
          acc[t.state] = (acc[t.state] ?? 0) + 1;
          return acc;
        }, {}),
      ).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">线程堆栈采样</h2>
        <button
          onClick={handleSample}
          disabled={!attached || loading}
          className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '采样中…' : '执行线程采样'}
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">
          <span>⚠</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {sample && (
        <>
          <div className="flex items-center gap-3 mb-3 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              共 <strong className="text-gray-900 dark:text-gray-100">{sample.threadCount}</strong> 线程
            </span>
            <span className="text-gray-400 dark:text-gray-500">
              采样于 {new Date(sample.sampledAt).toLocaleTimeString()}
            </span>
          </div>

          {stateCounts.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => setStateFilter('ALL')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  stateFilter === 'ALL'
                    ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                全部 ({sample.threadCount})
              </button>
              {stateCounts.map(([state, count]) => (
                <button
                  key={state}
                  onClick={() => setStateFilter(state)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    stateFilter === state
                      ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {state} ({count})
                </button>
              ))}
            </div>
          )}

          <div className="overflow-auto max-h-[28rem] border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/40 sticky top-0 z-10">
                <tr>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium w-16">ID</th>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium">名称</th>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium w-28">状态</th>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium">栈顶帧</th>
                </tr>
              </thead>
              <tbody>
                {filteredThreads.map((t) => {
                  const isExpanded = expandedThreads.has(t.id);
                  return (
                    <tr
                      key={t.id}
                      className="border-t border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      onClick={() => toggleExpand(t.id)}
                    >
                      <td className="p-2 font-mono text-gray-700 dark:text-gray-300">{t.id}</td>
                      <td className="p-2 text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{t.name}</td>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          t.state === 'RUNNABLE' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                          t.state === 'BLOCKED' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                          t.state === 'WAITING' || t.state === 'TIMED_WAITING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {t.state}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className="font-mono text-gray-500 dark:text-gray-400 truncate block max-w-lg">
                          {isExpanded ? '▼' : '▶'} {t.stackTrace[0] ?? '-'}
                        </span>
                        {isExpanded && t.stackTrace.length > 1 && (
                          <div className="mt-1.5 pl-4 text-[10px] text-gray-400 dark:text-gray-500 font-mono space-y-0.5 bg-gray-50 dark:bg-gray-900/30 rounded p-2">
                            {t.stackTrace.slice(1, 30).map((frame, i) => (
                              <div key={i} className="truncate">{frame}</div>
                            ))}
                            {t.stackTrace.length > 30 && (
                              <div className="text-gray-300 dark:text-gray-600">… 还有 {t.stackTrace.length - 30} 帧</div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredThreads.length === 0 && (
              <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">无匹配线程</div>
            )}
          </div>
        </>
      )}

      {!sample && !loading && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          {attached ? '点击"执行线程采样"获取线程快照' : '请先附着到 JVM 进程'}
        </p>
      )}
    </section>
  );
}
