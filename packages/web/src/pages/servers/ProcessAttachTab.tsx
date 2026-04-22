import { useState, useEffect, useCallback } from 'react';
import { serverApi } from '../../api/server.api.js';
import { RefreshCw, Link2, Unlink, Search, Cpu } from 'lucide-react';

interface JavaProcess {
  readonly pid: number;
  readonly command: string;
}

export function ProcessAttachTab({ serverId }: { readonly serverId: string }) {
  const [processes, setProcesses] = useState<readonly JavaProcess[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [attachedPid, setAttachedPid] = useState<number | null>(null);

  const loadProcesses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await serverApi.listJavaProcesses();
      setProcesses(res.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '获取进程列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProcesses();
  }, [loadProcesses]);

  const handleAttach = async (pid: number) => {
    setError('');
    setMessage('');
    try {
      const res = await serverApi.attachProcess(serverId, pid);
      if (res.success) {
        setMessage(`成功附着到 PID ${pid}`);
        setAttachedPid(pid);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '附着失败');
    }
  };

  const handleDetach = async () => {
    setError('');
    setMessage('');
    try {
      await serverApi.detachProcess(serverId);
      setMessage('已解除附着');
      setAttachedPid(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '解除附着失败');
    }
  };

  const filtered = filter
    ? processes.filter(
        (p) =>
          String(p.pid).includes(filter) ||
          p.command.toLowerCase().includes(filter.toLowerCase()),
      )
    : processes;

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Cpu className="w-5 h-5" />
          外部进程附着
        </h2>
        <button
          onClick={loadProcesses}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新进程
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 text-sm">
          {message}
        </div>
      )}

      {/* Attached status */}
      {attachedPid && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded">
          <Link2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            已附着到 PID <strong>{attachedPid}</strong>
          </span>
          <button
            onClick={handleDetach}
            className="ml-auto flex items-center gap-1 px-3 py-1 text-sm bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800"
          >
            <Unlink className="w-3.5 h-3.5" />
            解除附着
          </button>
        </div>
      )}

      {/* Search filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="搜索 PID 或命令行..."
          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Process list */}
      <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-24">PID</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">命令行</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400 w-24">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  {loading ? '加载中...' : processes.length === 0 ? '未发现 Java 进程' : '无匹配结果'}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.pid} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2 font-mono text-gray-900 dark:text-gray-100">{p.pid}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[500px]" title={p.command}>
                    {p.command}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleAttach(p.pid)}
                      disabled={attachedPid === p.pid}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      附着
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>• 外部附着模式用于监控非本系统启动的 Minecraft 服务器进程</p>
        <p>• 附着后可获取进程状态、PID 监控，但无法控制进程的启停</p>
        <p>• 若进程退出或 PID 消失，系统会自动检测并发出告警</p>
      </div>
    </div>
  );
}
