import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useValidationStore, type ValidationMode } from './validation.store.js';
import { useServerStore } from '../../stores/server.store.js';
import { ValidationRunPanel } from './ValidationRunPanel.js';
import { ValidationVerdictCard } from './ValidationVerdictCard.js';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import type { ValidationPlanDto, ValidationPhaseDto } from '@jian-agent/shared-domain';

const MODES: { value: ValidationMode; label: string; desc: string }[] = [
  { value: 'quick', label: '快速验证', desc: '即开即用，自动采集关键指标并生成结论' },
  { value: 'template', label: '模板验证', desc: '基于预定义验证计划，按阶段执行多维度校验' },
  { value: 'post-ops', label: '运维后验证', desc: '变更上线后自动触发回归验证，确认服务健康' },
];

export function ValidationCenterPage() {
  const { mode, setMode, runView, activeRun, verdict, reset, startQuick } = useValidationStore();
  const servers = useServerStore((s) => s.servers);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // Auto-select quick mode from query params
  useEffect(() => {
    const qsId = params.get('serverId');
    if (qsId) setMode('quick');
  }, [params, setMode]);

  const runningServers = servers.filter((s) => s.runtimeStatus === 'running');

  // Quick validation form state
  const [serverId, setServerId] = useState(params.get('serverId') ?? '');
  const [botCount, setBotCount] = useState(10);
  const [durationSec, setDurationSec] = useState(300);

  useEffect(() => {
    const qsId = params.get('serverId');
    if (qsId && runningServers.some((s) => s.id === qsId)) {
      setServerId(qsId);
    }
  }, [params, runningServers]);

  const handleQuickStart = useCallback(async () => {
    if (!serverId) return;
    setError(null);
    try {
      await startQuick(serverId, `quick-${Date.now()}`, botCount, durationSec);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '启动验证失败');
    }
  }, [serverId, botCount, durationSec, startQuick]);

  const handleReset = useCallback(() => {
    reset();
    setError(null);
  }, [reset]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">验证中心</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          统一管理快速验证、模板验证与运维后验证
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => { setMode(m.value); handleReset(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m.value
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Mode description */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {MODES.find((m) => m.value === mode)?.desc}
      </p>

      {/* Quick validation config form */}
      {mode === 'quick' && runView === 'idle' && (
        <div className="bg-white dark:bg-gray-800/50 shadow-sm dark:shadow-none rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">快速验证配置</h2>
          {runningServers.length === 0 ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 text-sm text-yellow-700 dark:text-yellow-300">
              没有运行中的服务器，请先启动一台
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">目标服务器</label>
                <StyledSelect
                  className="w-full"
                  value={serverId}
                  onChange={(e) => setServerId(e.target.value)}
                >
                  <option value="">选择服务器</option>
                  {runningServers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </StyledSelect>
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">机器人数量</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
                  value={botCount}
                  onChange={(e) => setBotCount(parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">持续时长（秒）</label>
                <input
                  type="number"
                  min={30}
                  max={7200}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
                  value={durationSec}
                  onChange={(e) => setDurationSec(parseInt(e.target.value, 10) || 300)}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={!serverId}
                  onClick={handleQuickStart}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm rounded px-6 py-2 font-medium"
                >
                  开始验证
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Template mode placeholder */}
      {mode === 'template' && runView === 'idle' && (
        <div className="bg-white dark:bg-gray-800/50 shadow-sm dark:shadow-none rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">模板验证</h2>
          <TemplateSelector />
        </div>
      )}

      {/* Post-ops mode placeholder */}
      {mode === 'post-ops' && runView === 'idle' && (
        <div className="bg-white dark:bg-gray-800/50 shadow-sm dark:shadow-none rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">运维后验证</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            运维后验证在插件安装、服务器重启等运维操作完成后自动触发。
            请在服务器工作台的运维面板中发起操作，系统将自动执行验证流程。
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Active run panel */}
      {runView !== 'idle' && activeRun && (
        <ValidationRunPanel />
      )}

      {/* Verdict card */}
      {runView === 'verdict' && verdict && (
        <ValidationVerdictCard />
      )}

      {/* Reset button */}
      {runView !== 'idle' && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-sm border border-gray-300 dark:border-gray-600 rounded px-4 py-2"
          >
            返回验证中心
          </button>
        </div>
      )}
    </div>
  );
}

function TemplateSelector() {
  const { plans, plansLoading, loadPlans, startPlan } = useValidationStore();
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleStart = async () => {
    if (!selectedPlanId) return;
    setError(null);
    try {
      await startPlan(selectedPlanId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '启动模板验证失败');
    }
  };

  if (plansLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">加载验证计划...</p>;
  }

  if (plans.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        暂无验证计划。请先在后端创建验证计划模板。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">验证计划</label>
          <StyledSelect
            className="w-full"
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
          >
            <option value="">选择验证计划</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.targetType})
              </option>
            ))}
          </StyledSelect>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            disabled={!selectedPlanId}
            onClick={handleStart}
            className="bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm rounded px-6 py-2 font-medium"
          >
            启动模板验证
          </button>
        </div>
      </div>
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
      {selectedPlanId && (
        <PlanDetail plan={plans.find((p) => p.id === selectedPlanId)!} />
      )}
    </div>
  );
}

function PlanDetail({ plan }: { readonly plan: ValidationPlanDto }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 space-y-3">
      <div className="flex gap-4 text-sm">
        <span className="text-gray-500 dark:text-gray-400">目标类型: <span className="text-gray-800 dark:text-gray-200">{plan.targetType}</span></span>
        <span className="text-gray-500 dark:text-gray-400">通过阈值: <span className="text-gray-800 dark:text-gray-200">{plan.successThreshold}%</span></span>
        <span className="text-gray-500 dark:text-gray-400">触发方式: <span className="text-gray-800 dark:text-gray-200">{plan.triggerType}</span></span>
      </div>
      <div>
        <span className="text-sm text-gray-500 dark:text-gray-400">验证阶段:</span>
        <div className="flex flex-wrap gap-2 mt-1">
          {([...plan.phases] as ValidationPhaseDto[]).sort((a, b) => a.order - b.order).map((phase) => (
            <span
              key={phase.id}
              className="px-2 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded text-xs"
            >
              {phase.name} ({phase.criteria.length} 指标)
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
