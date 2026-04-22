import { type FC, useState, useCallback } from 'react';
import { useAlertsStore } from './alerts.store.js';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import type { CreateAlertRuleDto } from '@jian-agent/shared-domain';

const METRICS = ['TPS', 'MSPT', 'MEMORY_USAGE', 'BOT_DISCONNECT_RATE', 'PLAYER_COUNT', 'ENTITY_COUNT', 'LOADED_CHUNKS'] as const;
const OPERATORS = ['LESS_THAN', 'GREATER_THAN', 'EQUALS'] as const;
const LEVELS = ['INFO', 'WARNING', 'CRITICAL'] as const;

const OPERATOR_LABELS: Record<string, string> = {
  LESS_THAN: '< 小于',
  GREATER_THAN: '> 大于',
  EQUALS: '= 等于',
};

interface Props {
  readonly onClose: () => void;
}

const AlertRuleForm: FC<Props> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [metric, setMetric] = useState<string>(METRICS[0]);
  const [operator, setOperator] = useState<string>(OPERATORS[0]);
  const [threshold, setThreshold] = useState('');
  const [level, setLevel] = useState<string>(LEVELS[1]);
  const [cooldown, setCooldown] = useState('60');
  const createRule = useAlertsStore((s) => s.createRule);

  const handleSubmit = useCallback(async () => {
    if (!name || !threshold) return;
    const dto: CreateAlertRuleDto = {
      name,
      metric: metric as CreateAlertRuleDto['metric'],
      operator: operator as CreateAlertRuleDto['operator'],
      threshold: parseFloat(threshold),
      level: level as CreateAlertRuleDto['level'],
      cooldownSeconds: parseInt(cooldown, 10) || 60,
    };
    await createRule(dto);
    onClose();
  }, [name, metric, operator, threshold, level, cooldown, createRule, onClose]);

  const inputCls = 'w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded px-3 py-1.5 text-sm';
  const selectCls = 'w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded px-2 py-1.5 text-sm';

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-lg dark:shadow-none border border-gray-200 dark:border-gray-700 p-6 space-y-4">
      <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">创建告警规则</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">规则名称</label>
          <input
            className={inputCls}
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="例: TPS 过低警告"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">指标</label>
          <StyledSelect className="w-full" value={metric}
            onChange={(e) => setMetric(e.target.value)}>
            {METRICS.map((m) => <option key={m} value={m}>{m}</option>)}
          </StyledSelect>
        </div>
        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">条件</label>
          <StyledSelect className="w-full" value={operator}
            onChange={(e) => setOperator(e.target.value)}>
            {OPERATORS.map((o) => <option key={o} value={o}>{OPERATOR_LABELS[o]}</option>)}
          </StyledSelect>
        </div>
        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">阈值</label>
          <input type="number" className={inputCls}
            value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">告警级别</label>
          <StyledSelect className="w-full" value={level}
            onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </StyledSelect>
        </div>
        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">冷却 (秒)</label>
          <input type="number" className={inputCls}
            value={cooldown} onChange={(e) => setCooldown(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50" onClick={onClose}>取消</button>
        <button className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={handleSubmit}>创建</button>
      </div>
    </div>
  );
};

export default AlertRuleForm;
