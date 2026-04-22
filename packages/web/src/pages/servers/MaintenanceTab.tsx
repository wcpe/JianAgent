import { useState, useEffect, useCallback } from 'react';
import { serverApi } from '../../api/server.api.js';
import type { ConditionalStopDto, ConditionType } from '@jian-agent/shared-domain';
import { Clock, X, Play, Square, RefreshCw, ShieldAlert, Activity } from 'lucide-react';

interface MaintenanceTabProps {
  readonly serverId: string;
}

export function MaintenanceTab({ serverId }: MaintenanceTabProps) {
  const [scheduled, setScheduled] = useState<{ stopAt: string; mode: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'stop' | 'restart'>('restart');
  const [stopMode, setStopMode] = useState<'graceful' | 'force'>('graceful');
  const [datetime, setDatetime] = useState('');

  // Conditional stop state
  const [condStop, setCondStop] = useState<ConditionalStopDto | null>(null);
  const [condType, setCondType] = useState<ConditionType>('no_players_for');
  const [condMinutes, setCondMinutes] = useState(10);
  const [condMemoryMb, setCondMemoryMb] = useState(4096);

  // Health state
  const [health, setHealth] = useState<{ unresponsive: boolean; restartCount: number } | null>(null);

  const loadScheduled = useCallback(async () => {
    try {
      const result = await serverApi.getScheduledStop(serverId);
      setScheduled(result);
    } catch {
      // ignore - no scheduled stop
    }
  }, [serverId]);

  const loadCondStop = useCallback(async () => {
    try {
      const result = await serverApi.getConditionalStop(serverId);
      setCondStop(result);
    } catch {
      // ignore
    }
  }, [serverId]);

  const loadHealth = useCallback(async () => {
    try {
      const result = await serverApi.getHealthStatus(serverId);
      setHealth({ unresponsive: result.unresponsive, restartCount: result.restartCount });
    } catch {
      // ignore
    }
  }, [serverId]);

  useEffect(() => {
    loadScheduled();
    loadCondStop();
    loadHealth();
  }, [loadScheduled, loadCondStop, loadHealth]);

  const handleSetCondStop = async () => {
    setError('');
    try {
      const params: Record<string, number> =
        condType === 'no_players_for' ? { minutes: condMinutes } :
        condType === 'memory_exceeds' ? { thresholdMb: condMemoryMb } :
        {};
      await serverApi.setConditionalStop(serverId, condType, params);
      loadCondStop();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '设置失败');
    }
  };

  const handleClearCondStop = async () => {
    try {
      await serverApi.clearConditionalStop(serverId);
      setCondStop(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '清除失败');
    }
  };

  const handleSchedule = async () => {
    if (!datetime) {
      setError('请选择时间');
      return;
    }
    const target = new Date(datetime);
    if (target.getTime() <= Date.now()) {
      setError('时间必须在未来');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (mode === 'stop') {
        await serverApi.scheduleStop(serverId, target.toISOString(), stopMode);
      } else {
        await serverApi.scheduleRestart(serverId, target.toISOString());
      }
      loadScheduled();
      setDatetime('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '调度失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await serverApi.cancelScheduledStop(serverId);
      setScheduled(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '取消失败');
    }
  };

  const formatRemaining = (isoDate: string): string => {
    const diff = new Date(isoDate).getTime() - Date.now();
    if (diff <= 0) return '即将执行';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}小时 ${minutes}分钟后`;
    return `${minutes}分钟后`;
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <Clock className="w-5 h-5" />
        定时维护
      </h2>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
          {error}
        </div>
      )}

      {/* Current Schedule */}
      {scheduled && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                已计划 {scheduled.mode === 'force' ? '强制停止' : '优雅停止'}
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                执行时间：{new Date(scheduled.stopAt).toLocaleString('zh-CN')}
              </p>
              <p className="text-xs text-yellow-500 dark:text-yellow-500 mt-0.5">
                {formatRemaining(scheduled.stopAt)}
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
            >
              <X className="w-4 h-4" />
              取消
            </button>
          </div>
        </div>
      )}

      {/* Schedule Form */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">创建定时任务</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">操作类型</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('restart')}
                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded text-sm border transition-colors ${
                  mode === 'restart'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                重启
              </button>
              <button
                onClick={() => setMode('stop')}
                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded text-sm border transition-colors ${
                  mode === 'stop'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Square className="w-4 h-4" />
                停止
              </button>
            </div>
          </div>

          {mode === 'stop' && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">停止模式</label>
              <select
                value={stopMode}
                onChange={(e) => setStopMode(e.target.value as 'graceful' | 'force')}
                className="w-full px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="graceful">优雅停止（等待保存）</option>
                <option value="force">强制停止（立即杀进程）</option>
              </select>
            </div>
          )}

          <div className={mode === 'stop' ? '' : 'md:col-span-2'}>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">执行时间</label>
            <input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="w-full px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Quick time buttons */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 py-1">快捷：</span>
          {[
            { label: '30分钟后', minutes: 30 },
            { label: '1小时后', minutes: 60 },
            { label: '2小时后', minutes: 120 },
            { label: '6小时后', minutes: 360 },
            { label: '明天凌晨3点', minutes: -1 },
          ].map(({ label, minutes }) => (
            <button
              key={label}
              onClick={() => {
                if (minutes === -1) {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  tomorrow.setHours(3, 0, 0, 0);
                  setDatetime(toLocalDatetime(tomorrow));
                } else {
                  setDatetime(toLocalDatetime(new Date(Date.now() + minutes * 60000)));
                }
              }}
              className="px-2 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSchedule}
            disabled={loading || !datetime}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {loading ? '调度中...' : '创建定时任务'}
          </button>
        </div>
      </div>

      {/* Conditional Stop */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          条件停止策略
        </h3>

        {condStop ? (
          <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded">
            <span className="text-sm text-orange-700 dark:text-orange-300">
              {condStop.type === 'no_players_for' && `无玩家 ${condStop.params['minutes'] ?? 10} 分钟后自动停服`}
              {condStop.type === 'memory_exceeds' && `内存超过 ${condStop.params['thresholdMb'] ?? 4096} MB 后自动停服`}
              {condStop.type === 'after_session' && '会话结束后自动停服'}
            </span>
            <button
              onClick={handleClearCondStop}
              className="ml-auto flex items-center gap-1 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800"
            >
              <X className="w-3.5 h-3.5" />
              清除
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <select
                value={condType}
                onChange={(e) => setCondType(e.target.value as ConditionType)}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
              >
                <option value="no_players_for">无玩家空闲</option>
                <option value="memory_exceeds">内存超限</option>
                <option value="after_session">会话结束</option>
              </select>

              {condType === 'no_players_for' && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={condMinutes}
                    onChange={(e) => setCondMinutes(Number(e.target.value))}
                    min={1}
                    max={1440}
                    className="w-20 px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">分钟</span>
                </div>
              )}

              {condType === 'memory_exceeds' && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={condMemoryMb}
                    onChange={(e) => setCondMemoryMb(Number(e.target.value))}
                    min={512}
                    step={512}
                    className="w-24 px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">MB</span>
                </div>
              )}

              <button
                onClick={handleSetCondStop}
                className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                启用
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Health Status */}
      {health && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            健康状态
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${health.unresponsive ? 'bg-red-500' : 'bg-green-500'}`} />
              <span className="text-gray-700 dark:text-gray-300">
                {health.unresponsive ? '无响应' : '正常'}
              </span>
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              崩溃重启次数: <span className="font-mono">{health.restartCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
        <p>• 定时重启：到达指定时间后优雅停止服务器，并自动重新启动</p>
        <p>• 定时停止：到达指定时间后停止服务器（可选优雅/强制）</p>
        <p>• 停止前 60 秒和 10 秒会发出预警事件</p>
        <p>• 条件停止：满足指定条件后自动停服（无玩家空闲/内存超限/会话结束）</p>
        <p>• 健康监控：自动检测进程 PID 存活和快照响应超时</p>
      </div>
    </div>
  );
}

function toLocalDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
