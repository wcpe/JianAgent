import { useState, useEffect, useCallback } from 'react';
import { javaHelperApi } from '../../api/java-helper.api.js';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';
import type { JfrTask } from '../../api/java-helper.api.js';

interface JfrRecordingPanelProps {
  serverId: string;
  pid: string;
  attached: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-success-100 text-success-700 dark:bg-success-700/40 dark:text-success-400',
  completed: 'bg-info-100 text-info-700 dark:bg-info-700/40 dark:text-info-400',
  failed: 'bg-danger-100 text-danger-700 dark:bg-danger-700/40 dark:text-danger-400',
  expired: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  pending: 'bg-warning-100 text-warning-700 dark:bg-warning-700/40 dark:text-warning-400',
  approved: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400',
};

export function JfrRecordingPanel({ serverId, pid, attached }: JfrRecordingPanelProps) {
  const [tasks, setTasks] = useState<JfrTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [durationSec, setDurationSec] = useState(60);
  const [settings, setSettings] = useState<'default' | 'profile'>('default');

  const refresh = useCallback(async () => {
    if (!attached) return;
    try {
      const res = await javaHelperApi.listJfrTasks(serverId);
      setTasks(res.data);
    } catch (err) {
      console.error('[JfrRecordingPanel] refresh error:', err);
    }
  }, [attached, serverId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = useCallback(async (fn: () => Promise<void>, successMsg: string) => {
    setLoading(true);
    setError(null);
    setMessage('');
    try {
      await fn();
      setMessage(successMsg);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const handleStart = () => {
    if (!attached || !pid) return;
    runAction(
      () => javaHelperApi.startJfr({ serverId, pid, durationSec, settings }).then(() => {}),
      `JFR 录制已启动 (${settings}, ${durationSec}s)`,
    );
  };

  const handleStop = (taskId: string) => {
    runAction(() => javaHelperApi.stopJfr(taskId).then(() => {}), 'JFR 任务已停止');
  };

  const handleDownload = async (taskId: string) => {
    try {
      const blob = await javaHelperApi.downloadJfrStream(taskId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jfr-${taskId.slice(0, 8)}.jfr`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('JFR 文件已下载');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">JFR 飞行记录</h2>
        <button
          onClick={() => refresh()}
          disabled={!attached}
          className="text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
        >
          刷新列表
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">时长 (秒)</label>
          <input
            type="number"
            value={durationSec}
            onChange={(e) => setDurationSec(Math.max(1, Number(e.target.value)))}
            min={1}
            className="w-24 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">配置</label>
          <select
            value={settings}
            onChange={(e) => setSettings(e.target.value as 'default' | 'profile')}
            className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200"
          >
            <option value="default">Default</option>
            <option value="profile">Profile</option>
          </select>
        </div>
        <button
          onClick={handleStart}
          disabled={!attached || !pid || loading}
          className="px-4 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          启动录制
        </button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} className="mb-3" />}

      {message && (
        <div className="mb-3 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded p-2">
          {message}
        </div>
      )}

      <div className="space-y-2">
        {tasks.length === 0 && !loading && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">暂无 JFR 任务</p>
        )}
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex flex-wrap items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <span className="font-mono text-xs text-gray-600 dark:text-gray-400 w-20 truncate">{task.id.slice(0, 8)}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[task.status] ?? ''}`}>
              {task.status}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(task.startedAt).toLocaleTimeString()}
              {task.endedAt ? ` → ${new Date(task.endedAt).toLocaleTimeString()}` : ''}
            </span>
            <div className="flex-1" />
            {task.status === 'running' && (
              <button
                onClick={() => handleStop(task.id)}
                disabled={loading}
                className="px-2.5 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 disabled:opacity-50"
              >
                停止
              </button>
            )}
            {task.status === 'completed' && (
              <button
                onClick={() => handleDownload(task.id)}
                className="px-2.5 py-1 bg-gray-800 text-white text-xs rounded hover:bg-gray-900 dark:bg-gray-600 dark:hover:bg-gray-500"
              >
                下载 .jfr
              </button>
            )}
            {task.error && (
              <span className="text-xs text-danger-500 dark:text-danger-400 truncate max-w-xs">{task.error}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
