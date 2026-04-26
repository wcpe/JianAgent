import { type FC, useState, useCallback } from 'react';
import { apiFetch } from '../../api/client.js';
import type { JavaProcessInfo } from '@jian-agent/shared-domain';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';

const AttachExternalPanel: FC = () => {
  const [processes, setProcesses] = useState<readonly JavaProcessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [attached, setAttached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanProcesses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<JavaProcessInfo[]>('/server-process/java-processes');
      setProcesses(result);
    } catch (err: any) {
      setError(err.message ?? '扫描失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const attachToProcess = useCallback(async (pid: number) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch<void>('/server-process/attach-external', {
        method: 'POST',
        body: JSON.stringify({ pid }),
      });
      setAttached(true);
    } catch (err: any) {
      setError(err.message ?? '附着失败');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="rounded-lg bg-gray-800 p-6">
      <h2 className="text-lg font-semibold text-gray-200 mb-4">外部附着模式</h2>

      {attached && (
        <div className="mb-4 rounded bg-yellow-900/30 border border-yellow-700 p-3 text-sm text-yellow-300">
          ⚠️ 观测模式 — 不支持完整终端交互，仅可查看指标
        </div>
      )}

      <button
        onClick={scanProcesses}
        disabled={loading}
        className="mb-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '扫描中...' : '扫描 Java 进程'}
      </button>

      {error && <ErrorAlert message={error} className="mb-4" />}

      {processes.length > 0 && (
        <table className="w-full text-sm text-left">
          <thead className="text-gray-400 border-b border-gray-700">
            <tr>
              <th className="py-2 pr-4">PID</th>
              <th className="py-2 pr-4">Main Class</th>
              <th className="py-2 pr-4">Arguments</th>
              <th className="py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((proc) => (
              <tr key={proc.pid} className="border-b border-gray-700/50">
                <td className="py-2 pr-4 font-mono text-gray-300">{proc.pid}</td>
                <td className="py-2 pr-4 text-gray-300 truncate max-w-[200px]">{proc.mainClass}</td>
                <td className="py-2 pr-4 text-gray-400 truncate max-w-[300px]">{proc.arguments}</td>
                <td className="py-2">
                  <button
                    onClick={() => attachToProcess(proc.pid)}
                    disabled={loading || attached}
                    className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    附着
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {processes.length === 0 && !loading && (
        <p className="text-sm text-gray-500">点击"扫描 Java 进程"以发现可附着的进程</p>
      )}
    </div>
  );
};

export default AttachExternalPanel;
