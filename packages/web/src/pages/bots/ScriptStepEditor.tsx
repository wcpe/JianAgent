import { useCallback } from 'react';
import type { BotScriptAction, BotScriptStep } from '@jian-agent/shared-protocol';

interface Props {
  readonly step: BotScriptStep;
  readonly index: number;
  readonly total: number;
  readonly onChange: (index: number, step: BotScriptStep) => void;
  readonly onMove: (index: number, dir: -1 | 1) => void;
  readonly onRemove: (index: number) => void;
}

const ACTION_META: Record<BotScriptAction, { label: string; icon: string; color: string }> = {
  walk:     { label: '前进', icon: '🚶', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' },
  chat:     { label: '说话', icon: '💬', color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' },
  wait:     { label: '等待', icon: '⏳', color: 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600' },
  turn:     { label: '转向', icon: '🔄', color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700' },
  jump:     { label: '跳跃', icon: '⬆️', color: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700' },
  attack:   { label: '攻击', icon: '⚔️', color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' },
  use_item: { label: '使用物品', icon: '🎒', color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700' },
  look:     { label: '看向', icon: '👁️', color: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-700' },
  move_to:  { label: '移动到', icon: '📍', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' },
};

const PARAM_FIELDS: Record<BotScriptAction, readonly string[]> = {
  walk:     ['direction', 'blocks'],
  chat:     ['message'],
  wait:     ['seconds'],
  turn:     ['direction', 'degrees'],
  jump:     [],
  attack:   [],
  use_item: ['item'],
  look:     ['target'],
  move_to:  ['target', 'distance'],
};

export function ScriptStepEditor({ step, index, total, onChange, onMove, onRemove }: Props) {
  const meta = ACTION_META[step.action];
  const fields = PARAM_FIELDS[step.action];

  const handleParamChange = useCallback(
    (key: string, value: string) => {
      const num = Number(value);
      const parsed: unknown = value === '' ? '' : Number.isFinite(num) && value === String(num) ? num : value;
      onChange(index, { ...step, params: { ...step.params, [key]: parsed } });
    },
    [step, index, onChange],
  );

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${meta.color}`}>
      <span className="text-lg pt-0.5">{meta.icon}</span>
      <div className="flex-1 min-w-0 space-y-1">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {index + 1}. {meta.label}
        </span>
        {fields.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {fields.map((key) => (
              <label key={key} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                {key}:
                <input
                  type="text"
                  value={String(step.params[key] ?? '')}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  className="w-24 px-1.5 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                />
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)}
          className="px-1.5 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700">
          ▲
        </button>
        <button type="button" disabled={index === total - 1} onClick={() => onMove(index, 1)}
          className="px-1.5 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700">
          ▼
        </button>
        <button type="button" onClick={() => onRemove(index)}
          className="px-1.5 py-0.5 text-xs rounded border border-danger-200 dark:border-danger-600 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-700/20">
          ✕
        </button>
      </div>
    </div>
  );
}
