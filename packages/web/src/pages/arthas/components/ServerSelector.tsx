import React, { useEffect, useState } from 'react';
import { Server, Loader2 } from 'lucide-react';
import { jvmApi, type JvmProcess } from '../../../api/jvm.api.js';

interface ServerSelectorProps {
  readonly selectedPid: number | null;
  readonly onSelect: (pid: number) => void;
  readonly disabled?: boolean;
}

export function ServerSelector({ selectedPid, onSelect, disabled }: ServerSelectorProps) {
  const [processes, setProcesses] = useState<JvmProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProcesses = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await jvmApi.listProcesses();
        const filtered = data.filter((p) => !p.command.includes('java-helper'));
        setProcesses(filtered);
      } catch (err: any) {
        setError(err?.message ?? '获取进程列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchProcesses();
    const interval = setInterval(fetchProcesses, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && processes.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg border border-gray-700">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-400">加载进程列表...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-2 bg-red-900/20 rounded-lg border border-red-700">
        <span className="text-sm text-red-400">{error}</span>
      </div>
    );
  }

  if (processes.length === 0) {
    return (
      <div className="px-4 py-2 bg-gray-800 rounded-lg border border-gray-700">
        <span className="text-sm text-gray-400">未发现 Java 进程</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Server className="w-5 h-5 text-gray-400" />
      <select
        value={selectedPid ?? ''}
        onChange={(e) => onSelect(Number(e.target.value))}
        disabled={disabled}
        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">选择 Java 进程</option>
        {processes.map((proc) => (
          <option key={proc.pid} value={proc.pid}>
            PID {proc.pid} - {proc.name ?? proc.mainClass ?? proc.command.slice(0, 50)}
          </option>
        ))}
      </select>
    </div>
  );
}
