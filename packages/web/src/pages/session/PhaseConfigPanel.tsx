import { type FC, useState, useCallback, useMemo } from 'react';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import type {
  Combinator,
  PhaseConditionDto,
  PhaseExitConfigDto,
  FailureAction,
  PhaseFailureConfigDto,
} from '@jian-agent/shared-domain';

type ConditionType = PhaseConditionDto['type'];

interface Props {
  readonly phaseIndex: number;
  readonly exitConfig: PhaseExitConfigDto;
  readonly failureConfig?: PhaseFailureConfigDto;
  readonly onExitConfigChange: (config: PhaseExitConfigDto) => void;
  readonly onFailureConfigChange: (config: PhaseFailureConfigDto) => void;
}

const CONDITION_TYPES: readonly { value: ConditionType; label: string }[] = [
  { value: 'time_elapsed', label: '经过时间 (秒)' },
  { value: 'all_bots_ready', label: '全部 Bot 就绪' },
  { value: 'bot_count_below', label: 'Bot 数量低于' },
  { value: 'tps_below', label: 'TPS 低于' },
  { value: 'custom_event', label: '自定义事件' },
];

const FAILURE_ACTIONS: readonly { value: FailureAction; label: string }[] = [
  { value: 'abort', label: '终止会话' },
  { value: 'retry', label: '重试当前阶段' },
  { value: 'rollback_to', label: '回退到指定阶段' },
];

const PhaseConfigPanel: FC<Props> = ({
  phaseIndex,
  exitConfig,
  failureConfig,
  onExitConfigChange,
  onFailureConfigChange,
}) => {
  const handleAddCondition = useCallback(() => {
    const newCondition: PhaseConditionDto = { type: 'time_elapsed', params: { seconds: 60 } };
    onExitConfigChange({
      ...exitConfig,
      conditions: [...exitConfig.conditions, newCondition],
    });
  }, [exitConfig, onExitConfigChange]);

  const handleRemoveCondition = useCallback(
    (index: number) => {
      onExitConfigChange({
        ...exitConfig,
        conditions: exitConfig.conditions.filter((_, i) => i !== index),
      });
    },
    [exitConfig, onExitConfigChange],
  );

  const handleConditionChange = useCallback(
    (index: number, type: ConditionType) => {
      const updated = exitConfig.conditions.map((c, i) =>
        i === index ? { ...c, type, params: {} } : c,
      );
      onExitConfigChange({ ...exitConfig, conditions: updated });
    },
    [exitConfig, onExitConfigChange],
  );

  const handleParamChange = useCallback(
    (index: number, key: string, value: string) => {
      const updated = exitConfig.conditions.map((c, i) =>
        i === index ? { ...c, params: { ...c.params, [key]: isNaN(Number(value)) ? value : Number(value) } } : c,
      );
      onExitConfigChange({ ...exitConfig, conditions: updated });
    },
    [exitConfig, onExitConfigChange],
  );

  const handleCombinatorChange = useCallback(
    (combinator: Combinator) => {
      onExitConfigChange({ ...exitConfig, combinator });
    },
    [exitConfig, onExitConfigChange],
  );

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-white dark:bg-zinc-900">
      <h3 className="font-semibold text-sm">阶段 {phaseIndex + 1} 退出条件</h3>

      {/* Combinator toggle */}
      <div className="flex gap-2 items-center text-sm">
        <span className="text-zinc-500">组合方式:</span>
        {(['AND', 'OR'] as const).map((c) => (
          <button
            key={c}
            type="button"
            className={`px-2 py-0.5 rounded text-xs ${
              exitConfig.combinator === c
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-200 dark:bg-zinc-700'
            }`}
            onClick={() => handleCombinatorChange(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Conditions list */}
      <div className="space-y-2">
        {exitConfig.conditions.map((cond, idx) => (
          <div key={idx} className="flex gap-2 items-center text-sm">
            <StyledSelect
              variant="compact"
              value={cond.type}
              onChange={(e) => handleConditionChange(idx, e.target.value as ConditionType)}
            >
              {CONDITION_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </StyledSelect>

            {(cond.type === 'time_elapsed' ||
              cond.type === 'bot_count_below' ||
              cond.type === 'tps_below') && (
              <input
                type="number"
                className="w-20 rounded border px-2 py-1 dark:bg-zinc-800 dark:border-zinc-700"
                value={String(
                  cond.params[cond.type === 'time_elapsed' ? 'seconds' : 'threshold'] ?? '',
                )}
                onChange={(e) =>
                  handleParamChange(
                    idx,
                    cond.type === 'time_elapsed' ? 'seconds' : 'threshold',
                    e.target.value,
                  )
                }
              />
            )}

            {cond.type === 'custom_event' && (
              <input
                type="text"
                placeholder="事件名"
                className="w-32 rounded border px-2 py-1 dark:bg-zinc-800 dark:border-zinc-700"
                value={String(cond.params['eventName'] ?? '')}
                onChange={(e) => handleParamChange(idx, 'eventName', e.target.value)}
              />
            )}

            <button
              type="button"
              className="text-red-500 hover:text-red-700 text-xs"
              onClick={() => handleRemoveCondition(idx)}
            >
              删除
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="text-sm text-blue-600 hover:underline"
        onClick={handleAddCondition}
      >
        + 添加条件
      </button>

      {/* Failure strategy */}
      <div className="border-t pt-3 mt-3 space-y-2">
        <h4 className="font-semibold text-sm">失败策略</h4>
        <StyledSelect
          variant="compact"
          value={failureConfig?.failureAction ?? 'abort'}
          onChange={(e) =>
            onFailureConfigChange({
              ...(failureConfig ?? { failureAction: 'abort' }),
              failureAction: e.target.value as FailureAction,
            })
          }
        >
          {FAILURE_ACTIONS.map((fa) => (
            <option key={fa.value} value={fa.value}>
              {fa.label}
            </option>
          ))}
        </StyledSelect>

        {failureConfig?.failureAction === 'retry' && (
          <label className="block text-sm">
            <span className="text-zinc-500">最大重试次数:</span>
            <input
              type="number"
              className="ml-2 w-16 rounded border px-2 py-1 dark:bg-zinc-800 dark:border-zinc-700"
              value={failureConfig.maxRetries ?? 3}
              onChange={(e) =>
                onFailureConfigChange({
                  ...failureConfig,
                  maxRetries: Number(e.target.value),
                })
              }
            />
          </label>
        )}

        {failureConfig?.failureAction === 'rollback_to' && (
          <label className="block text-sm">
            <span className="text-zinc-500">目标阶段索引:</span>
            <input
              type="number"
              className="ml-2 w-16 rounded border px-2 py-1 dark:bg-zinc-800 dark:border-zinc-700"
              value={failureConfig.rollbackTarget ?? 0}
              onChange={(e) =>
                onFailureConfigChange({
                  ...failureConfig,
                  rollbackTarget: Number(e.target.value),
                })
              }
            />
          </label>
        )}
      </div>
    </div>
  );
};

export default PhaseConfigPanel;
