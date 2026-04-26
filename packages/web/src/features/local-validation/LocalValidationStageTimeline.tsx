import type {
  LocalValidationRunDto,
  LocalValidationStageDto,
} from '../../api/local-validation.api.js';

interface LocalValidationStageTimelineProps {
  readonly run: LocalValidationRunDto | null;
  readonly stages: readonly LocalValidationStageDto[];
  readonly loading: boolean;
}

function stageTone(status: LocalValidationStageDto['status']): string {
  if (status === 'passed') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  }
  if (status === 'failed') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  }
  if (status === 'running') {
    return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

export function LocalValidationStageTimeline({
  run,
  stages,
  loading,
}: LocalValidationStageTimelineProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
            Timeline
          </p>
          <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">阶段时间线</h2>
        </div>
        {run ? (
          <div className="text-right text-sm text-gray-500 dark:text-gray-400">
            <div>{run.name}</div>
            <div>{run.status}</div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3">
        {!run ? (
          <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            选择一个运行后，这里会展示 ready、场景执行和收尾阶段。
          </div>
        ) : loading ? (
          <div className="rounded-xl border border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            正在同步阶段时间线...
          </div>
        ) : stages.length === 0 ? (
          <div className="rounded-xl border border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            当前运行还没有阶段记录。
          </div>
        ) : stages.map((stage) => (
          <article key={stage.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">{stage.title}</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {stage.stageKey} · timeout {Math.round(stage.timeoutMs / 1000)}s
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${stageTone(stage.status)}`}>
                {stage.status}
              </span>
            </div>
            <div className="mt-3 grid gap-3 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">断言</div>
                <div className="mt-1">
                  {stage.assertionSummary?.passed ?? 0}/{stage.assertionSummary?.total ?? 0} 通过
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Bot 分组</div>
                <div className="mt-1">
                  {(stage.botGroupSnapshot ?? []).length === 0
                    ? '暂无分组快照'
                    : (stage.botGroupSnapshot ?? []).map((group: StageGroupSnapshot) => `${group.name}(${group.botNames.length})`).join(' · ')}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">时间</div>
                <div className="mt-1">
                  {stage.startedAt ?? '未开始'}
                  {stage.finishedAt ? ` -> ${stage.finishedAt}` : ''}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
type StageGroupSnapshot = LocalValidationStageDto['botGroupSnapshot'][number];
