import { useState, useCallback } from 'react';
import { javaHelperApi } from '../../api/java-helper.api.js';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';
import type { HeapSampleDto } from '@jian-agent/shared-domain';

interface HeapAnalysisPanelProps {
  serverId: string;
  attached: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function UsageBar({ label, used, max, committed, color }: { label: string; used: number; max: number; committed: number; color: string }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const committedPct = max > 0 ? Math.min((committed / max) * 100, 100) : 0;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{pct.toFixed(1)}%</span>
      </div>
      <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-5 mb-2 overflow-hidden">
        <div
          className={`${color} h-5 rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
        {committedPct > pct && (
          <div
            className="absolute top-0 h-5 border-r-2 border-dashed border-gray-400 dark:border-gray-500"
            style={{ left: `${committedPct}%` }}
            title={`Committed: ${formatBytes(committed)}`}
          />
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-gray-400 dark:text-gray-500">已用</div>
          <div className="font-medium text-gray-700 dark:text-gray-300">{formatBytes(used)}</div>
        </div>
        <div>
          <div className="text-gray-400 dark:text-gray-500">已提交</div>
          <div className="font-medium text-gray-700 dark:text-gray-300">{formatBytes(committed)}</div>
        </div>
        <div>
          <div className="text-gray-400 dark:text-gray-500">最大</div>
          <div className="font-medium text-gray-700 dark:text-gray-300">{max > 0 ? formatBytes(max) : 'N/A'}</div>
        </div>
      </div>
    </div>
  );
}

export function HeapAnalysisPanel({ serverId, attached }: HeapAnalysisPanelProps) {
  const [sample, setSample] = useState<HeapSampleDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSample = useCallback(async () => {
    if (!attached) return;
    setLoading(true);
    setError(null);
    try {
      const res = await javaHelperApi.sample('heap');
      setSample(res.data as HeapSampleDto);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [attached]);

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">堆内存分析</h2>
        <button
          onClick={handleSample}
          disabled={!attached || loading}
          className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '采样中…' : '执行堆采样'}
        </button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} className="mb-3" />}

      {sample && (
        <>
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            采样于 {new Date(sample.sampledAt).toLocaleTimeString()}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UsageBar
              label="堆内存 (Heap)"
              used={sample.heapUsage.used}
              max={sample.heapUsage.max}
              committed={sample.heapUsage.committed}
              color="bg-blue-500 dark:bg-blue-600"
            />
            <UsageBar
              label="非堆内存 (Non-Heap)"
              used={sample.nonHeapUsage.used}
              max={sample.nonHeapUsage.max}
              committed={sample.nonHeapUsage.committed}
              color="bg-purple-500 dark:bg-purple-600"
            />
          </div>
        </>
      )}

      {!sample && !loading && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          {attached ? '点击"执行堆采样"获取堆内存快照' : '请先附着到 JVM 进程'}
        </p>
      )}
    </section>
  );
}
