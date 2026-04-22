import { useEffect, useState } from 'react';
import type {
  LocalValidationRunDto,
  LocalValidationScenarioPackDto,
} from '../../api/local-validation.api.js';

type BuilderStatus = 'idle' | 'creating' | 'starting' | 'cancelling';

interface LocalValidationRunBuilderProps {
  readonly scenarioPacks: readonly LocalValidationScenarioPackDto[];
  readonly runs: readonly LocalValidationRunDto[];
  readonly selectedRunId: string | null;
  readonly loadingRuns: boolean;
  readonly status: BuilderStatus;
  readonly onSelectRun: (runId: string) => Promise<void> | void;
  readonly onCreateRun: (input: {
    readonly name: string;
    readonly paperVersion: string;
    readonly scenarioPackId: string;
    readonly requestedBotCount: number;
    readonly keepServerRunning: boolean;
    readonly keepWorkspace: boolean;
  }) => Promise<void> | void;
  readonly onStartRun: (runId: string) => Promise<void> | void;
  readonly onCancelRun: (runId: string) => Promise<void> | void;
}

function statusTone(status: LocalValidationRunDto['status']): string {
  if (status === 'PASSED' || status === 'READY') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  }
  if (status.startsWith('FAILED') || status === 'CANCELLED') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

export function LocalValidationRunBuilder({
  scenarioPacks,
  runs,
  selectedRunId,
  loadingRuns,
  status,
  onSelectRun,
  onCreateRun,
  onStartRun,
  onCancelRun,
}: LocalValidationRunBuilderProps) {
  const [name, setName] = useState('本地 Paper 综合验收');
  const [paperVersion, setPaperVersion] = useState('1.21.1');
  const [scenarioPackId, setScenarioPackId] = useState('');
  const [requestedBotCount, setRequestedBotCount] = useState(8);
  const [keepServerRunning, setKeepServerRunning] = useState(false);
  const [keepWorkspace, setKeepWorkspace] = useState(true);

  useEffect(() => {
    if (!scenarioPackId && scenarioPacks[0]) {
      setScenarioPackId(scenarioPacks[0].id);
    }
  }, [scenarioPackId, scenarioPacks]);

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Run Builder
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">创建本地验证运行</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            初始化本地 Paper 测试服，执行综合对抗验收包，并保留运行证据。
          </p>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
            运行名称
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
              Paper 版本
              <input
                value={paperVersion}
                onChange={(event) => setPaperVersion(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
              机器人数量
              <input
                type="number"
                min={1}
                max={200}
                value={requestedBotCount}
                onChange={(event) => setRequestedBotCount(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
            场景包
            <select
              value={scenarioPackId}
              onChange={(event) => setScenarioPackId(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">选择场景包</option>
              {scenarioPacks.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name}
                </option>
              ))}
            </select>
          </label>

          {scenarioPacks.find((pack) => pack.id === scenarioPackId)?.description ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              {scenarioPacks.find((pack) => pack.id === scenarioPackId)?.description}
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={keepServerRunning}
              onChange={(event) => setKeepServerRunning(event.target.checked)}
            />
            运行后保留服务器进程
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={keepWorkspace}
              onChange={(event) => setKeepWorkspace(event.target.checked)}
            />
            保留工作目录与运行证据
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!scenarioPackId || status !== 'idle'}
            onClick={() => onCreateRun({
              name,
              paperVersion,
              scenarioPackId,
              requestedBotCount,
              keepServerRunning,
              keepWorkspace,
            })}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {status === 'creating' ? '创建中...' : '创建运行'}
          </button>
          {selectedRun ? (
            <>
              <button
                type="button"
                disabled={status !== 'idle' || selectedRun.status !== 'CREATED'}
                onClick={() => onStartRun(selectedRun.id)}
                className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300"
              >
                {status === 'starting' ? '启动中...' : '启动运行'}
              </button>
              <button
                type="button"
                disabled={status !== 'idle'}
                onClick={() => onCancelRun(selectedRun.id)}
                className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-700 dark:text-rose-300"
              >
                {status === 'cancelling' ? '取消中...' : '取消运行'}
              </button>
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Runs
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">最近运行</h3>
          </div>
          {loadingRuns ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">刷新中...</span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3">
          {runs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              还没有本地验证运行，先创建一个 Paper 验收运行。
            </div>
          ) : runs.map((run) => {
            const selected = run.id === selectedRunId;
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelectRun(run.id)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  selected
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{run.name}</div>
                    <div className={`mt-1 text-xs ${selected ? 'text-white/70 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'}`}>
                      {run.paperVersion ?? '未指定版本'} · {run.requestedBotCount} bots
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${selected ? 'bg-white/15 text-white dark:bg-slate-800 dark:text-slate-100' : statusTone(run.status)}`}>
                    {run.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
