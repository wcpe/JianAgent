import { type FC, useState, useEffect, useCallback } from 'react';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import { apiFetch } from '../../api/client.js';
import type { ScheduledStopDto, ConditionalStopDto, ConditionType } from '@jian-agent/shared-domain';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';

interface StopStrategyPanelProps {
  readonly serverId: string;
}

const StopStrategyPanel: FC<StopStrategyPanelProps> = ({ serverId }) => {
  // Scheduled stop state
  const [stopAt, setStopAt] = useState('');
  const [stopMode, setStopMode] = useState<'graceful' | 'force'>('graceful');
  const [currentSchedule, setCurrentSchedule] = useState<{ stopAt: string; mode: string } | null>(null);

  // Conditional stop state
  const [conditionType, setConditionType] = useState<ConditionType>('no_players_for');
  const [conditionParam, setConditionParam] = useState(10);
  const [currentCondition, setCurrentCondition] = useState<{ type: string; params: Record<string, number> } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrent = useCallback(async () => {
    try {
      const schedule = await apiFetch<{ stopAt: string; mode: string } | null>(
        `/server-process/scheduled-stop?serverId=${encodeURIComponent(serverId)}`
      ).catch(() => null);
      setCurrentSchedule(schedule);

      const condition = await apiFetch<{ type: string; params: Record<string, number> } | null>(
        `/server-process/conditional-stop?serverId=${encodeURIComponent(serverId)}`
      ).catch(() => null);
      setCurrentCondition(condition);
    } catch {
      // ignore
    }
  }, [serverId]);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  const scheduleStop = useCallback(async () => {
    if (!stopAt) return;
    setLoading(true);
    setError(null);
    try {
      const dto: ScheduledStopDto = { serverId, stopAt: new Date(stopAt).toISOString(), mode: stopMode };
      await apiFetch<void>('/server-process/schedule-stop', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      await fetchCurrent();
    } catch (err: any) {
      setError(err.message ?? '设定失败');
    } finally {
      setLoading(false);
    }
  }, [serverId, stopAt, stopMode, fetchCurrent]);

  const cancelSchedule = useCallback(async () => {
    setLoading(true);
    try {
      await apiFetch<void>(`/server-process/schedule-stop?serverId=${encodeURIComponent(serverId)}`, {
        method: 'DELETE',
      });
      setCurrentSchedule(null);
    } catch (err: any) {
      setError(err.message ?? '取消失败');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  const setCondition = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, number> =
        conditionType === 'no_players_for'
          ? { minutes: conditionParam }
          : conditionType === 'memory_exceeds'
            ? { thresholdMb: conditionParam }
            : {};
      const dto: ConditionalStopDto = { serverId, type: conditionType, params };
      await apiFetch<void>('/server-process/conditional-stop', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      await fetchCurrent();
    } catch (err: any) {
      setError(err.message ?? '设定失败');
    } finally {
      setLoading(false);
    }
  }, [serverId, conditionType, conditionParam, fetchCurrent]);

  const clearCondition = useCallback(async () => {
    setLoading(true);
    try {
      await apiFetch<void>(`/server-process/conditional-stop?serverId=${encodeURIComponent(serverId)}`, {
        method: 'DELETE',
      });
      setCurrentCondition(null);
    } catch (err: any) {
      setError(err.message ?? '清除失败');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  return (
    <div className="rounded-lg bg-gray-800 p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-200">停止策略</h2>
      {error && <ErrorAlert message={error} />}

      {/* Scheduled Stop */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-300">定时停止</h3>
        {currentSchedule ? (
          <div className="flex items-center gap-3 rounded bg-gray-700 p-3 text-sm">
            <span className="text-gray-300">
              计划于 {new Date(currentSchedule.stopAt).toLocaleString()} 以 {currentSchedule.mode} 方式停止
            </span>
            <button
              onClick={cancelSchedule}
              disabled={loading}
              className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <label className="block">
              <span className="text-xs text-gray-400">停止时间</span>
              <input
                type="datetime-local"
                value={stopAt}
                onChange={(e) => setStopAt(e.target.value)}
                className="mt-1 block w-full rounded bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-gray-200"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">模式</span>
              <StyledSelect
                value={stopMode}
                onChange={(e) => setStopMode(e.target.value as 'graceful' | 'force')}
              >
                <option value="graceful">优雅停止</option>
                <option value="force">强制停止</option>
              </StyledSelect>
            </label>
            <button
              onClick={scheduleStop}
              disabled={loading || !stopAt}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              设定
            </button>
          </div>
        )}
      </div>

      {/* Conditional Stop */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-300">条件停止</h3>
        {currentCondition ? (
          <div className="flex items-center gap-3 rounded bg-gray-700 p-3 text-sm">
            <span className="text-gray-300">
              条件：{currentCondition.type} ({JSON.stringify(currentCondition.params)})
            </span>
            <button
              onClick={clearCondition}
              disabled={loading}
              className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
            >
              清除
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <label className="block">
              <span className="text-xs text-gray-400">条件类型</span>
              <StyledSelect
                value={conditionType}
                onChange={(e) => setConditionType(e.target.value as ConditionType)}
              >
                <option value="no_players_for">无玩家持续</option>
                <option value="after_session">会话结束后</option>
                <option value="memory_exceeds">内存超限</option>
              </StyledSelect>
            </label>
            {conditionType !== 'after_session' && (
              <label className="block">
                <span className="text-xs text-gray-400">
                  {conditionType === 'no_players_for' ? '分钟数' : '内存阈值 (MB)'}
                </span>
                <input
                  type="number"
                  value={conditionParam}
                  onChange={(e) => setConditionParam(Number(e.target.value))}
                  className="mt-1 block w-24 rounded bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-gray-200"
                />
              </label>
            )}
            <button
              onClick={setCondition}
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              启用
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StopStrategyPanel;
