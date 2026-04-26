import { type FC, useState, useEffect, useCallback } from 'react';
import { workerApi } from '../../api/worker.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import type { WorkerInfoDto, SchedulingStrategy } from '@jian-agent/shared-domain';

const STRATEGY_OPTIONS: readonly { readonly value: SchedulingStrategy; readonly label: string }[] = [
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'least_loaded', label: 'Least Loaded' },
  { value: 'capacity_aware', label: 'Capacity Aware' },
];

const WorkerDashboard: FC = () => {
  const [workers, setWorkers] = useState<WorkerInfoDto[]>([]);
  const [strategy, setStrategy] = useState<SchedulingStrategy>('capacity_aware');
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [distributeCount, setDistributeCount] = useState(10);
  const [loading, setLoading] = useState(false);

  // Auto-refresh workers list every 5s
  useEffect(() => {
    const fetchWorkers = () => {
      workerApi.listWorkers().then(setWorkers).catch(() => {});
    };
    fetchWorkers();
    const timer = setInterval(fetchWorkers, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleDistribute = useCallback(async () => {
    setLoading(true);
    try {
      const plan = await workerApi.distributeBots(distributeCount);
      useDialogStore.getState().showToast(`分配计划: ${plan.assignments.map((a) => `${a.workerId}: ${a.botCount}`).join(', ')}`, 'success');
    } catch (err: any) {
      useDialogStore.getState().showToast(`分配失败: ${(err as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [distributeCount]);

  const handleSaveStrategy = useCallback(async () => {
    try {
      await workerApi.setStrategy(strategy);
    } catch (err: any) {
      useDialogStore.getState().showToast(`保存策略失败: ${(err as Error).message}`, 'error');
    }
  }, [strategy]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-success-400';
      case 'unhealthy': return 'text-warning-400';
      case 'offline': return 'text-danger-400';
      default: return 'text-zinc-500';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'online': return '🟢';
      case 'unhealthy': return '🟡';
      case 'offline': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-zinc-100">Worker 监控面板</h1>

      {/* Worker cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workers.length === 0 && (
          <p className="text-sm text-zinc-500 col-span-full">暂无注册的 Worker</p>
        )}
        {workers.map((w) => {
          const loadPercent = w.maxCapacity > 0 ? Math.round((w.currentLoad / w.maxCapacity) * 100) : 0;
          const elapsed = Math.round((Date.now() - w.lastHeartbeat) / 1000);
          const isSelected = selectedWorker === w.workerId;

          return (
            <button
              key={w.workerId}
              onClick={() => setSelectedWorker(isSelected ? null : w.workerId)}
              className={`text-left w-full p-4 rounded-lg border transition-colors ${
                isSelected
                  ? 'bg-zinc-700 border-blue-500'
                  : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-zinc-100 text-sm">{w.workerId}</span>
                <span className={`text-xs ${statusColor(w.status)}`}>
                  {statusIcon(w.status)} {w.status}
                </span>
              </div>
              <div className="text-xs text-zinc-400 mb-2">
                {w.hostname}:{w.port}
              </div>

              {/* Load bar */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-zinc-500 w-8">负载</span>
                <div className="flex-1 h-2 bg-zinc-700 rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${
                      loadPercent > 80 ? 'bg-danger-500' : loadPercent > 50 ? 'bg-warning-500' : 'bg-success-500'
                    }`}
                    style={{ width: `${loadPercent}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 w-16 text-right">
                  {w.currentLoad}/{w.maxCapacity}
                </span>
              </div>

              {w.tags.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {w.tags.map((t) => (
                    <span key={t} className="px-1.5 py-0.5 bg-zinc-700 rounded text-[10px] text-zinc-400">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className="text-[11px] text-zinc-500 mt-2">
                最后心跳: {elapsed}秒前
              </div>
            </button>
          );
        })}
      </div>

      {/* Strategy selector */}
      <div className="bg-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">调度策略</h2>
        <div className="flex items-center gap-2">
          {STRATEGY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStrategy(opt.value)}
              className={`px-3 py-1.5 rounded text-sm ${
                strategy === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={handleSaveStrategy}
            className="ml-2 px-3 py-1.5 rounded bg-success-600 hover:bg-success-500 text-white text-sm"
          >
            保存策略
          </button>
        </div>
      </div>

      {/* Bot distribution */}
      <div className="bg-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">Bot 分配</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-400">分配数量:</label>
          <input
            type="number"
            min={1}
            max={1000}
            value={distributeCount}
            onChange={(e) => setDistributeCount(Number(e.target.value))}
            className="w-24 px-3 py-1.5 rounded bg-zinc-700 border border-zinc-600 text-zinc-100 text-sm"
          />
          <button
            onClick={handleDistribute}
            disabled={loading}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm"
          >
            {loading ? '分配中...' : '分配 Bot'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkerDashboard;
